// 农事记录存储：地块管理 + 记录增改 + 合并 + 留痕
import { ACTIVITY_TYPES, ActivityType, FarmRecord, Plot } from './types';
import { daysBetween } from '../utils/date';

const PLOTS_KEY = 'farm-log:plots';
const RECORDS_KEY = 'farm-log:records';
const OPERATOR_KEY = 'farm-log:operator';

// 存储抽象：浏览器用 localStorage，测试环境退化为内存
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: k => (memory.has(k) ? memory.get(k)! : null),
  setItem: (k, v) => { memory.set(k, v); },
  removeItem: k => { memory.delete(k); }
};

function storage(): StorageLike {
  return typeof localStorage !== 'undefined' ? localStorage : memoryStorage;
}

let plotsCache: Plot[] | null = null;
let recordsCache: FarmRecord[] | null = null;

function loadPlots(): Plot[] {
  if (plotsCache) return plotsCache;
  try {
    plotsCache = JSON.parse(storage().getItem(PLOTS_KEY) ?? '[]') as Plot[];
  } catch {
    plotsCache = [];
  }
  return plotsCache;
}

function loadRecords(): FarmRecord[] {
  if (recordsCache) return recordsCache;
  try {
    recordsCache = JSON.parse(storage().getItem(RECORDS_KEY) ?? '[]') as FarmRecord[];
  } catch {
    recordsCache = [];
  }
  return recordsCache;
}

function savePlots(plots: Plot[]) {
  plotsCache = plots;
  storage().setItem(PLOTS_KEY, JSON.stringify(plots));
}

function saveRecords(records: FarmRecord[]) {
  recordsCache = records;
  storage().setItem(RECORDS_KEY, JSON.stringify(records));
}

// 本地时间 'YYYY-MM-DD HH:mm'，字典序与时间序一致，可直接比较排序
function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── 记录人 ──

export function getOperator(): string {
  return storage().getItem(OPERATOR_KEY) ?? '';
}

export function setOperator(name: string): void {
  storage().setItem(OPERATOR_KEY, name.trim());
}

// ── 地块 ──

export function getPlots(): Plot[] {
  return [...loadPlots()];
}

export function getPlot(id: string): Plot | undefined {
  return loadPlots().find(p => p.id === id);
}

export function addPlot(input: { name: string; area?: string; crop?: string }): Plot {
  const plot: Plot = {
    id: genId(),
    name: input.name.trim(),
    area: (input.area ?? '').trim(),
    crop: (input.crop ?? '').trim(),
    status: 'active',
    createdAt: nowLocal()
  };
  const plots = loadPlots();
  plots.push(plot);
  savePlots(plots);
  return plot;
}

// 换茬：改当前作物，旧作物的记录仍归在旧作物名下
export function setPlotCrop(id: string, crop: string): void {
  const plots = loadPlots();
  const plot = plots.find(p => p.id === id);
  if (!plot) return;
  plot.crop = crop.trim();
  savePlots(plots);
}

// 地块转手：历史记录保留，但不再接受新记录
export function transferPlot(id: string, note: string): Plot | undefined {
  const plots = loadPlots();
  const plot = plots.find(p => p.id === id);
  if (!plot || plot.status === 'transferred') return plot;
  plot.status = 'transferred';
  plot.transferredAt = nowLocal();
  plot.transferNote = note.trim();
  savePlots(plots);
  return plot;
}

// ── 记录 ──

export interface RecordInput {
  plotId: string;
  date: string; // YYYY-MM-DD
  type: ActivityType;
  crop?: string;
  detail?: string;
}

export function getRecords(plotId?: string): FarmRecord[] {
  const records = loadRecords();
  const list = plotId ? records.filter(r => r.plotId === plotId) : records;
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

// 记一笔；同一天同一块地同类的活自动合并成一条
export function addRecord(input: RecordInput, by: string): { record: FarmRecord; merged: boolean } {
  const plot = getPlot(input.plotId);
  if (!plot) throw new Error('地块不存在');
  if (plot.status === 'transferred') throw new Error('地块已转手，不能再记新账');

  const records = loadRecords();
  const now = nowLocal();
  const detail = (input.detail ?? '').trim();
  const crop = (input.crop ?? '').trim() || plot.crop;

  const existing = records.find(r => r.plotId === input.plotId && r.date === input.date && r.type === input.type);
  if (existing) {
    mergeInto(existing, detail, crop, by, now);
    saveRecords(records);
    return { record: existing, merged: true };
  }

  const record: FarmRecord = {
    id: genId(),
    plotId: input.plotId,
    date: input.date,
    type: input.type,
    crop,
    detail,
    createdBy: by,
    createdAt: now,
    updatedAt: now,
    mergedCount: 0,
    edits: []
  };
  records.push(record);
  saveRecords(records);
  return { record, merged: false };
}

// 把重复记的一笔并进已有记录
function mergeInto(target: FarmRecord, detail: string, crop: string, by: string, now: string): void {
  const changes: string[] = [];
  if (detail) {
    if (!target.detail) {
      target.detail = detail;
      changes.push(`补充明细：${detail}`);
    } else if (!target.detail.includes(detail)) {
      changes.push(`明细：${target.detail} → ${target.detail}；${detail}`);
      target.detail = `${target.detail}；${detail}`;
    }
  }
  if (crop && !target.crop) {
    target.crop = crop;
    changes.push(`补充作物：${crop}`);
  }
  target.mergedCount += 1;
  target.updatedAt = now;
  changes.unshift(`同日第 ${target.mergedCount + 1} 次记同类的活，合并成一条`);
  target.edits.push({ at: now, by, changes });
}

export interface RecordPatch {
  date?: string;
  type?: ActivityType;
  crop?: string;
  detail?: string;
}

// 改记录：留下谁改的、改了哪里
export function updateRecord(id: string, patch: RecordPatch, by: string): FarmRecord {
  const records = loadRecords();
  const record = records.find(r => r.id === id);
  if (!record) throw new Error('记录不存在');

  const changes: string[] = [];
  if (patch.date !== undefined && patch.date !== record.date) {
    changes.push(`日期：${record.date} → ${patch.date}`);
    record.date = patch.date;
  }
  if (patch.type !== undefined && patch.type !== record.type) {
    changes.push(`类型：${record.type} → ${patch.type}`);
    record.type = patch.type;
  }
  if (patch.crop !== undefined && patch.crop.trim() !== record.crop) {
    changes.push(`作物：${record.crop || '（空）'} → ${patch.crop.trim() || '（空）'}`);
    record.crop = patch.crop.trim();
  }
  if (patch.detail !== undefined && patch.detail.trim() !== record.detail) {
    changes.push(`明细：${record.detail || '（空）'} → ${patch.detail.trim() || '（空）'}`);
    record.detail = patch.detail.trim();
  }

  const now = nowLocal();
  if (changes.length > 0) {
    record.updatedAt = now;
    record.edits.push({ at: now, by, changes });
  }

  // 改完后若与另一条撞车（同天同地同类），也合并成一条
  const clash = records.find(r =>
    r.id !== record.id && r.plotId === record.plotId && r.date === record.date && r.type === record.type
  );
  if (clash) {
    if (clash.detail && !record.detail.includes(clash.detail)) {
      record.detail = record.detail ? `${record.detail}；${clash.detail}` : clash.detail;
    }
    record.mergedCount += clash.mergedCount + 1;
    record.edits.push(...clash.edits);
    record.edits.push({ at: now, by, changes: ['改完后与同日同类的另一条记录合并'] });
    records.splice(records.indexOf(clash), 1);
    record.updatedAt = now;
  }

  saveRecords(records);
  return record;
}

// ── 统计与分组 ──

export interface ActivityStat {
  type: ActivityType;
  lastDate: string; // 最近一次干的日期
  daysAgo: number;  // 距今天几天
}

// 每类活距今天隔了多少天（只返回有记录的）
export function getPlotActivityStats(plotId: string, today: string): ActivityStat[] {
  const records = getRecords(plotId); // 已按日期倒序
  const [ty, tm, td] = today.split('-').map(Number);
  const stats: ActivityStat[] = [];
  for (const type of ACTIVITY_TYPES) {
    const latest = records.find(r => r.type === type);
    if (!latest) continue;
    const [y, m, d] = latest.date.split('-').map(Number);
    stats.push({ type, lastDate: latest.date, daysAgo: daysBetween(y, m, d, ty, tm, td) });
  }
  return stats;
}

export interface CropGroup {
  crop: string;
  records: FarmRecord[];
}

// 按作物把同一块地的农事过程串起来（最新作物在前，组内按日期倒序）
export function getRecordsByCrop(plotId: string): CropGroup[] {
  const groups: CropGroup[] = [];
  for (const r of getRecords(plotId)) {
    const crop = r.crop || '未标作物';
    let g = groups.find(g => g.crop === crop);
    if (!g) {
      g = { crop, records: [] };
      groups.push(g);
    }
    g.records.push(r);
  }
  return groups;
}

// 测试用：清空全部数据
export function resetFarmLogStore(): void {
  plotsCache = null;
  recordsCache = null;
  storage().removeItem(PLOTS_KEY);
  storage().removeItem(RECORDS_KEY);
  storage().removeItem(OPERATOR_KEY);
}
