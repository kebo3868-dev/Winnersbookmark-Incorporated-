const KEY = 'winnersbookmark.cinecomic.v1';

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveStore(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function clearStore() {
  try { localStorage.removeItem(KEY); return true; }
  catch { return false; }
}
