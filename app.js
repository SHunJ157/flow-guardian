// ============================================================
// 第四階段：真實動態計算
// 注意：各 App 明細、每日紀錄在第五階段才會實作
// ============================================================

const APPS = [
  { name: 'YouTube',   icon: '▶️' },
  { name: 'Instagram', icon: '📷' },
  { name: 'TikTok',    icon: '🎵' },
  { name: 'Threads',   icon: '🧵' },
  { name: 'Discord',   icon: '🎮' },
  { name: 'Safari',    icon: '🧭' },
  { name: 'LINE',      icon: '💬' }
];

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const pad = n => String(n).padStart(2, '0');

// ---- 暫存資料（第五階段會改成完整的紀錄系統）----
const SETTINGS_KEY = 'fg_settings';
const TODAY_KEY = 'fg_today';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadSettings() {
  const def = { monthlyMB: 12000, resetDay: 25, remainingMB: 12000 };
  try {
    return Object.assign(def, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch (e) { return def; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}

// 今日已用：隔天自動歸零
function loadUsedToday() {
  try {
    const t = JSON.parse(localStorage.getItem(TODAY_KEY));
    if (t && t.date === todayStr()) return t.used;
  } catch (e) {}
  return 0;
}
function saveUsedToday(used) {
  try { localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayStr(), used })); } catch (e) {}
}

// ---- 畫面 ----
function barClass(ratio) {
  if (ratio > 1) return 'over';
  if (ratio > 0.85) return 'warn';
  return '';
}

function render() {
  const s = loadSettings();
  const usedToday = loadUsedToday();
  const now = new Date();
  const cyc = calcCycle(now.getFullYear(), now.getMonth(), now.getDate(), s.resetDay);
  const q = calcQuota(s.remainingMB, usedToday, cyc.daysLeft);

  const usedMonth = Math.max(0, s.monthlyMB - s.remainingMB);
  const monthUsedRatio = s.monthlyMB > 0 ? usedMonth / s.monthlyMB : 0;
  // 允許的進度：已過天數 + 今天 ÷ 週期總天數
  const planRatio = (cyc.elapsedDays + 1) / cyc.cycleDays;
  const todayRatio = q.quota > 0 ? usedToday / q.quota : (usedToday > 0 ? 2 : 0);

  const wk = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  $('today-text').textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 星期${wk}`;

  const fd = t => { const d = new Date(t); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
  const lastDay = fd(cyc.next - 86400000);

  // 本月
  $('remaining-mb').textContent = fmt(s.remainingMB);
  $('remaining-mb').parentElement.classList.toggle('over', s.remainingMB <= 0);
  $('month-bar').style.width = Math.min(monthUsedRatio * 100, 100) + '%';
  $('month-bar').className = 'bar-fill ' + (monthUsedRatio > planRatio ? 'over' : (monthUsedRatio > planRatio - 0.05 ? 'warn' : ''));
  $('month-used-text').textContent = `已用 ${fmt(usedMonth)} MB`;
  $('month-total-text').textContent = `共 ${fmt(s.monthlyMB)} MB`;
  $('cycle-text').textContent = `本期：${fd(cyc.start)} – ${lastDay}`;

  // 今日
  $('quota-mb').textContent = fmt(q.quota);
  $('used-today').textContent = fmt(usedToday);
  $('left-today').textContent = (q.leftToday < 0 ? '-' : '') + fmt(Math.abs(q.leftToday));
  $('today-bar').style.width = Math.min(todayRatio * 100, 100) + '%';
  $('today-bar').className = 'bar-fill ' + barClass(todayRatio);
  $('used-today').classList.toggle('over', todayRatio > 1);
  $('left-today').classList.toggle('over', q.leftToday < 0);

  // 重置
  $('days-left').textContent = cyc.daysLeft;
  $('reset-date-text').textContent = `${fd(cyc.next)} 重置`;

  // 各 App（第五階段實作輸入）
  $('app-list').innerHTML = APPS.map(a => `
    <li>
      <span class="app-ico">${a.icon}</span>
      <span class="app-name">${a.name}</span>
      <span class="app-mb">0<small>MB</small></span>
    </li>`).join('');

  // 警告
  const warnings = [];
  if (todayRatio > 1) {
    warnings.push({ cls: 'red', text: `⚠️ 今日已超過動態額度 ${fmt(usedToday - q.quota)} MB，明天起每日額度會自動降低。` });
  }
  if (monthUsedRatio > planRatio) {
    warnings.push({ cls: 'orange', text: `📉 整體用量進度（${Math.round(monthUsedRatio * 100)}%）超過週期進度（${Math.round(planRatio * 100)}%），請留意用量。` });
  }
  if (s.remainingMB <= 0) {
    warnings.push({ cls: 'red', text: '🚫 本期流量已用完。' });
  }
  $('warning-list').innerHTML = warnings
    .map(w => `<div class="banner ${w.cls}">${w.text}</div>`).join('');

  // 設定頁的預覽
  $('set-preview').textContent =
    `以今天為準：剩餘 ${cyc.daysLeft} 天，今日額度約 ${fmt(q.quota)} MB（${fmt(q.startOfDay)} ÷ ${cyc.daysLeft}）`;
}

// ---- 設定頁 ----
function fillForm() {
  const s = loadSettings();
  $('in-monthly').value = s.monthlyMB;
  $('in-reset').value = s.resetDay;
  $('in-remaining').value = s.remainingMB;
  $('in-used').value = loadUsedToday();
}

$('save-btn').addEventListener('click', () => {
  const monthly = parseFloat($('in-monthly').value);
  const reset = parseInt($('in-reset').value, 10);
  const remaining = parseFloat($('in-remaining').value);
  const used = parseFloat($('in-used').value) || 0;
  const msg = $('save-msg');

  if (!(monthly > 0)) { msg.textContent = '❌ 每月流量必須大於 0'; return; }
  if (!(reset >= 1 && reset <= 31)) { msg.textContent = '❌ 重置日必須是 1～31'; return; }
  if (isNaN(remaining) || remaining < 0) { msg.textContent = '❌ 剩餘流量不可為空或負數'; return; }
  if (used < 0) { msg.textContent = '❌ 今日已用不可為負數'; return; }

  saveSettings({ monthlyMB: monthly, resetDay: reset, remainingMB: remaining });
  saveUsedToday(used);
  render();
  msg.textContent = '✅ 已儲存';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});

// ---- 分頁切換 ----
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.page).classList.add('active');
    window.scrollTo(0, 0);
  });
});

// 回到 App 時重新計算（跨日自動更新額度）
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { render(); fillForm(); }
});

// ---- 啟動 ----
fillForm();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}