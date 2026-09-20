import type { ChangeEntry, FarmState, Plot, WorkKind, WorkLog } from './types';
import { WORK_KINDS, workKindLabel } from './types';
import { genId, loadState, saveState } from './storage';
import { daysBetween, parseDate } from '../utils/date';

export interface NewLogInput {
  plotId: string;
  crop: string;
  kind: WorkKind;
  date: string;
  detail?: string;
  amount?: string;
}

export interface EditLogInput {
  crop?: string;
  kind?: WorkKind;
  date?: string;
  detail?: string;
  amount?: string;
  count?: number;
}

const FIELD_LABELS: Record<string, string> = {
  crop: '作物',
  kind: '农活',
  date: '日期',
  detail: '明细',
  amount: '用量',
  count: '遍数',
};

function displayValue(field: string, value: unknown): string {
  if (field === 'kind') return workKindLabel(value as WorkKind);
  if (value === undefined || value === null || value === '') return '（空）';
  return String(value);
}

// 农事账本：所有写操作都留下修改痕迹
export class FarmLogStore {
  state: FarmState;

  constructor(state?: FarmState) {
    this.state = state ?? loadState();
  }

  persist() {
    saveState(this.state);
  }

  get user(): string {
    return this.state.user;
  }

  setUser(name: string) {
    this.state.user = name.trim() || '庄稼人';
    this.persist();
  }

  // ---- 地块 ----

  addPlot(name: string, crop: string, owner?: string): Plot {
    const plot: Plot = {
      id: genId(),
      name: name.trim(),
      crop: crop.trim(),
      owner: (owner ?? this.state.user).trim() || this.state.user,
      active: true,
      createdAt: Date.now(),
    };
    this.state.plots.push(plot);
    this.persist();
    return plot;
  }

  getPlot(plotId: string): Plot | undefined {
    return this.state.plots.find(p => p.id === plotId);
  }

  // 地块转手：历史记录原样保留，标记后不再接受新记录
  transferPlot(plotId: string, toOwner: string): Plot {
    const plot = this.requirePlot(plotId);
    const from = plot.owner;
    plot.active = false;
    plot.transferredAt = Date.now();
    plot.owner = toOwner.trim() || from;
    this.state.history.push({
      id: genId(),
      logId: plotId,
      at: Date.now(),
      by: this.state.user,
      action: 'update',
      changes: [
        { field: 'plot-status', label: '地块状态', from: '在种', to: '已转手' },
        { field: 'plot-owner', label: '经手人', from, to: plot.owner },
      ],
    });
    this.persist();
    return plot;
  }

  // 重新接手一块已转手的地（另开新茬，历史仍在）
  reopenPlot(plotId: string, crop: string, owner?: string): Plot {
    const plot = this.requirePlot(plotId);
    plot.active = true;
    plot.transferredAt = undefined;
    plot.crop = crop.trim();
    plot.owner = (owner ?? this.state.user).trim() || this.state.user;
    this.state.history.push({
      id: genId(),
      logId: plotId,
      at: Date.now(),
      by: this.state.user,
      action: 'update',
      changes: [
        { field: 'plot-status', label: '地块状态', from: '已转手', to: '在种' },
        { field: 'crop', label: '新茬作物', from: '（空）', to: plot.crop },
      ],
    });
    this.persist();
    return plot;
  }

  // ---- 记账 ----

  // 随手记一笔；同一天、同一块地、同一茬作物、同一类农活合并为一条
  addLog(input: NewLogInput, now: number = Date.now()): { log: WorkLog; merged: boolean } {
    const plot = this.requirePlot(input.plotId);
    if (!plot.active) {
      throw new Error(`「${plot.name}」已经转手，不能再往里面添新记录了`);
    }
    const crop = input.crop.trim() || plot.crop;
    const detail = (input.detail ?? '').trim();
    const amount = (input.amount ?? '').trim();

    const existing = this.state.logs.find(
      l => l.plotId === input.plotId && l.date === input.date && l.kind === input.kind && l.crop === crop,
    );

    if (existing) {
      const changes: ChangeEntry['changes'] = [];
      existing.count += 1;
      changes.push({ field: 'count', label: '遍数', from: String(existing.count - 1), to: String(existing.count) });

      if (amount && !existing.amount.split(/[；;]/).map(s => s.trim()).includes(amount)) {
        const before = existing.amount;
        existing.amount = before ? `${before}；${amount}` : amount;
        changes.push({ field: 'amount', label: '用量', from: before || '（空）', to: existing.amount });
      }
      if (detail && !existing.detail.split(/[；;]/).map(s => s.trim()).includes(detail)) {
        const before = existing.detail;
        existing.detail = before ? `${before}；${detail}` : detail;
        changes.push({ field: 'detail', label: '明细', from: before || '（空）', to: existing.detail });
      }
      existing.updatedAt = now;
      this.pushHistory(existing.id, 'merge', changes, now);
      this.persist();
      return { log: existing, merged: true };
    }

    const log: WorkLog = {
      id: genId(),
      plotId: input.plotId,
      crop,
      kind: input.kind,
      date: input.date,
      detail,
      amount,
      count: 1,
      createdAt: now,
      createdBy: this.state.user,
      updatedAt: now,
    };
    this.state.logs.push(log);
    this.pushHistory(log.id, 'create', [
      { field: 'plot', label: '地块', from: '', to: plot.name },
      { field: 'crop', label: '作物', from: '', to: crop },
      { field: 'kind', label: '农活', from: '', to: workKindLabel(input.kind) },
      { field: 'date', label: '日期', from: '', to: input.date },
    ], now);
    this.persist();
    return { log, merged: false };
  }

  // 记错了可以改：逐字段对比，留下谁改的、改了哪里
  editLog(logId: string, patch: EditLogInput, now: number = Date.now()): WorkLog {
    const log = this.requireLog(logId);
    const candidates: Array<{ field: string; value: unknown }> = [
      { field: 'crop', value: patch.crop?.trim() },
      { field: 'kind', value: patch.kind },
      { field: 'date', value: patch.date },
      { field: 'detail', value: patch.detail?.trim() },
      { field: 'amount', value: patch.amount?.trim() },
      { field: 'count', value: patch.count },
    ];

    const changes: ChangeEntry['changes'] = [];
    for (const { field, value } of candidates) {
      if (value === undefined) continue;
      const before = (log as unknown as Record<string, unknown>)[field];
      if (String(before ?? '') !== String(value)) {
        changes.push({
          field,
          label: FIELD_LABELS[field] ?? field,
          from: displayValue(field, before),
          to: displayValue(field, value),
        });
        (log as unknown as Record<string, unknown>)[field] = value;
      }
    }

    if (changes.length > 0) {
      log.updatedAt = now;
      this.pushHistory(log.id, 'update', changes, now);
      this.persist();
    }
    return log;
  }

  deleteLog(logId: string, now: number = Date.now()): void {
    const log = this.requireLog(logId);
    this.pushHistory(log.id, 'delete', [
      { field: 'kind', label: '农活', from: workKindLabel(log.kind), to: '' },
      { field: 'date', label: '日期', from: log.date, to: '' },
    ], now);
    this.state.logs = this.state.logs.filter(l => l.id !== logId);
    this.persist();
  }

  historyOf(logId: string): ChangeEntry[] {
    return this.state.history
      .filter(h => h.logId === logId)
      .sort((a, b) => a.at - b.at);
  }

  // ---- 查询 ----

  // 某块地按作物（茬口）串起来的农事过程，时间正序
  timeline(plotId: string, crop?: string): WorkLog[] {
    return this.state.logs
      .filter(l => l.plotId === plotId && (crop === undefined || l.crop === crop))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  }

  // 一块地按茬口分组
  cropBatches(plotId: string): Array<{ crop: string; logs: WorkLog[] }> {
    const map = new Map<string, WorkLog[]>();
    for (const log of this.timeline(plotId)) {
      const list = map.get(log.crop) ?? [];
      list.push(log);
      map.set(log.crop, list);
    }
    return [...map.entries()].map(([crop, logs]) => ({ crop, logs }));
  }

  // 距今天各类农活上次做过隔了多少天
  daysSinceLast(plotId: string, crop: string, today: string): Array<{ kind: WorkKind; label: string; date: string; days: number }> {
    const logs = this.timeline(plotId, crop);
    const result: Array<{ kind: WorkKind; label: string; date: string; days: number }> = [];
    for (const kind of WORK_KINDS.map(k => k.value)) {
      const last = [...logs].reverse().find(l => l.kind === kind);
      if (last) {
        result.push({
          kind,
          label: workKindLabel(kind),
          date: last.date,
          days: diffDays(last.date, today),
        });
      }
    }
    return result;
  }

  // 相邻两次同类农活之间隔了多少天（如两次施肥的间隔）
  intervals(plotId: string, crop: string): Array<{ kind: WorkKind; label: string; from: string; to: string; days: number }> {
    const out: Array<{ kind: WorkKind; label: string; from: string; to: string; days: number }> = [];
    const lastByKind = new Map<WorkKind, WorkLog>();
    for (const batch of this.cropBatches(plotId).filter(b => b.crop === crop)) {
      for (const log of batch.logs) {
        const prev = lastByKind.get(log.kind);
        if (prev) {
          out.push({
            kind: log.kind,
            label: workKindLabel(log.kind),
            from: prev.date,
            to: log.date,
            days: diffDays(prev.date, log.date),
          });
        }
        lastByKind.set(log.kind, log);
      }
    }
    return out;
  }

  private requirePlot(plotId: string): Plot {
    const plot = this.state.plots.find(p => p.id === plotId);
    if (!plot) throw new Error('地块不存在');
    return plot;
  }

  private requireLog(logId: string): WorkLog {
    const log = this.state.logs.find(l => l.id === logId);
    if (!log) throw new Error('记录不存在或已删除');
    return log;
  }

  private pushHistory(logId: string, action: ChangeEntry['action'], changes: ChangeEntry['changes'], at: number) {
    if (changes.length === 0 && action === 'update') return;
    this.state.history.push({ id: genId(), logId, at, by: this.state.user, action, changes });
  }
}

function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = parseDate(from);
  const [y2, m2, d2] = parseDate(to);
  return daysBetween(y1, m1, d1, y2, m2, d2);
}
