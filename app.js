// ============================================================
// 第三階段：只負責「畫面」，資料是示範用。
// 第四階段會把這裡的示範資料換成真正的動態計算。
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

// ---- 示範資料（第四階段會移除）----
function getDemoState() {
  // 網址加上 ?demo=over 可以預覽「超額」的紅色警告畫面
  const over = new URLSearchParams(location.search).get('demo') === 'over';
  return {
    monthlyMB: 12000,
    remainingMB: over ? 4000 : 9500,
    daysLeft: 19,
    elapsedDays: 12,
    cycleDays: 31,
    usedToday: over ? 620 : 180,
    cycleText: '10/25 – 11/24',
    resetText: '11/25',
    appUsage: over
      ? [260, 150, 90, 20, 30, 50, 20]
      : [80, 40, 20, 5, 10, 20, 5]
  };
}

// ---- 小工具 ----
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');

function barClass(ratio) {
  if (ratio > 1) return 'over';
  if (ratio > 0.85) return 'warn';
  return '';
}

// ---- 畫面渲染 ----
function render(s) {
  const usedMonth = s.monthlyMB - s.remainingMB;
  const monthUsedRatio = usedMonth / s.monthlyMB;
  const planRatio = s.elapsedDays / s.cycleDays;

  // 今日額度（示範：剩餘 ÷ 剩餘天數，第四階段會正式實作）
  const quota = s.remainingMB / s.daysLeft;
  const leftToday = quota - s.usedToday;
  const todayRatio = s.usedToday / quota;

  const d = new Date();
  const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  $('today-text').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${wk}`;

  // 本月
  $('remaining-mb').textContent = fmt(s.remainingMB);
  $('month-bar').style.width = Math.min(monthUsedRatio * 100, 100) + '%';
  $('month-bar').className = 'bar-fill ' + barClass(monthUsedRatio > planRatio ? 1 : 0);
  $('month-used-text').textContent = `已用 ${fmt(usedMonth)} MB`;
  $('month-total-text').textContent = `共 ${fmt(s.monthlyMB)} MB`;
  $('cycle-text').textContent = `本期：${s.cycleText}`;

  // 今日
  $('quota-mb').textContent = fmt(quota);
  $('used-today').textContent = fmt(s.usedToday);
  $('left-today').textContent = (leftToday < 0 ? '-' : '') + fmt(Math.abs(leftToday));
  $('today-bar').style.width = Math.min(todayRatio * 100, 100) + '%';
  $('today-bar').className = 'bar-fill ' + barClass(todayRatio);
  $('used-today').classList.toggle('over', todayRatio > 1);
  $('left-today').classList.toggle('over', leftToday < 0);

  // 重置
  $('days-left').textContent = s.daysLeft;
  $('reset-date-text').textContent = `${s.resetText} 重置`;

  // 各 App
  $('app-list').innerHTML = APPS.map((a, i) => `
    <li>
      <span class="app-ico">${a.icon}</span>
      <span class="app-name">${a.name}</span>
      <span class="app-mb">${fmt(s.appUsage[i])}<small>MB</small></span>
    </li>`).join('');

  // 警告
  const warnings = [];
  if (todayRatio > 1) {
    warnings.push({ cls: 'red', text: `⚠️ 今日已超過動態額度 ${fmt(s.usedToday - quota)} MB，明天起每日額度會自動降低。` });
  }
  if (monthUsedRatio > planRatio) {
    warnings.push({ cls: 'orange', text: `📉 整體用量進度（${Math.round(monthUsedRatio * 100)}%）超過週期進度（${Math.round(planRatio * 100)}%），請留意用量。` });
  }
  $('warning-list').innerHTML = warnings
    .map(w => `<div class="banner ${w.cls}">${w.text}</div>`).join('');
}

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

// ---- 啟動 ----
render(getDemoState());

// ---- Service Worker ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}