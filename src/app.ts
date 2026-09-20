import { router } from './router';
import { renderCalendar } from './pages/calendar';
import { renderDayDetail } from './pages/day-detail';
import { renderPick } from './pages/pick';
import { renderFarm } from './pages/farm';
import { renderLedger } from './pages/ledger';

export function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // 全局样式注入
  injectStyles();

  // 路由处理
  router.onChange((route) => {
    switch (route.path) {
      case '/':
        renderCalendar(app);
        break;
      case '/day':
        if (route.params?.date) {
          renderDayDetail(app, route.params.date);
        } else {
          renderCalendar(app);
        }
        break;
      case '/pick':
        renderPick(app);
        break;
      case '/farm':
        renderFarm(app);
        break;
      case '/ledger':
        renderLedger(app);
        break;
      default:
        renderCalendar(app);
    }
  });

  router.init();
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 基础样式 */
    :root {
      --bg: #f5f0e8;
      --card-bg: #faf8f3;
      --primary: #8b2500;
      --primary-light: #a84a20;
      --secondary: #2c5f2d;
      --accent: #c41e3a;
      --text: #333;
      --text-light: #666;
      --border: #e0d5c5;
      --shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
      min-height: 100vh;
    }

    /* 头部 */
    .page-header, .calendar-header, .detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--primary);
    }

    .page-title {
      font-size: 24px;
      color: var(--primary);
      flex: 1;
    }

    .back-btn, .nav-btn {
      padding: 8px 16px;
      border: 1px solid var(--primary);
      background: transparent;
      color: var(--primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .back-btn:hover, .nav-btn:hover {
      background: var(--primary);
      color: white;
    }

    /* 日历页 */
    .month-nav {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .month-display {
      font-size: 18px;
      font-weight: bold;
      min-width: 120px;
      text-align: center;
    }

    .quick-nav {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .quick-link {
      padding: 6px 16px;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
    }

    .week-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 8px;
    }

    .week-day {
      text-align: center;
      padding: 8px;
      font-weight: bold;
      color: var(--primary);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .day-cell {
      aspect-ratio: 1;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .day-cell:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow);
    }

    .day-cell.empty {
      background: transparent;
      border: none;
      cursor: default;
    }

    .day-cell.today {
      border-color: var(--accent);
      background: #fff0f0;
    }

    .day-cell.solar-term .lunar-day {
      color: var(--secondary);
      font-weight: bold;
    }

    .solar-day {
      font-size: 16px;
      font-weight: bold;
    }

    .lunar-day {
      font-size: 11px;
      color: var(--text-light);
      margin-top: 2px;
    }

    /* 卡片 */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: var(--shadow);
    }

    .card h3 {
      color: var(--primary);
      margin-bottom: 12px;
      font-size: 16px;
      border-left: 4px solid var(--primary);
      padding-left: 12px;
    }

    /* 农历卡片 */
    .lunar-main {
      text-align: center;
    }

    .lunar-date {
      font-size: 28px;
      color: var(--primary);
      font-weight: bold;
      margin-bottom: 8px;
    }

    .ganzhi {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 8px;
      color: var(--text-light);
    }

    .shengxiao {
      color: var(--accent);
      font-size: 18px;
    }

    .solar-term-badge {
      display: inline-block;
      background: var(--secondary);
      color: white;
      padding: 4px 16px;
      border-radius: 16px;
      margin-top: 8px;
      font-size: 14px;
    }

    /* 宜忌卡片 */
    .yiji-row {
      display: flex;
      gap: 20px;
    }

    .yiji-col {
      flex: 1;
    }

    .yiji-label {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .yiji-col.yi .yiji-label { color: var(--secondary); }
    .yiji-col.ji .yiji-label { color: var(--accent); }

    .yiji-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .yi-tag, .ji-tag {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
    }

    .yi-tag {
      background: #e8f5e9;
      color: var(--secondary);
    }

    .ji-tag {
      background: #ffebee;
      color: var(--accent);
    }

    .yiji-meta {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-light);
    }

    /* 时辰 */
    .hour-table {
      display: grid;
      gap: 4px;
    }

    .hour-row {
      display: grid;
      grid-template-columns: 80px 100px 80px 60px;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      align-items: center;
    }

    .hour-row.吉 { background: #e8f5e9; }
    .hour-row.凶 { background: #ffebee; }
    .hour-row.平 { background: #f5f5f5; }

    .hour-luck {
      font-weight: bold;
      text-align: center;
    }

    .hour-row.吉 .hour-luck { color: var(--secondary); }
    .hour-row.凶 .hour-luck { color: var(--accent); }

    /* 农事 */
    .farm-hou {
      color: var(--text-light);
      font-size: 14px;
      margin-bottom: 12px;
      font-style: italic;
    }

    .farm-tasks {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .task-tag {
      padding: 6px 14px;
      background: #e3f2fd;
      color: #1565c0;
      border-radius: 16px;
      font-size: 13px;
    }

    /* 择日页 */
    .pick-form {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .form-section {
      margin-bottom: 20px;
    }

    .form-section label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      color: var(--primary);
    }

    .events-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .event-btn {
      padding: 10px;
      border: 2px solid var(--border);
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .event-btn:hover {
      border-color: var(--primary);
    }

    .event-btn.selected {
      border-color: var(--primary);
      background: var(--primary);
      color: white;
    }

    .date-range {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .date-range input {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
    }

    .form-section input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }

    .submit-btn:hover {
      background: var(--primary-light);
    }

    /* 结果 */
    .result-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .result-stats span {
      padding: 6px 14px;
      background: var(--card-bg);
      border-radius: 16px;
      font-size: 13px;
    }

    .result-stats .elapsed {
      margin-left: auto;
      color: var(--text-light);
    }

    .result-section {
      margin-bottom: 24px;
    }

    .section-title {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border);
    }

    .section-title.best { color: var(--accent); border-color: var(--accent); }
    .section-title.good { color: var(--secondary); border-color: var(--secondary); }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }

    .result-card {
      background: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .result-card:hover {
      box-shadow: var(--shadow);
      border-color: var(--primary);
    }

    .result-card.score-4 { border-color: var(--accent); background: #fff0f0; }
    .result-card.score-3 { border-color: var(--secondary); background: #f0f8f0; }

    .result-date {
      font-weight: bold;
      font-size: 14px;
    }

    .result-ganzhi {
      color: var(--text-light);
      font-size: 12px;
    }

    .result-score {
      font-size: 20px;
      font-weight: bold;
      color: var(--primary);
    }

    .result-reason {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }

    .result-yi {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .result-yi span {
      padding: 2px 6px;
      background: #e8f5e9;
      color: var(--secondary);
      border-radius: 4px;
      font-size: 11px;
    }

    .export-btn {
      width: 100%;
      padding: 12px;
      background: var(--secondary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 20px;
    }

    /* 农事页 */
    .month-index {
      display: flex;
      gap: 6px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .month-btn {
      padding: 6px 14px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      cursor: pointer;
      font-size: 13px;
    }

    .month-btn:hover {
      border-color: var(--primary);
      background: var(--primary);
      color: white;
    }

    .term-list {
      display: grid;
      gap: 12px;
    }

    .term-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }

    .term-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .term-name {
      font-size: 18px;
      font-weight: bold;
      color: var(--primary);
    }

    .term-hou {
      font-size: 13px;
      color: var(--text-light);
    }

    .term-tasks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    /* 二十八宿 */
    .xiu-name {
      font-size: 20px;
      color: var(--primary);
      text-align: center;
    }

    /* 彭祖百忌 */
    .pengzu-item {
      padding: 8px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 14px;
    }

    .pengzu-item:last-child {
      border-bottom: none;
    }

    /* 响应式 */
    @media (max-width: 600px) {
      .page { padding: 8px; }
      .page-title { font-size: 20px; }
      .events-grid { grid-template-columns: repeat(3, 1fr); }
      .result-grid { grid-template-columns: repeat(2, 1fr); }
      .yiji-row { flex-direction: column; }
      .hour-row { grid-template-columns: 60px 80px 60px 50px; font-size: 13px; }
      .ganzhi { gap: 8px; font-size: 14px; }
    }

    /* ===== 农事账本 ===== */
    .user-btn {
      padding: 6px 12px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text-light);
      border-radius: 16px;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    .user-btn:hover { border-color: var(--primary); color: var(--primary); }

    .ledger-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .ledger-tab {
      flex: 1;
      padding: 12px;
      border: 2px solid var(--border);
      background: var(--card-bg);
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      color: var(--text-light);
    }
    .ledger-tab.active {
      border-color: var(--primary);
      background: var(--primary);
      color: #fff;
      font-weight: bold;
    }

    .term-now-card h3 { margin-bottom: 6px; }
    .term-now-meta { color: var(--text-light); font-size: 13px; }

    .reminder-list { display: grid; gap: 12px; }
    .reminder-tasks { display: flex; flex-wrap: wrap; gap: 8px; }
    .reminder-tag {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 12px;
      border: 1px solid #f0c987;
      background: #fffaf0;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s;
    }
    .reminder-tag:hover { border-color: var(--primary); box-shadow: var(--shadow); }
    .reminder-tag.late { border-color: var(--accent); background: #fff0f0; }
    .rt-task { font-size: 14px; color: var(--text); }
    .rt-days { font-size: 11px; color: var(--text-light); }
    .rt-late { font-size: 11px; color: var(--accent); font-weight: bold; }

    .ledger-empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-light);
      background: var(--card-bg);
      border: 1px dashed var(--border);
      border-radius: 12px;
    }
    .ledger-empty-ok { color: var(--secondary); border-color: var(--secondary); }
    .ledger-note {
      margin-top: 12px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-light);
      background: #f0ede6;
      border-radius: 8px;
    }

    .add-plot-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .add-plot-form input {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      background: #fff;
    }
    .add-plot-form .submit-btn { grid-column: 1 / -1; }

    .plot-card.transferred { opacity: 0.78; background: #f2efe8; }
    .plot-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .plot-name { font-size: 18px; font-weight: bold; color: var(--primary); }
    .plot-meta { font-size: 13px; color: var(--text-light); margin-top: 2px; }
    .plot-status {
      padding: 3px 12px;
      border-radius: 12px;
      font-size: 12px;
      white-space: nowrap;
    }
    .plot-status.active { background: #e8f5e9; color: var(--secondary); }
    .plot-status.gone { background: #eceff1; color: #607d8b; }

    .plot-actions { display: flex; gap: 8px; margin: 12px 0 4px; flex-wrap: wrap; }
    .nav-btn.warn { color: #a86a00; border-color: #d9a843; }
    .nav-btn.warn:hover { background: #d9a843; color: #fff; }

    .crop-batch {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    }
    .crop-batch-title { font-weight: bold; color: var(--secondary); margin-bottom: 8px; }

    .since-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .since-chip {
      padding: 3px 10px;
      font-size: 12px;
      background: #e3f2fd;
      color: #1565c0;
      border-radius: 12px;
    }
    .since-chip.stale { background: #fff3e0; color: #e65100; }

    .timeline { display: grid; gap: 8px; }
    .log-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      flex-wrap: wrap;
    }
    .kind-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      color: #fff;
      white-space: nowrap;
    }
    .kind-sowing { background: #6a994e; }
    .kind-fertilizing { background: #bc8a2e; }
    .kind-pesticide { background: #8e5a9e; }
    .kind-irrigation { background: #2a7fb8; }
    .kind-other { background: #7a7a7a; }
    .log-main { flex: 1; min-width: 160px; }
    .log-summary { font-size: 14px; }
    .log-sub { font-size: 12px; color: var(--text-light); margin-top: 2px; }
    .log-ops { display: flex; gap: 6px; }
    .link-btn {
      border: none;
      background: none;
      color: var(--primary);
      font-size: 13px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .link-btn:hover { background: #f3e9e2; }
    .link-btn.danger { color: var(--accent); }
    .link-btn.danger:hover { background: #fdeaea; }

    .interval-line {
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-light);
      font-style: italic;
    }

    .history-box {
      flex-basis: 100%;
      border-top: 1px dashed var(--border);
      padding-top: 8px;
      display: grid;
      gap: 6px;
    }
    .history-empty { font-size: 12px; color: var(--text-light); }
    .history-row {
      font-size: 12px;
      padding: 6px 8px;
      background: #faf7f0;
      border-left: 3px solid var(--border);
      border-radius: 4px;
    }
    .history-row.h-create { border-left-color: var(--secondary); }
    .history-row.h-update { border-left-color: var(--primary); }
    .history-row.h-merge { border-left-color: #2a7fb8; }
    .history-row.h-delete { border-left-color: var(--accent); }
    .history-head { color: var(--text-light); }
    .history-change del { color: var(--text-light); }

    /* 浮动按钮 */
    .ledger-fab {
      position: fixed;
      right: 20px;
      bottom: 28px;
      padding: 14px 22px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 28px;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 14px rgba(139, 37, 0, 0.35);
      cursor: pointer;
      z-index: 50;
    }
    .ledger-fab:hover { background: var(--primary-light); }

    /* 弹窗 */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(40, 30, 20, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 100;
    }
    .modal-dialog {
      background: var(--card-bg);
      border-radius: 12px;
      width: 100%;
      max-width: 460px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .modal-head h3 { border: none; padding: 0; color: var(--primary); font-size: 18px; }
    .modal-close {
      border: none;
      background: none;
      font-size: 24px;
      line-height: 1;
      color: var(--text-light);
      cursor: pointer;
    }
    .form-field { margin-bottom: 14px; }
    .form-field label {
      display: block;
      font-size: 13px;
      color: var(--primary);
      font-weight: bold;
      margin-bottom: 6px;
    }
    .form-field input[type="text"],
    .form-field input[type="date"],
    .form-field input[type="number"],
    .form-field select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      background: #fff;
    }
    .kind-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .kind-option {
      flex: 1;
      min-width: 64px;
      padding: 8px 4px;
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .kind-option.selected {
      border-color: var(--primary);
      background: var(--primary);
      color: #fff;
      font-weight: bold;
    }
    .modal-hint {
      font-size: 12px;
      color: var(--text-light);
      background: #f5f0e8;
      padding: 8px 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    /* 轻提示 */
    .ledger-toast {
      position: fixed;
      left: 50%;
      bottom: 90px;
      transform: translateX(-50%) translateY(10px);
      background: rgba(50, 35, 20, 0.92);
      color: #fff;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      max-width: 90vw;
      opacity: 0;
      transition: all 0.25s;
      z-index: 120;
      text-align: center;
    }
    .ledger-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    @media (max-width: 600px) {
      .add-plot-form { grid-template-columns: 1fr; }
      .ledger-fab { right: 12px; bottom: 16px; padding: 12px 18px; }
    }
  `;
  document.head.appendChild(style);
}
