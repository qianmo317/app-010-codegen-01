import { describe, it, expect } from 'vitest';
import { FarmLogStore } from './store';
import { emptyState } from './storage';
import { getPendingTasks } from './reminder';
import type { FarmState } from './types';

function makeStore(): FarmLogStore {
  const state: FarmState = emptyState();
  state.user = '老王';
  return new FarmLogStore(state);
}

describe('随手记账', () => {
  it('同一天同一块地同一类活记两遍应合并成一条，遍数累加', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01', amount: '1车水' });
    const second = store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01', amount: '1车水' });

    expect(second.merged).toBe(true);
    expect(store.state.logs).toHaveLength(1);
    expect(store.state.logs[0].count).toBe(2);
    // 用量不重复拼接
    expect(store.state.logs[0].amount).toBe('1车水');
  });

  it('同一天不同类型的活不合并', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'sowing', date: '2026-03-01' });
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01' });
    expect(store.state.logs).toHaveLength(2);
  });

  it('不同作物（换茬）的记录即使类型日期相同也不合并', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'fertilizing', date: '2026-03-01', detail: '尿素' });
    store.addLog({ plotId: plot.id, crop: '玉米', kind: 'fertilizing', date: '2026-03-01', detail: '复合肥' });
    expect(store.state.logs).toHaveLength(2);
  });

  it('合并时不同用量/明细用分号串起来', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'pesticide', date: '2026-05-01', amount: '吡虫啉10ml' });
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'pesticide', date: '2026-05-01', amount: '多菌灵20g' });
    expect(store.state.logs[0].amount).toBe('吡虫啉10ml；多菌灵20g');
    expect(store.state.logs[0].count).toBe(2);
  });
});

describe('按作物串农事过程与间隔', () => {
  it('能看出上次施肥到现在隔了多少天', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'fertilizing', date: '2026-03-01', detail: '尿素' });
    const stats = store.daysSinceLast(plot.id, '小麦', '2026-03-16');
    const fert = stats.find(s => s.kind === 'fertilizing');
    expect(fert?.days).toBe(15);
    expect(fert?.date).toBe('2026-03-01');
  });

  it('相邻两次同类活给出间隔天数', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'fertilizing', date: '2026-03-01' });
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'fertilizing', date: '2026-03-21' });
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-10' });
    const intervals = store.intervals(plot.id, '小麦');
    expect(intervals).toHaveLength(1);
    expect(intervals[0].days).toBe(20);
    expect(intervals[0].kind).toBe('fertilizing');
  });
});

describe('修改留痕', () => {
  it('记错了可以改，且留下谁改的、改了哪里', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    const { log } = store.addLog({ plotId: plot.id, crop: '小麦', kind: 'fertilizing', date: '2026-03-01', detail: '尿素' });
    store.setUser('小李');
    store.editLog(log.id, { detail: '复合肥', amount: '20kg' });

    const history = store.historyOf(log.id);
    const update = history.find(h => h.action === 'update');
    expect(update).toBeTruthy();
    expect(update?.by).toBe('小李');
    const fields = update!.changes.map(c => c.field);
    expect(fields).toContain('detail');
    expect(fields).toContain('amount');
    const detailChange = update!.changes.find(c => c.field === 'detail');
    expect(detailChange?.from).toBe('尿素');
    expect(detailChange?.to).toBe('复合肥');
  });

  it('合并本身也留痕（标明遍数变化）', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01' });
    const { log } = store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01' });
    const merge = store.historyOf(log.id).find(h => h.action === 'merge');
    expect(merge?.by).toBe('老王');
    expect(merge?.changes[0]).toMatchObject({ field: 'count', from: '1', to: '2' });
  });

  it('删除也留痕，记录消失但痕迹还在', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    const { log } = store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-01' });
    store.deleteLog(log.id);
    expect(store.state.logs).toHaveLength(0);
    expect(store.state.history.some(h => h.action === 'delete')).toBe(true);
  });
});

describe('地块转手', () => {
  it('转手后历史记录还在，但不能再添新的', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.addLog({ plotId: plot.id, crop: '小麦', kind: 'sowing', date: '2026-03-01' });
    store.transferPlot(plot.id, '赵家');

    expect(store.getPlot(plot.id)?.active).toBe(false);
    expect(store.timeline(plot.id)).toHaveLength(1);
    expect(() =>
      store.addLog({ plotId: plot.id, crop: '小麦', kind: 'irrigation', date: '2026-03-02' }),
    ).toThrow(/转手/);
    expect(store.state.logs).toHaveLength(1);
  });

  it('转手的地不再出现在节气待办里', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    store.transferPlot(plot.id, '赵家');
    const pending = getPendingTasks(store, new Date(2026, 2, 10));
    expect(pending.some(p => p.plot.id === plot.id)).toBe(false);
  });
});

describe('节气待办提醒', () => {
  it('这阵子一直没记的节气活被挑出来', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '小麦');
    // 2026-03-10 处于惊蛰节气窗口，惊蛰含「春耕/播种/防虫」等
    const pending = getPendingTasks(store, new Date(2026, 2, 10));
    const plotTasks = pending.filter(p => p.plot.id === plot.id);
    expect(plotTasks.length).toBeGreaterThan(0);
    expect(plotTasks.some(t => t.kind === 'sowing' || t.kind === 'pesticide')).toBe(true);
    expect(plotTasks[0].daysSinceTerm).toBeGreaterThanOrEqual(0);
  });

  it('已经记过的活不再提醒', () => {
    const store = makeStore();
    const plot = store.addPlot('东头地', '春玉米');
    // 惊蛰前一天播下春玉米（惊蛰约 3/5-6）
    store.addLog({ plotId: plot.id, crop: '春玉米', kind: 'sowing', date: '2026-03-06', detail: '春玉米' });
    const pending = getPendingTasks(store, new Date(2026, 2, 10));
    const sowing = pending.filter(p => p.plot.id === plot.id && p.kind === 'sowing');
    expect(sowing).toHaveLength(0);
  });
});
