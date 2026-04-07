export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function getWeekDates() {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(daysAgo(i));
  }
  return dates;
}

export function streakCount(entries) {
  let count = 0;
  let date = new Date();
  while (true) {
    const key = date.toISOString().slice(0, 10);
    if (entries[key] && (entries[key].morning || entries[key].evening)) {
      count++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}
