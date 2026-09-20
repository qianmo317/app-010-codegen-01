import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPlot, addRecord, getPlot, getPlots, getRecords, getRecordsByCrop,
  getPlotActivityStats, resetFarmLogStore, setPlotCrop, transferPlot, updateRecord
} from './store';
import { getCurrentTermWindow, getPendingReminders, matchTaskType, recordCoversTask } from './remind';
import { formatDate } from '../utils/date';

beforeEach(() => resetFarmLogStore());

describe('农事记录', () => {
  it('能记一笔并读出来，作物默认跟地块', () => {
    const plot = addPlot({ name: '东头地', area: '3亩', crop: '小麦' });
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '施肥', detail: '尿素20斤' }, '张三');
    const records = getRecords(plot.id);
    expect(records).toHaveLength(1);
    expect(records[0].detail).toBe('尿素20斤');
    expect(records[0].crop).toBe('小麦');
    expect(records[0].createdBy).toBe('张三');
  });

  it('同一天同一块地同类的活合并成一条', () => {
    const plot = addPlot({ name: '东头地' });
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '浇水', detail: '上午浇一遍' }, '张三');
    const r2 = addRecord({ plotId: plot.id, date: '2026-09-20', type: '浇水', detail: '下午又浇一遍' }, '李四');
    expect(r2.merged).toBe(true);
    const records = getRecords(plot.id);
    expect(records).toHaveLength(1);
    expect(records[0].detail).toBe('上午浇一遍；下午又浇一遍');
    expect(records[0].mergedCount).toBe(1);
    expect(records[0].edits).toHaveLength(1);
    expect(records[0].edits[0].by).toBe('李四');
    expect(records[0].edits[0].changes.join('')).toContain('合并');
  });

  it('不同天或不同类不合并', () => {
    const plot = addPlot({ name: '东头地' });
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '浇水' }, '张三');
    addRecord({ plotId: plot.id, date: '2026-09-21', type: '浇水' }, '张三');
    addRecord({ plotId: plot.id, date: '2026-09-21', type: '施肥' }, '张三');
    expect(getRecords(plot.id)).toHaveLength(3);
  });

  it('改记录要留下谁改的、改了哪里', () => {
    const plot = addPlot({ name: '东头地' });
    const { record } = addRecord({ plotId: plot.id, date: '2026-09-20', type: '施肥', detail: '尿素10斤' }, '张三');
    updateRecord(record.id, { detail: '尿素20斤', date: '2026-09-19' }, '李四');
    const [r] = getRecords(plot.id);
    expect(r.detail).toBe('尿素20斤');
    expect(r.date).toBe('2026-09-19');
    expect(r.edits).toHaveLength(1);
    expect(r.edits[0].by).toBe('李四');
    expect(r.edits[0].changes.join('')).toContain('明细：尿素10斤 → 尿素20斤');
    expect(r.edits[0].changes.join('')).toContain('日期：2026-09-20 → 2026-09-19');
  });

  it('没改内容不留痕', () => {
    const plot = addPlot({ name: '东头地' });
    const { record } = addRecord({ plotId: plot.id, date: '2026-09-20', type: '施肥', detail: '尿素10斤' }, '张三');
    updateRecord(record.id, { detail: '尿素10斤' }, '李四');
    expect(getRecords(plot.id)[0].edits).toHaveLength(0);
  });

  it('改完后与另一条撞车要合并', () => {
    const plot = addPlot({ name: '东头地' });
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '施肥', detail: '尿素' }, '张三');
    const { record } = addRecord({ plotId: plot.id, date: '2026-09-21', type: '施肥', detail: '复合肥' }, '张三');
    updateRecord(record.id, { date: '2026-09-20' }, '张三');
    const records = getRecords(plot.id);
    expect(records).toHaveLength(1);
    expect(records[0].detail).toContain('尿素');
    expect(records[0].detail).toContain('复合肥');
    expect(records[0].mergedCount).toBe(1);
  });

  it('地块转手后历史还在，但不能再记新的', () => {
    const plot = addPlot({ name: '东头地' });
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '播种', detail: '冬小麦' }, '张三');
    transferPlot(plot.id, '转给王五');
    expect(getPlot(plot.id)?.status).toBe('transferred');
    expect(getRecords(plot.id)).toHaveLength(1); // 历史保留
    expect(() => addRecord({ plotId: plot.id, date: '2026-09-21', type: '施肥' }, '张三')).toThrow('转手');
    // 已转手的不在活动地块列表里
    expect(getPlots().filter(p => p.status === 'active')).toHaveLength(0);
  });

  it('能算出上次施肥到现在隔了几天', () => {
    const plot = addPlot({ name: '东头地' });
    addRecord({ plotId: plot.id, date: '2026-09-10', type: '施肥' }, '张三');
    addRecord({ plotId: plot.id, date: '2026-09-15', type: '施肥' }, '张三');
    addRecord({ plotId: plot.id, date: '2026-09-18', type: '浇水' }, '张三');
    const stats = getPlotActivityStats(plot.id, '2026-09-20');
    const fei = stats.find(s => s.type === '施肥');
    const jiao = stats.find(s => s.type === '浇水');
    expect(fei?.daysAgo).toBe(5);
    expect(fei?.lastDate).toBe('2026-09-15');
    expect(jiao?.daysAgo).toBe(2);
    expect(stats.find(s => s.type === '打药')).toBeUndefined();
  });

  it('按作物把同一块地的农事过程串起来', () => {
    const plot = addPlot({ name: '东头地', crop: '玉米' });
    addRecord({ plotId: plot.id, date: '2026-06-01', type: '播种' }, '张三');
    addRecord({ plotId: plot.id, date: '2026-07-01', type: '施肥' }, '张三');
    setPlotCrop(plot.id, '小麦'); // 换茬
    addRecord({ plotId: plot.id, date: '2026-09-20', type: '播种' }, '张三');
    const groups = getRecordsByCrop(plot.id);
    expect(groups).toHaveLength(2);
    expect(groups[0].crop).toBe('小麦'); // 最新的在前
    expect(groups[0].records).toHaveLength(1);
    expect(groups[1].crop).toBe('玉米');
    expect(groups[1].records).toHaveLength(2);
  });
});

describe('节气提醒', () => {
  it('任务能对应到农事类型', () => {
    expect(matchTaskType('播种春玉米')).toBe('播种');
    expect(matchTaskType('麦田追肥')).toBe('施肥');
    expect(matchTaskType('防治蚜虫')).toBe('打药');
    expect(matchTaskType('小麦灌溉')).toBe('浇水');
    expect(matchTaskType('检修农具')).toBeNull();
  });

  it('明细里提到了也算干过', () => {
    const plot = addPlot({ name: '东头地' });
    const { record } = addRecord({ plotId: plot.id, date: '2026-09-20', type: '其他', detail: '检修农具' }, '张三');
    expect(recordCoversTask(record, '检修农具')).toBe(true);
    expect(recordCoversTask(record, '果树修剪')).toBe(false);
  });

  it('节气区间包含今天且首尾相接', () => {
    const today = new Date(2026, 8, 20); // 2026-09-20
    const w = getCurrentTermWindow(today);
    expect(w.term).toBeTruthy();
    expect(w.start <= '2026-09-20').toBe(true);
    expect(w.end > '2026-09-20').toBe(true);
  });

  it('一直没记的活要挑出来提醒，记了就不再提醒', () => {
    const plot = addPlot({ name: '东头地' });
    const today = new Date(2026, 8, 20);
    const before = getPendingReminders(today);
    const mine = before.reminders.find(r => r.plotId === plot.id);
    expect(mine).toBeDefined();
    expect(mine!.pendingTasks.length).toBeGreaterThan(0);

    // 把其中一项记上（窗口内的日期）
    const task = mine!.pendingTasks[0];
    const type = matchTaskType(task) ?? '其他';
    addRecord({ plotId: plot.id, date: formatDate(2026, 9, 20), type, detail: type === '其他' ? task : '' }, '张三');

    const after = getPendingReminders(today);
    const still = after.reminders.find(r => r.plotId === plot.id)?.pendingTasks ?? [];
    expect(still).not.toContain(task);
    expect(still.length).toBe(mine!.pendingTasks.length - 1);
  });

  it('节气开始前记的不算数', () => {
    const plot = addPlot({ name: '东头地' });
    const today = new Date(2026, 8, 20);
    const w = getCurrentTermWindow(today);
    // 挑一项本节气该干的活，但在节气开始之前很久就记了
    const task = getPendingReminders(today).reminders.find(r => r.plotId === plot.id)!.pendingTasks[0];
    const type = matchTaskType(task) ?? '其他';
    addRecord({ plotId: plot.id, date: '2026-01-05', type, detail: type === '其他' ? task : '' }, '张三');
    expect(w.start > '2026-01-05').toBe(true);
    // 本节气窗口内没有记录，这项活仍应被挑出来
    const mine = getPendingReminders(today).reminders.find(r => r.plotId === plot.id);
    expect(mine!.pendingTasks).toContain(task);
  });

  it('已转手的地块不再提醒', () => {
    const plot = addPlot({ name: '东头地' });
    transferPlot(plot.id, '转了');
    const res = getPendingReminders(new Date(2026, 8, 20));
    expect(res.reminders.find(r => r.plotId === plot.id)).toBeUndefined();
  });
});
