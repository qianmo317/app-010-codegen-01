// 农事账本领域模型

// 农事类型：播种 / 施肥 / 打药 / 浇水 等
export type WorkKind = 'sowing' | 'fertilizing' | 'pesticide' | 'irrigation' | 'other';

export const WORK_KINDS: Array<{ value: WorkKind; label: string }> = [
  { value: 'sowing', label: '播种' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'pesticide', label: '打药' },
  { value: 'irrigation', label: '浇水' },
  { value: 'other', label: '其他' },
];

export function workKindLabel(kind: WorkKind): string {
  return WORK_KINDS.find(k => k.value === kind)?.label ?? '其他';
}

// 一次农事记录（同一天、同一块地、同一类型的重复登记会合并到同一条）
export interface WorkLog {
  id: string;
  plotId: string;
  crop: string;          // 作物：按作物把同一块地的农事串成一茬
  kind: WorkKind;
  date: string;          // YYYY-MM-DD
  detail: string;        // 施的什么肥 / 打的什么药 / 备注
  amount: string;        // 打了多少药、浇了多少水（数量+单位，自由文本）
  count: number;         // 当天合并后的遍数（浇水记几次、同活重复登记累加）
  createdAt: number;
  createdBy: string;
  updatedAt: number;
}

// 修改痕迹：谁、什么时候、把哪个字段从什么改成什么
export interface ChangeEntry {
  id: string;
  logId: string;
  at: number;
  by: string;
  action: 'create' | 'update' | 'merge' | 'delete';
  changes: Array<{ field: string; label: string; from: string; to: string }>;
}

// 地块
export interface Plot {
  id: string;
  name: string;          // 地块名，如「村东三亩地」
  crop: string;          // 当前茬口作物
  active: boolean;       // false = 已转手：历史留着，但不再添新记录
  owner: string;         // 当前经手人
  transferredAt?: number;
  createdAt: number;
}

export interface FarmState {
  plots: Plot[];
  logs: WorkLog[];
  history: ChangeEntry[];
  user: string;          // 当前记账人（记到 createdBy / by 里）
}
