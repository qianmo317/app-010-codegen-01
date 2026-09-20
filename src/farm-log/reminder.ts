import { SOLAR_TERMS } from '../almanac/constants';
import { getSolarTermDates } from '../almanac/lunar';
import { getFarmTip } from '../almanac/farm';
import { daysBetween, formatDate } from '../utils/date';
import type { FarmLogStore } from './store';
import type { Plot, WorkKind, WorkLog } from './types';

export interface ActiveTerm {
  name: string;
  start: string; // 节气交节日期 YYYY-MM-DD
}

export interface PendingTask {
  plot: Plot;
  crop: string;
  term: string;
  termStart: string;
  task: string;
  kind: WorkKind | null;
  keywords: string[];
  daysSinceTerm: number; // 节气开始到今天隔了几天（越久越该提醒）
  matchedLog?: WorkLog;
}

// 找到 today 所处的节气（上一个已交节的节气）
export function getActiveTerm(today: Date): ActiveTerm {
  const year = today.getFullYear();
  const candidates: Array<{ name: string; date: Date }> = [];
  for (const y of [year - 1, year, year + 1]) {
    const days = getSolarTermDates(y);
    SOLAR_TERMS.forEach((name, i) => {
      candidates.push({ name, date: new Date(y, Math.floor(i / 2), days[i]) });
    });
  }
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  let current = candidates[0];
  for (const c of candidates) {
    if (c.date.getTime() <= today.getTime()) current = c;
    else break;
  }
  return { name: current.name, start: formatDate(current.date.getFullYear(), current.date.getMonth() + 1, current.date.getDate()) };
}

// 节气农活 → 农活类型 + 关键字（用于判断记没记过）
interface TaskRule {
  kind: WorkKind | null;
  keywords: string[];
}

const TASK_RULES: Array<{ test: RegExp; rule: TaskRule }> = [
  { test: /播种|育秧|插秧|移栽|定植|育苗|播种/, rule: { kind: 'sowing', keywords: ['播', '秧', '栽'] } },
  { test: /追肥|施肥|积肥|造肥/, rule: { kind: 'fertilizing', keywords: ['肥'] } },
  { test: /防治|防虫|防病|治虫|打药/, rule: { kind: 'pesticide', keywords: ['防', '治', '药'] } },
  { test: /灌溉|浇水|冬灌|抗旱|灌水/, rule: { kind: 'irrigation', keywords: ['灌', '浇', '水'] } },
  {
    test: /收获|收割|采收|抢收|采摘|收割|收割/,
    rule: { kind: 'other', keywords: ['收', '割', '采'] },
  },
  { test: /修剪|整枝|打顶|疏果|涂白|嫁接|镇压|培土|中耕|耘田|定苗|间苗|管理/, rule: { kind: 'other', keywords: ['剪', '枝', '顶', '果', '白', '接', '压', '土', '耘', '苗', '管'] } },
];

export function classifyTask(task: string): TaskRule {
  for (const { test, rule } of TASK_RULES) {
    if (test.test(task)) return rule;
  }
  // 检修农具、准备春耕 等准备类工作
  if (/检修|修理|准备|贮藏|防寒|保温|增温|遮阴|防暑|防洪|排涝/.test(task)) {
    return { kind: 'other', keywords: [] };
  }
  return { kind: null, keywords: [] };
}

function logMatches(log: WorkLog, rule: TaskRule): boolean {
  if (rule.kind === null) return false; // 无法归类的农活不做自动判断
  if (log.kind !== rule.kind) return false;
  // 播种/施肥/打药/浇水按类型即可认定；
  // 「其他」类（收割、修剪等）需要明细里碰得到关键字，避免张冠李戴
  if (rule.kind !== 'other') return true;
  if (rule.keywords.length === 0) return true;
  const haystack = `${log.detail} ${log.amount}`;
  return rule.keywords.some(k => haystack.includes(k));
}

// 把节气里该干、但这阵子一直没记的活挑出来
export function getPendingTasks(store: FarmLogStore, today: Date = new Date()): PendingTask[] {
  const term = getActiveTerm(today);
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const tip = getFarmTip(term.name);
  if (!tip) return [];

  const daysSinceTerm = daysBetween(
    ...parseYMD(term.start),
    today.getFullYear(), today.getMonth() + 1, today.getDate(),
  );

  const result: PendingTask[] = [];
  for (const plot of store.state.plots.filter(p => p.active)) {
    for (const task of tip.tasks) {
      const rule = classifyTask(task);
      if (rule.kind === null) continue;

      const logs = store
        .timeline(plot.id, plot.crop)
        .filter(l => l.date >= term.start && l.date <= todayStr);
      const matched = logs.find(l => logMatches(l, rule));

      if (!matched) {
        result.push({
          plot,
          crop: plot.crop,
          term: term.name,
          termStart: term.start,
          task,
          kind: rule.kind,
          keywords: rule.keywords,
          daysSinceTerm,
        });
      }
    }
  }
  return result;
}

function parseYMD(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}
