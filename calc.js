// 流量計算（純函式，不碰畫面，方便測試）
const DAY_MS = 86400000;

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// 取得某年某月的重置日（月份可溢位；若該月沒有 31 日等，改用該月最後一天）
function resetDateOf(y, m, resetDay) {
  const base = new Date(Date.UTC(y, m, 1));
  const yy = base.getUTCFullYear();
  const mm = base.getUTCMonth();
  return Date.UTC(yy, mm, Math.min(resetDay, daysInMonth(yy, mm)));
}

// y, m(0-11), d 為「今天」；回傳本期起訖與剩餘天數（含今天）
function calcCycle(y, m, d, resetDay) {
  const today = Date.UTC(y, m, d);
  let start = resetDateOf(y, m, resetDay);
  let next;
  if (today >= start) {
    next = resetDateOf(y, m + 1, resetDay);
  } else {
    next = start;
    start = resetDateOf(y, m - 1, resetDay);
  }
  return {
    start, next, today,
    daysLeft: (next - today) / DAY_MS,
    cycleDays: (next - start) / DAY_MS,
    elapsedDays: (today - start) / DAY_MS
  };
}

// remainingMB：目前實際剩餘（已扣掉今天用掉的）
// usedToday：今天已用
// 今日額度 = 今天開始時的剩餘 ÷ 剩餘天數（含今天）
function calcQuota(remainingMB, usedToday, daysLeft) {
  const startOfDay = Math.max(0, remainingMB + usedToday);
  const quota = startOfDay / daysLeft;
  return { quota, leftToday: quota - usedToday, startOfDay };
}

if (typeof module !== 'undefined') module.exports = { calcCycle, calcQuota, resetDateOf };