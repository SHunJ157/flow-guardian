// ============================================================
// 資料儲存：所有資料存在這支手機的 localStorage（key: fg_store_v1）
// 結構：
//   settings : { monthlyMB, resetDay }
//   opening  : { '週期起始日': MB }  開始記錄前已用／校正量
//   days     : { '日期': { apps:{App名:MB}, other:MB, quota:MB } }
// ============================================================
const STORE_KEY = 'fg_store_v1';

function defaultStore() {
  return { version: 1, settings: { monthlyMB: 12000, resetDay: 25 }, opening: {}, days: {} };
}
let store = defaultStore();

const isoOf = ms => new Date(ms).toISOString().slice(0, 10);
const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 把任何來源（舊資料、匯入的備份）整理成合法格式
function normalizeStore(o) {
  const d = defaultStore();
  if (!o || typeof o !== 'object') return d;
  const s = o.settings || {};
  if (num(s.monthlyMB) > 0) d.settings.monthlyMB = num(s.monthlyMB);
  const rd = Math.round(num(s.resetDay));
  if (rd >= 1 && rd <= 31) d.settings.resetDay = rd;
  const op = o.opening || {};
  Object.keys(op).forEach(k => { if (DATE_RE.test(k)) d.opening[k] = num(op[k]); });
  const days = o.days || {};
  Object.keys(days).forEach(k => {
    if (!DATE_RE.test(k)) return;
    const r = days[k] || {};
    const apps = {};
    Object.keys(r.apps || {}).forEach(n => {
      const v = num(r.apps[n]);
      if (n !== '__proto__' && v > 0) apps[n] = v;
    });
    d.days[k] = { apps, other: Math.max(0, num(r.other)), quota: num(r.quota) };
  });
  return d;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { store = normalizeStore(JSON.parse(raw)); return true; }
  } catch (e) {}
  return false;
}

// 回傳 true 代表儲存成功
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
  catch (e) { return false; }
}

function getDay(dateStr) {
  return store.days[dateStr] || { apps: {}, other: 0, quota: 0 };
}

function dayTotal(r) {
  return Object.keys(r.apps).reduce((a, k) => a + r.apps[k], 0) + r.other;
}

// name 為 App 名稱，或 'other'
function setUsage(dateStr, name, mb) {
  const r = store.days[dateStr] || { apps: {}, other: 0, quota: 0 };
  if (name === 'other') r.other = mb;
  else if (mb > 0) r.apps[name] = mb;
  else delete r.apps[name];
  if (dayTotal(r) <= 0) delete store.days[dateStr];
  else store.days[dateStr] = r;
}

function setQuotaSnapshot(dateStr, quota) {
  if (store.days[dateStr]) store.days[dateStr].quota = Math.round(quota * 100) / 100;
}

function daysInCycle(startStr, nextStr) {
  return Object.keys(store.days).filter(d => d >= startStr && d < nextStr).sort();
}

function cycleUsed(startStr, nextStr) {
  let sum = store.opening[startStr] || 0;
  daysInCycle(startStr, nextStr).forEach(d => { sum += dayTotal(store.days[d]); });
  return sum;
}

function remainingMB(startStr, nextStr) {
  return store.settings.monthlyMB - cycleUsed(startStr, nextStr);
}

// 把目前剩餘流量對齊成電信顯示的數字
function calibrate(startStr, nextStr, realRemaining) {
  const diff = remainingMB(startStr, nextStr) - realRemaining;
  store.opening[startStr] = (store.opening[startStr] || 0) + diff;
}

if (typeof module !== 'undefined') {
  module.exports = { normalizeStore };
}