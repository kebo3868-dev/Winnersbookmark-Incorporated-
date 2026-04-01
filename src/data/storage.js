// localStorage helpers for persisting habit data

const STORAGE_KEY = 'wb_habits_v1';
const CUSTOM_HABITS_KEY = 'wb_custom_habits_v1';
const TRIAL_KEY = 'wb_trial_start';

export function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getHabitData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveHabitData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function toggleHabitForDate(habitId, date) {
  const data = getHabitData();
  if (!data[habitId]) data[habitId] = { completedDates: [] };
  const dates = data[habitId].completedDates;
  const idx = dates.indexOf(date);
  if (idx >= 0) {
    dates.splice(idx, 1);
  } else {
    dates.push(date);
  }
  saveHabitData(data);
  return data;
}

export function isHabitCompleted(habitId, date, data) {
  return !!(data[habitId]?.completedDates?.includes(date));
}

export function calculateStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  const sorted = [...completedDates].sort((a, b) => b.localeCompare(a));
  const today = getTodayKey();

  let streak = 0;
  let checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (sorted.includes(dateStr)) {
      streak++;
    } else if (i === 0) {
      // Today not done yet — check yesterday to keep streak alive
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    } else {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function getLongestStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  const sorted = [...completedDates].sort((a, b) => a.localeCompare(b));
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

export function getCustomHabits() {
  try {
    const raw = localStorage.getItem(CUSTOM_HABITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomHabits(habits) {
  localStorage.setItem(CUSTOM_HABITS_KEY, JSON.stringify(habits));
}

export function getTrialStart() {
  const raw = localStorage.getItem(TRIAL_KEY);
  if (!raw) return null;
  return new Date(raw);
}

export function startTrial() {
  if (!localStorage.getItem(TRIAL_KEY)) {
    localStorage.setItem(TRIAL_KEY, new Date().toISOString());
  }
}

export function getTrialDaysRemaining() {
  const start = getTrialStart();
  if (!start) return 30;
  const now = new Date();
  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diff);
}

export function isTrialActive() {
  return getTrialDaysRemaining() > 0;
}
