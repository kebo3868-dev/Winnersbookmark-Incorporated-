import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppState, DailyHabits, WeightEntry, WorkoutCompletion, PREntry } from '../types';
import { storage, calcMacroTargets, getToday, calcStreak, generateId } from '../utils/storage';
import { HABIT_ITEMS } from '../data/testosterone';

const DEFAULT_HABITS: DailyHabits = {
  date: getToday(),
  habits: Object.fromEntries(HABIT_ITEMS.map(h => [h.id, false])),
};

const DEFAULT_STATE: AppState = {
  activeTab: 'home',
  activeProgramId: null,
  currentWorkoutDayId: null,
  savedItemIds: [],
  recentlyViewedIds: [],
  dailyHabits: DEFAULT_HABITS,
  progress: {
    weightLog: [],
    measurements: [],
    workoutHistory: [],
    prs: [],
    streak: 0,
    lastWorkoutDate: null,
  },
  nutritionTargets: { calories: 2500, proteinG: 180, carbsG: 280, fatG: 70 },
  notificationsEnabled: false,
};

interface AppContextValue {
  appState: AppState;
  setActiveTab: (tab: string) => void;
  setActiveProgram: (programId: string) => void;
  toggleHabit: (habitId: string) => void;
  logWeight: (weightKg: number, notes?: string) => void;
  completeWorkout: (workoutDayId: string, programId: string, workoutName: string, durationMin: number) => void;
  logPR: (exerciseId: string, exerciseName: string, weightKg: number, reps: number) => void;
  toggleSaved: (itemId: string) => void;
  addRecentlyViewed: (itemId: string) => void;
  updateNutritionTargets: (weightKg: number, goal: string, daysPerWeek: number) => void;
  resetHabitsForToday: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [appState, setAppState] = useState<AppState>(DEFAULT_STATE);

  useEffect(() => {
    const saved = storage.getAppState();
    if (saved) {
      const today = getToday();
      let dailyHabits = (saved.dailyHabits as DailyHabits) || DEFAULT_HABITS;
      if (dailyHabits.date !== today) {
        dailyHabits = { date: today, habits: Object.fromEntries(HABIT_ITEMS.map(h => [h.id, false])) };
      }
      const merged: AppState = { ...DEFAULT_STATE, ...saved, dailyHabits };
      if (merged.progress) {
        merged.progress.streak = calcStreak(merged.progress.workoutHistory || []);
      }
      setAppState(merged);
    }
  }, []);

  const persist = useCallback((updater: (prev: AppState) => AppState) => {
    setAppState(prev => {
      const next = updater(prev);
      storage.saveAppState(next);
      return next;
    });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    persist(p => ({ ...p, activeTab: tab }));
  }, [persist]);

  const setActiveProgram = useCallback((programId: string) => {
    persist(p => ({ ...p, activeProgramId: programId }));
  }, [persist]);

  const toggleHabit = useCallback((habitId: string) => {
    persist(p => {
      const today = getToday();
      let habits = p.dailyHabits;
      if (habits.date !== today) {
        habits = { date: today, habits: Object.fromEntries(HABIT_ITEMS.map(h => [h.id, false])) };
      }
      return {
        ...p,
        dailyHabits: {
          ...habits,
          habits: { ...habits.habits, [habitId]: !habits.habits[habitId] },
        },
      };
    });
  }, [persist]);

  const logWeight = useCallback((weightKg: number, notes?: string) => {
    const entry: WeightEntry = { id: generateId(), date: getToday(), weightKg, notes };
    persist(p => ({
      ...p,
      progress: { ...p.progress, weightLog: [entry, ...p.progress.weightLog].slice(0, 365) },
    }));
  }, [persist]);

  const completeWorkout = useCallback(
    (workoutDayId: string, programId: string, workoutName: string, durationMin: number) => {
      const entry: WorkoutCompletion = {
        id: generateId(),
        date: getToday(),
        programId,
        workoutDayId,
        workoutName,
        completedExercises: [],
        durationMin,
      };
      persist(p => {
        const history = [entry, ...p.progress.workoutHistory].slice(0, 500);
        return {
          ...p,
          progress: {
            ...p.progress,
            workoutHistory: history,
            lastWorkoutDate: getToday(),
            streak: calcStreak(history),
          },
        };
      });
    },
    [persist]
  );

  const logPR = useCallback((exerciseId: string, exerciseName: string, weightKg: number, reps: number) => {
    const entry: PREntry = { id: generateId(), exerciseId, exerciseName, date: getToday(), weightKg, reps };
    persist(p => ({ ...p, progress: { ...p.progress, prs: [entry, ...p.progress.prs].slice(0, 500) } }));
  }, [persist]);

  const toggleSaved = useCallback((itemId: string) => {
    persist(p => ({
      ...p,
      savedItemIds: p.savedItemIds.includes(itemId)
        ? p.savedItemIds.filter(id => id !== itemId)
        : [itemId, ...p.savedItemIds],
    }));
  }, [persist]);

  const addRecentlyViewed = useCallback((itemId: string) => {
    persist(p => ({
      ...p,
      recentlyViewedIds: [itemId, ...p.recentlyViewedIds.filter(id => id !== itemId)].slice(0, 20),
    }));
  }, [persist]);

  const updateNutritionTargets = useCallback((weightKg: number, goal: string, daysPerWeek: number) => {
    const targets = calcMacroTargets(weightKg, goal, daysPerWeek);
    persist(p => ({ ...p, nutritionTargets: targets }));
  }, [persist]);

  const resetHabitsForToday = useCallback(() => {
    persist(p => ({
      ...p,
      dailyHabits: { date: getToday(), habits: Object.fromEntries(HABIT_ITEMS.map(h => [h.id, false])) },
    }));
  }, [persist]);

  return (
    <AppContext.Provider value={{
      appState,
      setActiveTab,
      setActiveProgram,
      toggleHabit,
      logWeight,
      completeWorkout,
      logPR,
      toggleSaved,
      addRecentlyViewed,
      updateNutritionTargets,
      resetHabitsForToday,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
