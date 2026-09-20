import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { FarmLogStore, type EditLogInput, type NewLogInput } from '../farm-log/store';
import { workKindLabel, type WorkLog, type Plot } from '../farm-log/types';
import { getActiveTerm, getPendingTasks, type PendingTask } from '../farm-log/reminder';
import { formatDate } from '../utils/date';
import { logFormModal } from '../farm-log/ui-modal';

type Tab = 'reminders' | 'plots';

export function renderLedger(app: HTMLElement) {
  clearElement(app);
  app.className = 'page ledger-page';
  const store = new FarmLogStore();
  let tab: Tab = 'reminders';

  // 头部
  const header = createElement('div', 'page-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  const title = createElement('h1', 'page-title', '农事账本');
  const userBtn = createElement('button', 'user-btn');
  userBtn.title = '点按修改记账人';
  userBtn.addEventListener('click', () => {
    const name = window.prompt('记账人姓名（修改与合并都会记到这个人名下）', store.user);
    if (name !== null) {
      store.setUser(name);
      userBtn.textContent = `✍ ${store.user}`;
    }
  });
  header.append(backBtn, title, userBtn);

  // 标签栏
  const tabBar = createElement('div', 'ledger-tabs');
  const tabReminders = createElement('button', 'ledger-tab', '节气提醒');
  const tabPlots = createElement('button', 'ledger-tab', '我的地块');
  tabBar.append(tabReminders, tabPlots);

  const body = createElement('div', 'ledger-body');

  function setTab(next: Tab) {
    tab = next;
    tabReminders.classList.toggle('active', tab === 'reminders');
    tabPlots.classList.toggle('active', tab === 'plots');
    renderBody();
    window.scrollTo(0, 0);
  }
  tabReminders.addEventListener('click', () => setTab('reminders'));
  tabPlots.addEventListener('click', () => setTab('plots'));

  // 浮动记账按钮
  const fab = createElement('button', 'ledger-fab', '＋ 记一笔');
  fab.addEventListener('click', () => openLogForm());

  function toast(msg: string) {
    const el = createElement('div', 'ledger-toast', msg);
    app.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  function todayStr(): string {
    const d = new Date();
    return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // 打开记账/改记表单
  function openLogForm(prefill?: Partial<NewLogInput> & { editing?: WorkLog }) {
    const activePlots = store.state.plots.filter(p => p.active);
    if (!prefill?.editing && activePlots.length === 0) {
      toast('还没有地块，先在「我的地块」里添一块地');
      setTab('plots');
      return;
    }
    logFormModal({
      plots: store.state.plots,
      user: store.user,
      today: todayStr(),
      prefill,
      onSubmit(data) {
        if (prefill?.editing) {
          const before = prefill.editing;
          store.editLog(before.id, data as EditLogInput);
          toast('已修改，改动已记入修改痕迹');
        } else {
          const { merged, log } = store.addLog(data as NewLogInput);
          toast(
            merged
              ? `当天同一块地已经记过一遍「${workKindLabel(log.kind)}」，已合并为一条（共 ${log.count} 遍）`
              : '记上了',
          );
        }
        renderBody();
      },
    });
  }

  // ---- 渲染：节气提醒 ----

  function renderReminders(): HTMLElement {
    const wrap = createElement('div', 'tab-panel');
    const today = new Date();
    const term = getActiveTerm(today);
    const pending = getPendingTasks(store, today);

    const termCard = createElement('div', 'card term-now-card');
    termCard.innerHTML = `
      <h3>当前节气 · ${term.name}</h3>
      <div class="term-now-meta">${term.start} 交节 · 下面是这阵子该干还没记的活</div>
    `;
    wrap.appendChild(termCard);

    if (pending.length === 0) {
      const ok = createElement('div', 'ledger-empty ledger-empty-ok',
        store.state.plots.some(p => p.active)
          ? '节气里该干的活都记过了，好把式！'
          : '还没有在种的地块，先去「我的地块」添一块地吧',
      );
      wrap.appendChild(ok);
    } else {
      const list = createElement('div', 'reminder-list');
      // 按地块分组
      const byPlot = new Map<string, PendingTask[]>();
      for (const t of pending) {
        const arr = byPlot.get(t.plot.id) ?? [];
        arr.push(t);
        byPlot.set(t.plot.id, arr);
      }
      for (const [plotId, tasks] of byPlot) {
        const plot = tasks[0].plot;
        const card = createElement('div', 'card reminder-card');
        card.appendChild(createElement('h3', undefined, `${plot.name} · ${plot.crop}`));
        const tags = createElement('div', 'reminder-tasks');
        tasks.forEach(t => {
          const tag = createElement('button', 'reminder-tag');
          const late = t.daysSinceTerm > 5;
          tag.classList.toggle('late', late);
          tag.innerHTML = `<span class="rt-task">${t.task}</span>` +
            (late ? `<span class="rt-late">已过 ${t.daysSinceTerm} 天</span>` : `<span class="rt-days">节气第 ${t.daysSinceTerm + 1} 天</span>`);
          tag.addEventListener('click', () => {
            openLogForm({
              plotId,
              crop: plot.crop,
              kind: t.kind ?? 'other',
              date: todayStr(),
              detail: t.task,
            });
          });
          tags.appendChild(tag);
        });
        card.appendChild(tags);
        list.appendChild(card);
      }
      wrap.appendChild(list);
    }

    const transferred = store.state.plots.filter(p => !p.active);
    if (transferred.length > 0) {
      const note = createElement('div', 'ledger-note',
        `已转手 ${transferred.length} 块地（${transferred.map(p => p.name).join('、')}），历史账本保留，不再提醒也不再添新记录。`);
      wrap.appendChild(note);
    }
    return wrap;
  }

  // ---- 渲染：地块列表与时间线 ----

  function renderPlots(): HTMLElement {
    const wrap = createElement('div', 'tab-panel');

    // 添地块表单
    const addCard = createElement('div', 'card add-plot-card');
    addCard.appendChild(createElement('h3', undefined, '添一块地'));
    const form = document.createElement('form');
    form.className = 'add-plot-form';
    form.innerHTML = `
      <input name="name" type="text" placeholder="地块名，如：村东三亩地" required maxlength="20">
      <input name="crop" type="text" placeholder="这一茬种的啥，如：冬小麦" required maxlength="20">
      <input name="owner" type="text" placeholder="经手人（可空，默认自己）" maxlength="20">
      <button type="submit" class="submit-btn">添地</button>
    `;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') ?? '').trim();
      const crop = String(fd.get('crop') ?? '').trim();
      if (!name || !crop) return;
      store.addPlot(name, crop, String(fd.get('owner') ?? '').trim() || undefined);
      toast(`地块「${name}」已添上`);
      renderBody();
    });
    addCard.appendChild(form);
    wrap.appendChild(addCard);

    if (store.state.plots.length === 0) {
      wrap.appendChild(createElement('div', 'ledger-empty', '还没有地块。先添一块，就能随手记播种、施肥、打药、浇水了。'));
      return wrap;
    }

    for (const plot of store.state.plots) {
      wrap.appendChild(renderPlotCard(plot));
    }
    return wrap;
  }

  function renderPlotCard(plot: Plot): HTMLElement {
    const card = createElement('div', 'card plot-card');
    card.classList.toggle('transferred', !plot.active);

    const head = createElement('div', 'plot-head');
    const headLeft = createElement('div', 'plot-head-left');
    const nameEl = createElement('div', 'plot-name', plot.name);
    const metaEl = createElement('div', 'plot-meta');
    metaEl.innerHTML = plot.active
      ? `这一茬：<b>${plot.crop}</b> · 经手人：${plot.owner}`
      : `最后一茬：<b>${plot.crop}</b> · 已于 ${formatTs(plot.transferredAt)} 转给 ${plot.owner}`;
    headLeft.append(nameEl, metaEl);
    const status = createElement('span', plot.active ? 'plot-status active' : 'plot-status gone',
      plot.active ? '在种' : '已转手');
    head.append(headLeft, status);
    card.appendChild(head);

    // 操作按钮
    const actions = createElement('div', 'plot-actions');
    if (plot.active) {
      const addBtn = createElement('button', 'nav-btn', '＋ 记一笔');
      addBtn.addEventListener('click', () => openLogForm({ plotId: plot.id, crop: plot.crop }));
      const transferBtn = createElement('button', 'nav-btn warn', '地块转手');
      transferBtn.addEventListener('click', () => {
        const to = window.prompt(`「${plot.name}」转给谁？转手后历史记录保留，但不再添新记录`, '');
        if (to !== null && to.trim()) {
          store.transferPlot(plot.id, to.trim());
          toast('已标记转手，旧账都还在');
          renderBody();
        }
      });
      actions.append(addBtn, transferBtn);
    } else {
      const reopenBtn = createElement('button', 'nav-btn', '重新接手（另开新茬）');
      reopenBtn.addEventListener('click', () => {
        const crop = window.prompt(`重新接手「${plot.name}」，新一茬种的啥？`, '');
        if (crop !== null && crop.trim()) {
          store.reopenPlot(plot.id, crop.trim());
          toast('已重新接手，开始记新茬');
          renderBody();
        }
      });
      actions.appendChild(reopenBtn);
    }
    card.appendChild(actions);

    // 按作物（茬口）串农事过程
    for (const batch of store.cropBatches(plot.id)) {
      card.appendChild(renderBatch(plot, batch.crop, batch.logs));
    }
    return card;
  }

  function renderBatch(plot: Plot, crop: string, logs: WorkLog[]): HTMLElement {
    const box = createElement('div', 'crop-batch');
    const batchTitle = createElement('div', 'crop-batch-title', `🌱 ${crop}（${logs.length} 条）`);
    box.appendChild(batchTitle);

    // 距上次各农活的间隔
    const since = plot.active ? store.daysSinceLast(plot.id, crop, todayStr()) : [];
    if (since.length > 0) {
      const strip = createElement('div', 'since-strip');
      since.forEach(s => {
        const chip = createElement('span', 'since-chip' + (s.days > 20 ? ' stale' : ''),
          `${s.label} ${s.days} 天前`);
        chip.title = `${s.label}：${s.date}`;
        strip.appendChild(chip);
      });
      box.appendChild(strip);
    }

    // 时间线
    const tl = createElement('div', 'timeline');
    for (const log of logs) {
      tl.appendChild(renderLogItem(plot, log));
    }
    box.appendChild(tl);

    // 相邻同类农活间隔
    const intervals = store.intervals(plot.id, crop).filter(i => i.days > 0);
    if (intervals.length > 0) {
      const iv = createElement('div', 'interval-line');
      iv.textContent = intervals.map(i => `${i.label}间隔 ${i.days} 天`).join('　·　');
      box.appendChild(iv);
    }
    return box;
  }

  function renderLogItem(plot: Plot, log: WorkLog): HTMLElement {
    const item = createElement('div', 'log-item');
    const kindBadge = createElement('span', `kind-badge kind-${log.kind}`, workKindLabel(log.kind));
    const main = createElement('div', 'log-main');
    const summaryParts = [log.detail, log.amount].filter(Boolean);
    const summary = createElement('div', 'log-summary',
      summaryParts.length > 0 ? summaryParts.join('｜') : '（未填明细）');
    const sub = createElement('div', 'log-sub');
    sub.innerHTML = `${log.date}` +
      (log.count > 1 ? ` · 当天 <b>${log.count}</b> 遍` : '') +
      ` · ${log.createdBy} 记`;
    main.append(summary, sub);

    const ops = createElement('div', 'log-ops');
    if (plot.active) {
      const editBtn = createElement('button', 'link-btn', '改');
      editBtn.title = '记错了？改一改（留痕）';
      editBtn.addEventListener('click', () => openLogForm({ editing: log }));
      ops.appendChild(editBtn);
    }
    const histBtn = createElement('button', 'link-btn', '痕迹');
    histBtn.addEventListener('click', () => toggleHistory(item, log));
    ops.append(histBtn);

    if (plot.active) {
      const delBtn = createElement('button', 'link-btn danger', '删');
      delBtn.addEventListener('click', () => {
        if (window.confirm(`删除 ${log.date} 的「${workKindLabel(log.kind)}」记录？删除也会留痕。`)) {
          store.deleteLog(log.id);
          toast('已删除，删除痕迹保留');
          renderBody();
        }
      });
      ops.appendChild(delBtn);
    }

    item.append(kindBadge, main, ops);
    return item;
  }

  function toggleHistory(item: HTMLElement, log: WorkLog) {
    const existing = item.querySelector('.history-box');
    if (existing) {
      existing.remove();
      return;
    }
    const box = createElement('div', 'history-box');
    const history = store.historyOf(log.id);
    if (history.length === 0) {
      box.appendChild(createElement('div', 'history-empty', '暂无改动'));
    } else {
      history.forEach(h => {
        const row = createElement('div', `history-row h-${h.action}`);
        const head = createElement('div', 'history-head',
          `${ACTION_LABELS[h.action]} · ${h.by} · ${formatTs(h.at)}`);
        row.appendChild(head);
        if (h.changes.length > 0) {
          const list = createElement('div', 'history-changes');
          h.changes.forEach(c => {
            const line = createElement('div', 'history-change');
            if (h.action === 'create') {
              line.textContent = `${c.label}：${c.to || '（空）'}`;
            } else if (h.action === 'delete') {
              line.textContent = `${c.label}：${c.from || '（空）'} → 已删除`;
            } else {
              line.innerHTML = `${c.label}：<del>${c.from}</del> → <b>${c.to}</b>`;
            }
            list.appendChild(line);
          });
          row.appendChild(list);
        }
        box.appendChild(row);
      });
    }
    item.appendChild(box);
  }

  function renderBody() {
    clearElement(body);
    body.appendChild(tab === 'reminders' ? renderReminders() : renderPlots());
  }

  app.append(header, tabBar, body, fab);
  userBtn.textContent = `✍ ${store.user}`;
  setTab(tab);
}

const ACTION_LABELS: Record<string, string> = {
  create: '初次登记',
  update: '修改',
  merge: '当天合并',
  delete: '删除',
};

function formatTs(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
