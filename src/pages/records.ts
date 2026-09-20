import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { formatDate } from '../utils/date';
import { ACTIVITY_TYPES, ActivityType, FarmRecord, Plot } from '../farm-log/types';
import {
  addPlot, addRecord, getOperator, getPlotActivityStats, getPlots,
  getRecordsByCrop, setOperator, setPlotCrop, transferPlot, updateRecord
} from '../farm-log/store';
import { getPendingReminders } from '../farm-log/remind';

// 各类活的标记色
const TYPE_COLORS: Record<ActivityType, string> = {
  '播种': '#2c5f2d', '施肥': '#8b2500', '打药': '#c41e3a', '浇水': '#1565c0',
  '除草': '#6a5acd', '耕地': '#795548', '收获': '#e65100', '其他': '#666666'
};

const fmtShort = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

export function renderRecords(app: HTMLElement) {
  clearElement(app);
  app.className = 'page records-page';

  const now = new Date();
  const todayStr = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const refresh = () => renderRecords(app);

  // ── 头部 ──
  const header = createElement('div', 'page-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  header.append(backBtn, createElement('h1', 'page-title', '农事记录'));

  // ── 节气提醒 ──
  const activePlots = getPlots().filter(p => p.status === 'active');
  const transferredPlots = getPlots().filter(p => p.status === 'transferred');
  const reminderInfo = getPendingReminders(now);
  const reminderCard = createElement('div', 'card reminder-card');
  const reminderTitle = createElement('h3', '', `节气提醒 · ${reminderInfo.term}`);
  reminderTitle.appendChild(createElement('span', 'term-range', `${fmtShort(reminderInfo.start)} ~ ${fmtShort(reminderInfo.end)}`));
  reminderCard.appendChild(reminderTitle);
  if (activePlots.length === 0) {
    reminderCard.appendChild(createElement('div', 'reminder-ok', '先添加一块地，节气到了该干啥会在这里提醒'));
  } else if (reminderInfo.reminders.length === 0) {
    reminderCard.appendChild(createElement('div', 'reminder-ok', '✓ 这个节气该干的活都记上了'));
  } else {
    reminderInfo.reminders.forEach(r => {
      const item = createElement('div', 'reminder-item');
      item.append(
        createElement('span', 'reminder-plot', `⚠ ${r.plotName}`),
        createElement('span', 'reminder-tasks', r.pendingTasks.join('、'))
      );
      reminderCard.appendChild(item);
    });
  }

  // ── 记一笔 ──
  const quickCard = createElement('div', 'card quick-add-card');
  quickCard.appendChild(createElement('h3', '', '记一笔'));

  // 新地块表单（默认隐藏，没地块时直接展开）
  const newPlotForm = createElement('div', 'new-plot-form');
  const plotNameInput = document.createElement('input');
  plotNameInput.type = 'text';
  plotNameInput.placeholder = '地块名，如：东头三亩';
  const plotAreaInput = document.createElement('input');
  plotAreaInput.type = 'text';
  plotAreaInput.placeholder = '面积（可选）';
  const plotCropInput = document.createElement('input');
  plotCropInput.type = 'text';
  plotCropInput.placeholder = '当前作物（可选）';
  const savePlotBtn = createElement('button', 'mini-btn primary', '保存地块');
  savePlotBtn.addEventListener('click', () => {
    if (!plotNameInput.value.trim()) {
      alert('给地块起个名');
      return;
    }
    addPlot({ name: plotNameInput.value, area: plotAreaInput.value, crop: plotCropInput.value });
    refresh();
  });
  newPlotForm.append(plotNameInput, plotAreaInput, plotCropInput, savePlotBtn);
  if (activePlots.length > 0) newPlotForm.style.display = 'none';

  // 地块选择行
  const plotRow = createElement('div', 'form-row');
  const plotSelect = document.createElement('select');
  activePlots.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.crop ? `${p.name}（${p.crop}）` : p.name;
    plotSelect.appendChild(opt);
  });
  const newPlotBtn = createElement('button', 'mini-btn', '＋新地块');
  newPlotBtn.addEventListener('click', () => {
    newPlotForm.style.display = newPlotForm.style.display === 'none' ? 'flex' : 'none';
  });
  plotRow.append(plotSelect, newPlotBtn);
  if (activePlots.length === 0) plotRow.style.display = 'none';

  // 日期 + 作物
  const dateCropRow = createElement('div', 'form-row');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = todayStr;
  const cropInput = document.createElement('input');
  cropInput.type = 'text';
  cropInput.placeholder = '作物';
  cropInput.value = activePlots[0]?.crop ?? '';
  plotSelect.addEventListener('change', () => {
    cropInput.value = activePlots.find(p => p.id === plotSelect.value)?.crop ?? '';
  });
  dateCropRow.append(dateInput, cropInput);

  // 农活类型
  const typeGrid = createElement('div', 'type-grid');
  let selectedType: ActivityType | null = null;
  ACTIVITY_TYPES.forEach(t => {
    const btn = createElement('button', 'type-btn', t);
    btn.addEventListener('click', () => {
      selectedType = t;
      typeGrid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    typeGrid.appendChild(btn);
  });

  // 明细 + 记录人
  const detailRow = createElement('div', 'form-row');
  const detailInput = document.createElement('input');
  detailInput.type = 'text';
  detailInput.placeholder = '干了什么、用了多少，如：尿素20斤 / 除草剂半瓶 / 浇了2遍水';
  detailRow.appendChild(detailInput);
  const byRow = createElement('div', 'form-row');
  const byInput = document.createElement('input');
  byInput.type = 'text';
  byInput.placeholder = '谁记的';
  byInput.value = getOperator();
  byRow.appendChild(byInput);

  const submitBtn = createElement('button', 'submit-btn', '保存');
  submitBtn.addEventListener('click', () => {
    if (activePlots.length === 0) {
      alert('先添加一块地');
      return;
    }
    if (!selectedType) {
      alert('选一下干的什么活');
      return;
    }
    if (!dateInput.value) {
      alert('选一下日期');
      return;
    }
    const by = byInput.value.trim() || '家里人';
    setOperator(by);
    try {
      const { merged } = addRecord({
        plotId: plotSelect.value,
        date: dateInput.value,
        type: selectedType,
        crop: cropInput.value,
        detail: detailInput.value
      }, by);
      if (merged) alert('同一天这块地已记过同类的活，已合并成一条');
      refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  });

  quickCard.append(newPlotForm, plotRow, dateCropRow, typeGrid, detailRow, byRow, submitBtn);

  // ── 地块卡片 ──
  const plotCards: HTMLElement[] = [];
  activePlots.forEach(p => plotCards.push(buildPlotCard(p)));

  // ── 已转手（折叠，只读）──
  let transferredSection: HTMLElement | null = null;
  if (transferredPlots.length > 0) {
    transferredSection = createElement('div', 'transferred-section');
    const toggle = createElement('button', 'section-toggle', `已转手的地块（${transferredPlots.length}）▸`);
    const body = createElement('div', 'transferred-body');
    body.style.display = 'none';
    transferredPlots.forEach(p => body.appendChild(buildPlotCard(p)));
    toggle.addEventListener('click', () => {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'block' : 'none';
      toggle.textContent = `已转手的地块（${transferredPlots.length}）${hidden ? '▾' : '▸'}`;
    });
    transferredSection.append(toggle, body);
  }

  app.append(header, reminderCard, quickCard, ...plotCards);
  if (transferredSection) app.appendChild(transferredSection);

  // ── 地块卡片 ──
  function buildPlotCard(plot: Plot): HTMLElement {
    const readOnly = plot.status === 'transferred';
    const card = createElement('div', `card plot-card${readOnly ? ' transferred' : ''}`);

    const head = createElement('div', 'plot-head');
    const nameEl = createElement('div', 'plot-name', plot.name);
    if (plot.area) nameEl.appendChild(createElement('span', 'plot-area', plot.area));
    head.appendChild(nameEl);

    if (readOnly) {
      head.appendChild(createElement('span', 'transfer-badge', '已转手'));
    } else {
      const actions = createElement('div', 'plot-actions');
      const cropBtn = createElement('button', 'mini-btn', '换作物');
      cropBtn.addEventListener('click', () => {
        const crop = prompt('现在种的什么？（旧作物的记录会保留在原处）', plot.crop);
        if (crop !== null) {
          setPlotCrop(plot.id, crop);
          refresh();
        }
      });
      const transferBtn = createElement('button', 'mini-btn danger', '转手');
      transferBtn.addEventListener('click', () => {
        const note = prompt('地块转手给谁了？历史记录会保留，但不能再记新账', '');
        if (note !== null) {
          transferPlot(plot.id, note);
          refresh();
        }
      });
      actions.append(cropBtn, transferBtn);
      head.appendChild(actions);
    }
    card.appendChild(head);

    if (readOnly) {
      const line = createElement('div', 'plot-crop-line');
      line.textContent = `${plot.transferredAt?.slice(0, 10) ?? ''} 转手${plot.transferNote ? `（${plot.transferNote}）` : ''}，历史记录保留如下`;
      card.appendChild(line);
    } else {
      card.appendChild(createElement('div', 'plot-crop-line', `当前作物：${plot.crop || '未设置'}`));
      const stats = getPlotActivityStats(plot.id, todayStr);
      if (stats.length > 0) {
        const statsRow = createElement('div', 'stats-row');
        stats.forEach(s => {
          statsRow.appendChild(createElement('span', 'stat-item',
            `距上次${s.type} ${s.daysAgo === 0 ? '0天（今天）' : `${s.daysAgo}天`}`));
        });
        statsRow.title = stats.map(s => `${s.type}：${s.lastDate}`).join('　');
        card.appendChild(statsRow);
      }
    }

    // 按作物串起农事过程
    const groups = getRecordsByCrop(plot.id);
    if (groups.length === 0) {
      card.appendChild(createElement('div', 'empty-tip', readOnly ? '没有留下记录' : '还没有记录，点上面「记一笔」开始'));
    }
    groups.forEach(g => {
      const groupEl = createElement('div', 'crop-group');
      groupEl.appendChild(createElement('div', 'crop-group-title', `── ${g.crop} ──`));
      g.records.forEach(r => groupEl.appendChild(buildRecordRow(r, readOnly)));
      card.appendChild(groupEl);
    });

    return card;
  }

  // ── 一条记录 ──
  function buildRecordRow(record: FarmRecord, readOnly: boolean): HTMLElement {
    const row = createElement('div', 'record-row');

    const main = createElement('div', 'record-main');
    main.appendChild(createElement('span', 'record-date', record.date.slice(5).replace('-', '/')));
    const typeEl = createElement('span', 'record-type', record.type);
    const color = TYPE_COLORS[record.type] ?? '#666';
    typeEl.style.color = color;
    typeEl.style.borderColor = color;
    main.appendChild(typeEl);
    if (record.detail) main.appendChild(createElement('span', 'record-detail', record.detail));
    if (record.mergedCount > 0) {
      main.appendChild(createElement('span', 'merged-badge', `合并${record.mergedCount + 1}次`));
    }
    row.appendChild(main);

    const meta = createElement('div', 'record-meta');
    meta.appendChild(createElement('span', 'record-by', `${record.createdBy} 记`));
    if (!readOnly) {
      const editBtn = createElement('button', 'link-btn', '改');
      editBtn.addEventListener('click', () => row.replaceWith(buildEditRow(record)));
      meta.appendChild(editBtn);
    }
    row.appendChild(meta);

    // 修改历史（默认收起）
    if (record.edits.length > 0) {
      const toggleBtn = createElement('button', 'link-btn', `改动${record.edits.length}次`);
      meta.appendChild(toggleBtn);
      const history = createElement('div', 'edit-history');
      history.style.display = 'none';
      record.edits.forEach(e => {
        history.appendChild(createElement('div', 'edit-item', `${e.by} 于 ${e.at}：${e.changes.join('；')}`));
      });
      toggleBtn.addEventListener('click', () => {
        history.style.display = history.style.display === 'none' ? 'block' : 'none';
      });
      row.appendChild(history);
    }

    return row;
  }

  // ── 改记录（行内表单）──
  function buildEditRow(record: FarmRecord): HTMLElement {
    const row = createElement('div', 'record-row editing');
    const form = createElement('div', 'edit-form');

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = record.date;

    const typeSelect = document.createElement('select');
    ACTIVITY_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === record.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });

    const cropInput = document.createElement('input');
    cropInput.type = 'text';
    cropInput.value = record.crop;
    cropInput.placeholder = '作物';

    const detailInput = document.createElement('input');
    detailInput.type = 'text';
    detailInput.value = record.detail;
    detailInput.placeholder = '明细';

    const byInput = document.createElement('input');
    byInput.type = 'text';
    byInput.value = getOperator();
    byInput.placeholder = '谁改的';

    const btnRow = createElement('div', 'edit-btns');
    const saveBtn = createElement('button', 'mini-btn primary', '保存');
    saveBtn.addEventListener('click', () => {
      if (!dateInput.value) {
        alert('日期不能为空');
        return;
      }
      const by = byInput.value.trim() || '家里人';
      setOperator(by);
      updateRecord(record.id, {
        date: dateInput.value,
        type: typeSelect.value as ActivityType,
        crop: cropInput.value,
        detail: detailInput.value
      }, by);
      refresh();
    });
    const cancelBtn = createElement('button', 'mini-btn', '取消');
    cancelBtn.addEventListener('click', refresh);
    btnRow.append(saveBtn, cancelBtn);

    form.append(dateInput, typeSelect, cropInput, detailInput, byInput, btnRow);
    row.appendChild(form);
    return row;
  }
}
