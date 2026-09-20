// 农事记录数据模型

// 农事活动类型
export const ACTIVITY_TYPES = ['播种', '施肥', '打药', '浇水', '除草', '耕地', '收获', '其他'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// 一次修改留下的痕迹
export interface EditEntry {
  at: string;        // 修改时间 'YYYY-MM-DD HH:mm'
  by: string;        // 谁改的
  changes: string[]; // 改了哪里，如 '明细：尿素10斤 → 尿素20斤'
}

// 一条农事记录
export interface FarmRecord {
  id: string;
  plotId: string;
  date: string;         // YYYY-MM-DD
  type: ActivityType;
  crop: string;         // 作物（记录时快照，便于按作物把农事过程串起来）
  detail: string;       // 明细：什么肥、多少药、几次水
  createdBy: string;    // 记录人
  createdAt: string;
  updatedAt: string;
  mergedCount: number;  // 同日同地块同类的活合并进来的条数
  edits: EditEntry[];   // 修改历史
}

// 地块
export interface Plot {
  id: string;
  name: string;
  area: string;         // 面积，如 '3亩'
  crop: string;         // 当前作物
  status: 'active' | 'transferred'; // 转手后历史保留，但不再往里添新记录
  createdAt: string;
  transferredAt?: string;
  transferNote?: string; // 转手说明（转给谁了）
}
