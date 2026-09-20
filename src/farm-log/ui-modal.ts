import { createElement } from '../utils/dom';
import { WORK_KINDS, type Plot, type WorkKind, type WorkLog } from './types';
import type { EditLogInput, NewLogInput } from './store';

export interface LogFormPrefill extends Partial<NewLogInput> {
  editing?: WorkLog;
}

interface ModalOptions {
  plots: Plot[];
  user: string;
  today: string;
  prefill?: LogFormPrefill;
  onSubmit: (data: NewLogInput | EditLogInput) => void;
}

// 记账 / 改记 弹窗。新建时可选已转手以外的地；编辑时地块不可改（记录属于原地块）
export function logFormModal(opts: ModalOptions): void {
  const editing = opts.prefill?.editing;
  const activePlots = opts.plots.filter(p => p.active);
  const editingPlot = editing ? opts.plots.find(p => p.id === editing.plotId) : undefined;

  const overlay = createElement('div', 'modal-overlay');
  const dialog = createElement('div', 'modal-dialog');

  const head = createElement('div', 'modal-head');
  head.appendChild(createElement('h3', undefined, editing ? '改一笔（留痕）' : '随手记一笔'));
  const closeBtn = createElement('button', 'modal-close', '×');
  head.appendChild(closeBtn);
  dialog.appendChild(head);

  const form = document.createElement('form');
  form.className = 'log-form';

  // 地块
  const plotWrap = field('地块');
  const plotSelect = document.createElement('select');
  plotSelect.name = 'plotId';
  plotSelect.required = true;
  if (editing) {
    const opt = document.createElement('option');
    opt.value = editing!.plotId;
    opt.textContent = editingPlot ? editingPlot.name : '（地块已删除）';
    plotSelect.appendChild(opt);
    plotSelect.disabled = true;
  } else {
    activePlots.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}（${p.crop}）`;
      if (opts.prefill?.plotId === p.id) opt.selected = true;
      plotSelect.appendChild(opt);
    });
  }
  plotWrap.appendChild(plotSelect);

  // 作物
  const cropWrap = field('作物（按茬口串记录）');
  const cropInput = textInput('crop', '如：冬小麦', editing?.crop ?? opts.prefill?.crop ?? activePlots[0]?.crop ?? '');
  cropWrap.appendChild(cropInput);

  // 日期
  const dateWrap = field('日期');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.name = 'date';
  dateInput.required = true;
  dateInput.value = editing?.date ?? opts.prefill?.date ?? opts.today;
  dateWrap.appendChild(dateInput);

  // 农活类型
  const kindWrap = field('干啥活');
  const kindRow = createElement('div', 'kind-row');
  let chosenKind: WorkKind = editing?.kind ?? opts.prefill?.kind ?? 'sowing';
  const kindButtons = WORK_KINDS.map(k => {
    const btn = createElement('button', 'kind-option', k.label) as HTMLButtonElement;
    btn.type = 'button';
    btn.dataset.kind = k.value;
    if (k.value === chosenKind) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      chosenKind = k.value;
      kindButtons.forEach(b => b.classList.toggle('selected', b === btn));
    });
    kindRow.appendChild(btn);
    return btn;
  });
  kindWrap.appendChild(kindRow);

  // 明细
  const detailWrap = field('明细（施的什么肥 / 打的什么药）');
  const detailInput = textInput('detail', '如：尿素 / 吡虫啉', editing?.detail ?? opts.prefill?.detail ?? '');
  detailWrap.appendChild(detailInput);

  // 用量 + 遍数
  const amountWrap = field('用量 / 浇了多少');
  const amountInput = textInput('amount', '如：15公斤 / 2车水 / 一桶', editing?.amount ?? opts.prefill?.amount ?? '');
  amountWrap.appendChild(amountInput);

  const countWrap = field('遍数（同一天同一块地重复登记会自动 +1）');
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.name = 'count';
  countInput.min = '1';
  countInput.max = '20';
  countInput.value = String(editing?.count ?? 1);
  countWrap.appendChild(countInput);

  // 换地块时带出该地块当前作物（用户手动改过之后不再覆盖）
  if (!editing) {
    let cropTouched = Boolean(opts.prefill?.crop);
    cropInput.addEventListener('input', () => { cropTouched = true; });
    plotSelect.addEventListener('change', () => {
      if (cropTouched) return;
      const p = activePlots.find(x => x.id === plotSelect.value);
      if (p) cropInput.value = p.crop;
    });
  }

  const hint = createElement('div', 'modal-hint',
    editing
      ? `以「${opts.user}」的名义修改，改动前后都会记进这条的痕迹里。`
      : `记账人：${opts.user}。同一天、同一块地、同一种活记两遍会自动合并。`,
  );

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'submit-btn';
  submit.textContent = editing ? '保存修改' : '记上';

  form.append(plotWrap, cropWrap, dateWrap, kindWrap, detailWrap, amountWrap, countWrap, hint, submit);
  dialog.appendChild(form);

  function close() {
    overlay.remove();
  }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const crop = cropInput.value.trim();
    const date = dateInput.value;
    if (!crop || !date) return;
    const count = Math.max(1, Math.min(20, Number(countInput.value) || 1));

    if (editing) {
      opts.onSubmit({
        crop,
        date,
        kind: chosenKind,
        detail: detailInput.value.trim(),
        amount: amountInput.value.trim(),
        count,
      } satisfies EditLogInput);
    } else {
      opts.onSubmit({
        plotId: plotSelect.value,
        crop,
        date,
        kind: chosenKind,
        detail: detailInput.value.trim(),
        amount: amountInput.value.trim(),
      } satisfies NewLogInput);
    }
    close();
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function field(label: string): HTMLElement {
  const wrap = createElement('div', 'form-field');
  wrap.appendChild(createElement('label', undefined, label));
  return wrap;
}

function textInput(name: string, placeholder: string, value: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.placeholder = placeholder;
  input.value = value;
  input.maxLength = 50;
  return input;
}
