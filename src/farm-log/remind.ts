// 节气提醒：节气提示里该干的活，这阵子一直没记就挑出来
import { SOLAR_TERMS } from '../almanac/constants';
import { getSolarTermDates } from '../almanac/lunar';
import { getFarmTip } from '../almanac/farm';
import { formatDate, gregorianToJDN } from '../utils/date';
import { ActivityType, FarmRecord } from './types';
import { getPlots, getRecords } from './store';

// 节气任务 → 农事类型 的关键词对照
const TASK_KEYWORDS: Array<{ type: ActivityType; words: string[] }> = [
  { type: '播种', words: ['播种', '育秧', '育苗', '插秧', '移栽', '定植', '定苗'] },
  { type: '施肥', words: ['追肥', '施肥', '积肥', '造肥'] },
  { type: '打药', words: ['防治', '防虫', '防病', '治虫'] },
  { type: '浇水', words: ['灌溉', '浇水', '冬灌', '排涝', '抗旱'] },
  { type: '除草', words: ['除草', '耘田'] },
  { type: '耕地', words: ['春耕', '耕地', '整地', '翻土'] },
  { type: '收获', words: ['收获', '收割', '采收', '采摘', '采制', '抢收', '夏收', '秋收'] }
];

// 任务描述对应哪类活（对不上返回 null）
export function matchTaskType(task: string): ActivityType | null {
  for (const { type, words } of TASK_KEYWORDS) {
    if (words.some(w => task.includes(w))) return type;
  }
  return null;
}

// 从任务描述里提取可用于核对的关键词
export function extractTaskWords(task: string): string[] {
  const words: string[] = [];
  for (const { words: ws } of TASK_KEYWORDS) {
    for (const w of ws) {
      if (task.includes(w)) words.push(w);
    }
  }
  if (words.length === 0) {
    // 没有现成关键词，取末尾两字兜底（多为名词，如「农具」「涂白」）
    words.push(task.slice(-2));
  }
  return words;
}

// 一条记录是否算干了某项活：类型对得上，或明细里提到了
export function recordCoversTask(record: FarmRecord, task: string): boolean {
  const type = matchTaskType(task);
  if (type && record.type === type) return true;
  return extractTaskWords(task).some(w => record.detail.includes(w));
}

// 当前所处的节气区间 [start, end)
export interface TermWindow {
  term: string;
  start: string; // YYYY-MM-DD
  end: string;   // 下一节气开始日
}

export function getCurrentTermWindow(today: Date): TermWindow {
  const y = today.getFullYear();
  const all: Array<{ term: string; jdn: number; date: string }> = [];
  for (let year = y - 1; year <= y + 1; year++) {
    const dates = getSolarTermDates(year);
    for (let i = 0; i < 24; i++) {
      const month = Math.floor(i / 2) + 1;
      all.push({
        term: SOLAR_TERMS[i],
        jdn: gregorianToJDN(year, month, dates[i]),
        date: formatDate(year, month, dates[i])
      });
    }
  }
  all.sort((a, b) => a.jdn - b.jdn);

  const todayJdn = gregorianToJDN(y, today.getMonth() + 1, today.getDate());
  let nextIdx = all.findIndex(t => t.jdn > todayJdn);
  if (nextIdx === -1) nextIdx = all.length;
  const current = all[nextIdx - 1];
  const next = all[nextIdx];
  return { term: current.term, start: current.date, end: next ? next.date : current.date };
}

export interface PlotReminder {
  plotId: string;
  plotName: string;
  pendingTasks: string[]; // 本节气该干还没记的活
}

export interface ReminderResult {
  term: string;
  start: string;
  end: string;
  reminders: PlotReminder[];
}

// 把本节气一直没记的活按地块挑出来（已转手的不参与）
export function getPendingReminders(today: Date): ReminderResult {
  const window = getCurrentTermWindow(today);
  const tip = getFarmTip(window.term);
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const reminders: PlotReminder[] = [];

  if (tip) {
    for (const plot of getPlots()) {
      if (plot.status !== 'active') continue;
      const records = getRecords(plot.id).filter(r => r.date >= window.start && r.date <= todayStr);
      const pendingTasks = tip.tasks.filter(task => !records.some(r => recordCoversTask(r, task)));
      if (pendingTasks.length > 0) {
        reminders.push({ plotId: plot.id, plotName: plot.name, pendingTasks });
      }
    }
  }
  return { term: window.term, start: window.start, end: window.end, reminders };
}
