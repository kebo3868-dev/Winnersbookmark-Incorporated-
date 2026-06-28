import type { AppState, UserProfile, ProgressState, DailyHabits, MacroTarget } from '../types';

const KEYS = {
  AUTH_USER: 'wbf_user',
  AUTH_TOKEN: 'wbf_token',
  ONBOARDING_COMPLETE: 'wbf_onboarded',
  APP_STATE: 'wbf_app_state',
} as const;

export const storage = {
  // Auth
  saveUser: (user: UserProfile) => {
    localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
  },
  getUser: (): UserProfile | null => {
    try {
      const raw = localStorage.getItem(KEYS.AUTH_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  saveToken: (token: string) => {
    localStorage.setItem(KEYS.AUTH_TOKEN, token);
  },
  getToken: (): string | null => localStorage.getItem(KEYS.AUTH_TOKEN),
  setOnboardingComplete: (v: boolean) => {
    localStorage.setItem(KEYS.ONBOARDING_COMPLETE, String(v));
  },
  isOnboardingComplete: (): boolean => {
    return localStorage.getItem(KEYS.ONBOARDING_COMPLETE) === 'true';
  },
  clearAuth: () => {
    localStorage.removeItem(KEYS.AUTH_USER);
    localStorage.removeItem(KEYS.AUTH_TOKEN);
    localStorage.removeItem(KEYS.ONBOARDING_COMPLETE);
  },

  // App State
  saveAppState: (state: Partial<AppState>) => {
    try {
      const existing = storage.getAppState();
      localStorage.setItem(KEYS.APP_STATE, JSON.stringify({ ...existing, ...state }));
    } catch {
      // storage full
    }
  },
  getAppState: (): Partial<AppState> | null => {
    try {
      const raw = localStorage.getItem(KEYS.APP_STATE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clearAll: () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  },
};

// Derived helpers
export function calcMacroTargets(
  weightKg: number,
  goal: string,
  activityDays: number
): MacroTarget {
  const baseCalories = weightKg * 24;
  const activityMult = 1.2 + activityDays * 0.05;
  let calories = Math.round(baseCalories * activityMult);
  let proteinG = Math.round(weightKg * 2.2);

  if (goal === 'fat_loss') {
    calories = Math.round(calories * 0.82);
    proteinG = Math.round(weightKg * 2.4);
  } else if (goal === 'muscle_gain') {
    calories = Math.round(calories * 1.1);
    proteinG = Math.round(weightKg * 2.2);
  } else if (goal === 'strength') {
    calories = Math.round(calories * 1.05);
    proteinG = Math.round(weightKg * 2.0);
  }

  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);

  return { calories, proteinG, carbsG, fatG };
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function calcStreak(workoutHistory: { date: string }[]): number {
  if (!workoutHistory.length) return 0;
  const sorted = [...workoutHistory]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(w => w.date);

  let streak = 0;
  const today = getToday();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (sorted[0] !== today && sorted[0] !== yesterdayStr) return 0;

  let checkDate = sorted[0] === today ? today : yesterdayStr;

  for (const date of sorted) {
    if (date === checkDate) {
      streak++;
      const prev = new Date(checkDate);
      prev.setDate(prev.getDate() - 1);
      checkDate = prev.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
