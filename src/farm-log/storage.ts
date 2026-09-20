import type { FarmState } from './types';

const STORAGE_KEY = 'farm-log-state-v1';

export function emptyState(): FarmState {
  return { plots: [], logs: [], history: [], user: currentUserGuess() };
}

function currentUserGuess(): string {
  return '庄稼人';
}

// 读取本地账本（纯本地，离线可用）
export function loadState(): FarmState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<FarmState>;
    return {
      plots: parsed.plots ?? [],
      logs: parsed.logs ?? [],
      history: parsed.history ?? [],
      user: parsed.user || currentUserGuess(),
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: FarmState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 生成 id：优先用随机数，老浏览器兜底时间戳
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
