// ============================================================
// 第五階段：每日紀錄與資料保存
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
const OTHER = { key: 'other', name: '其他（不在清單內）', icon: '📦' };

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const WK = ['日', '一', '二', '三', '四', '五', '六'];

// 支援算式輸入，例如 "1250-1100"；不合法回傳 null
function evalExpr(str) {
  const s = String(str).replace(/[,，\s]/g, '');
  if (s === '') return 0;
  if (!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)*$/.test(s)) return null;
  const v = s.match(/[+-]?\d+(\.\d+)?/g).reduce((a, p) => a + parseFloat(p), 0);
  return v < 0 ? null : Math.round(v * 100) / 100;
}

// ---- 取得「現在」的所有計算結果 ----
function getContext() {
  const now = new Date();
  const cyc = calcCycle(now.getFullYear(), now.getMonth(), now.getDate(), store.settings.resetDay);
  const startStr = isoOf(cyc.start);
  const nextStr = isoOf(cyc.next);
  const todayISO = isoOf(cyc.today);
  const usedToday = dayTotal(getDay(todayISO));
  const remaining = remainingMB(startStr, nextStr);
  const q = calcQuota(remaining, usedToday, cyc.daysLeft);
  return { now, cyc, startStr, nextStr, todayISO, usedToday, remaining, q };
}

function persist() {
  if (!saveStore()) {
    $('warning-list').innerHTML =
      '<div class="banner red">⚠️ 無法儲存資料（儲存空間被封鎖或已滿），重新開啟後資料可能遺失。</div>';
    return false;
  }
  return true;
}

function barClass(ratio) {
  if (ratio > 1) return 'over';
  if (ratio > 0.85) return 'warn';
  return '';
}
const fd = t => { const d = new Date(t); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

// ---- 首頁 ----
function renderHome(c) {
  const monthly = store.settings.monthlyMB;
  const usedMonth = Math.max(0, monthly - c.remaining);
  const monthUsedRatio = usedMonth / monthly;
  const planRatio = (c.cyc.elapsedDays + 1) / c.cyc.cycleDays;
  const todayRatio = c.q.quota > 0 ? c.usedToday / c.q.quota : (c.usedToday > 0 ? 2 : 0);

  $('today-text').textContent =
    `${c.now.getMonth() + 1} 月 ${c.now.getDate()} 日 星期${WK[c.now.getDay()]}`;

  $('remaining-mb').textContent = fmt(Math.max(0, c.remaining));
  $('remaining-mb').parentElement.classList.toggle('over', c.remaining <= 0);
  $('month-bar').style.width = Math.min(monthUsedRatio * 100, 100) + '%';
  $('month-bar').className = 'bar-fill ' +
    (monthUsedRatio > planRatio ? 'over' : (monthUsedRatio > planRatio - 0.05 ? 'warn' : ''));
  $('month-used-text').textContent = `已用 ${fmt(usedMonth)} MB`;
  $('month-total-text').textContent = `共 ${fmt(monthly)} MB`;
  $('cycle-text').textContent = `本期：${fd(c.cyc.start)} – ${fd(c.cyc.next - 86400000)}`;

  $('quota-mb').textContent = fmt(c.q.quota);
  $('used-today').textContent = fmt(c.usedToday);
  $('left-today').textContent = (c.q.leftToday < 0 ? '-' : '') + fmt(Math.abs(c.q.leftToday));
  $('today-bar').style.width = Math.min(todayRatio * 100, 100) + '%';
  $('today-bar').className = 'bar-fill ' + barClass(todayRatio);
  $('used-today').classList.toggle('over', todayRatio > 1);
  $('left-today').classList.toggle('over', c.q.leftToday < 0);

  $('days-left').textContent = c.cyc.daysLeft;
  $('reset-date-text').textContent = `${fd(c.cyc.next)} 重置`;

  const warnings = [];
  if (todayRatio > 1) {
    warnings.push({ cls: 'red', text: `⚠️ 今日已超過動態額度 ${fmt(c.usedToday - c.q.quota)} MB，明天起每日額度會自動降低。` });
  }
  if (monthUsedRatio > planRatio) {
    warnings.push({ cls: 'orange', text: `📉 整體用量進度（${Math.round(monthUsedRatio * 100)}%）超過週期進度（${Math.round(planRatio * 100)}%），請留意用量。` });
  }
  if (c.remaining <= 0) {
    warnings.push({ cls: 'red', text: '🚫 本期流量已用完。' });
  }
  $('warning-list').innerHTML = warnings.map(w => `<div class="banner ${w.cls}">${w.text}</div>`).join('');
}

// App 輸入列：只建立一次，之後只更新數值，避免輸入到一半被重畫
function buildAppList() {
  $('app-list').innerHTML = APPS.concat([OTHER]).map(a => `
    <li>
      <span class="app-ico">${a.icon}</span>
      <span class="app-name">${a.name}</span>
      <input class="app-input" type="text" inputmode="decimal" placeholder="0"
             data-key="${a.key || a.name}" autocomplete="off"><small class="mb">MB</small>
    </li>`).join('');
}

function syncAppInputs(c) {
  const day = getDay(c.todayISO);
  document.querySelectorAll('.app-input').forEach(inp => {
    if (document.activeElement === inp) return;
    const k = inp.dataset.key;
    const v = k === 'other' ? day.other : (day.apps[k] || 0);
    inp.value = v > 0 ? v : '';
    inp.classList.remove('bad');
  });
}

$('app-list').addEventListener('change', e => {
  const inp = e.target;
  if (!inp.classList.contains('app-input')) return;
  const v = evalExpr(inp.value);
  if (v === null) { inp.classList.add('bad'); return; }
  inp.classList.remove('bad');
  const c = getContext();
  setUsage(c.todayISO, inp.dataset.key, v);
  inp.value = v > 0 ? v : '';          // 把算式換成算出來的結果
  const c2 = getContext();
  setQuotaSnapshot(c2.todayISO, c2.q.quota);
  persist();
  renderAll(true);
});

// ---- 紀錄頁 ----
function renderHistory(c) {
  const days = daysInCycle(c.startStr, c.nextStr);
  const used = cycleUsed(c.startStr, c.nextStr);
  $('h-used').textContent = fmt(used);
  $('h-avg').textContent = fmt(used / (c.cyc.elapsedDays + 1));
  const opening = store.opening[c.startStr] || 0;
  $('h-opening').textContent = opening
    ? `其中 ${fmt(opening)} MB 為「開始記錄前已用／校正」，不屬於任何一天。`
    : '';

  // 各 App 合計
  const sums = {};
  let other = 0;
  days.forEach(d => {
    const r = store.days[d];
    Object.keys(r.apps).forEach(n => { sums[n] = (sums[n] || 0) + r.apps[n]; });
    other += r.other;
  });
  $('h-apps').innerHTML = APPS.map(a => `
    <li><span class="app-ico">${a.icon}</span><span class="app-name">${a.name}</span>
    <span class="app-mb">${fmt(sums[a.name] || 0)}<small>MB</small></span></li>`).join('') +
    `<li><span class="app-ico">${OTHER.icon}</span><span class="app-name">其他</span>
    <span class="app-mb">${fmt(other)}<small>MB</small></span></li>`;

  // 每日
  if (days.length === 0) {
    $('h-days').innerHTML = '<li class="muted small">本期還沒有記錄。到首頁輸入今日各 App 流量就會出現在這裡。</li>';
    return;
  }
  $('h-days').innerHTML = days.slice().reverse().map(d => {
    const r = store.days[d];
    const total = dayTotal(r);
    const dt = new Date(d + 'T00:00:00Z');
    const over = r.quota > 0 && total > r.quota;
    const top = Object.keys(r.apps).sort((a, b) => r.apps[b] - r.apps[a]).slice(0, 2)
      .map(n => `${n} ${fmt(r.apps[n])}`).join('、');
    return `<li class="hist-row">
      <div>
        <div class="hist-date">${dt.getUTCMonth() + 1}/${dt.getUTCDate()} 週${WK[dt.getUTCDay()]}</div>
        <div class="hist-sub">${top || '—'}</div>
      </div>
      <div class="hist-num ${over ? 'over' : ''}">
        ${fmt(total)} MB
        <div class="hist-sub">額度 ${r.quota ? fmt(r.quota) : '—'}${over ? '・超額 ' + fmt(total - r.quota) : ''}</div>
      </div>
    </li>`;
  }).join('');
}

// ---- 設定頁 ----
function renderPreview(c) {
  $('set-preview').textContent =
    `以今天為準：剩餘 ${c.cyc.daysLeft} 天，今日額度約 ${fmt(c.q.quota)} MB（${fmt(c.q.startOfDay)} ÷ ${c.cyc.daysLeft}）`;
}

function fillForm(c) {
  if (['in-monthly', 'in-reset', 'in-remaining'].some(id => document.activeElement === $(id))) return;
  $('in-monthly').value = store.settings.monthlyMB;
  $('in-reset').value = store.settings.resetDay;
  $('in-remaining').value = Math.round(c.remaining * 100) / 100;
}

$('save-btn').addEventListener('click', () => {
  const monthly = parseFloat($('in-monthly').value);
  const reset = parseInt($('in-reset').value, 10);
  const remText = $('in-remaining').value.trim();
  const remaining = parseFloat(remText);
  const msg = $('save-msg');

  if (!(monthly > 0)) { msg.textContent = '❌ 每月流量必須大於 0'; return; }
  if (!(reset >= 1 && reset <= 31)) { msg.textContent = '❌ 重置日必須是 1～31'; return; }
  if (remText !== '' && (isNaN(remaining) || remaining < 0)) { msg.textContent = '❌ 剩餘流量不可為負數'; return; }
  if (remText !== '' && remaining > monthly) { msg.textContent = '❌ 剩餘流量不可超過每月流量'; return; }

  store.settings.monthlyMB = monthly;
  store.settings.resetDay = reset;
  if (remText !== '') {
    const c = getContext();           // 用新的重置日重新計算週期
    calibrate(c.startStr, c.nextStr, remaining);
  }
  const c2 = getContext();
  setQuotaSnapshot(c2.todayISO, c2.q.quota);
  persist();
  renderAll();
  msg.textContent = '✅ 已儲存';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});

// ---- 備份 / 還原 ----
$('export-btn').addEventListener('click', () => {
  const text = JSON.stringify(store);
  $('backup-text').value = text;
  $('backup-text').select();
  const m = $('backup-msg');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => { m.textContent = '✅ 已複製，請貼到備忘錄保存'; },
      () => { m.textContent = '請長按上方文字全選並拷貝，貼到備忘錄保存'; });
  } else {
    m.textContent = '請長按上方文字全選並拷貝，貼到備忘錄保存';
  }
});

$('import-btn').addEventListener('click', () => {
  const m = $('backup-msg');
  let obj;
  try { obj = JSON.parse($('backup-text').value); } catch (e) { obj = null; }
  if (!obj || typeof obj !== 'object' || !obj.settings || !obj.days) {
    m.textContent = '❌ 備份文字格式不正確'; return;
  }
  if (!confirm('還原會覆蓋目前所有資料，確定嗎？')) return;
  store = normalizeStore(obj);
  persist();
  renderAll();
  fillForm(getContext());
  m.textContent = '✅ 已還原';
});

// ---- 整體重繪 ----
function renderAll(skipForm) {
  const c = getContext();
  // 今天已有紀錄時，同步更新當天額度快照（額度會隨校正而變動）
  if (store.days[c.todayISO]) setQuotaSnapshot(c.todayISO, c.q.quota);
  renderHome(c);
  syncAppInputs(c);
  renderHistory(c);
  renderPreview(c);
  if (!skipForm) fillForm(c);
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

// 回到 App 時重新計算（跨日會自動換成新的一天）
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderAll();
});

// ---- 啟動 ----
function migrateFromPhase4() {
  // 第四階段用 fg_settings / fg_today 暫存；轉成新格式一次即可
  try {
    const old = JSON.parse(localStorage.getItem('fg_settings'));
    if (!old) return;
    if (old.monthlyMB > 0) store.settings.monthlyMB = old.monthlyMB;
    if (old.resetDay >= 1 && old.resetDay <= 31) store.settings.resetDay = old.resetDay;
    const c = getContext();
    const t = JSON.parse(localStorage.getItem('fg_today'));
    if (t && t.date === c.todayISO && t.used > 0) setUsage(c.todayISO, 'other', t.used);
    // 先記今日用量，再把剩餘流量校正成舊資料的數字
    if (typeof old.remainingMB === 'number') calibrate(c.startStr, c.nextStr, old.remainingMB);
  } catch (e) {}
}

if (!loadStore()) {
  migrateFromPhase4();
  saveStore();
}
// 請瀏覽器盡量不要自動清除這份資料
if (navigator.storage && navigator.storage.persist) { navigator.storage.persist(); }

buildAppList();
renderAll();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}