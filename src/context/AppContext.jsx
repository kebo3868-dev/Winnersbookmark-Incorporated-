import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../data/storage';
import { todayKey, streakCount } from '../lib/dates';
import { computeAlignmentScore } from '../lib/scoring';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(null);
  const [onboarded, setOnboardedState] = useState(false);
  const [entries, setEntriesState] = useState({});
  const [goals, setGoalsState] = useState(storage.getGoals());
  const [systems, setSystemsState] = useState([]);
  const [brainstorms, setBrainstormsState] = useState([]);
  const [thoughts, setThoughtsState] = useState([]);
  const [reviews, setReviewsState] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfileState(storage.getProfile());
    setOnboardedState(storage.isOnboarded());
    setEntriesState(storage.getEntries());
    setGoalsState(storage.getGoals());
    setSystemsState(storage.getSystems());
    setBrainstormsState(storage.getBrainstorms());
    setThoughtsState(storage.getThoughts());
    setReviewsState(storage.getReviews());
    setLoading(false);
  }, []);

  const setProfile = useCallback((p) => {
    setProfileState(p);
    storage.setProfile(p);
  }, []);

  const setOnboarded = useCallback((val) => {
    setOnboardedState(val);
    storage.setOnboarded(val);
  }, []);

  const saveEntry = useCallback((dateKey, entry) => {
    storage.setEntry(dateKey, entry);
    setEntriesState(storage.getEntries());
  }, []);

  const setGoals = useCallback((g) => {
    setGoalsState(g);
    storage.setGoals(g);
  }, []);

  const setSystems = useCallback((s) => {
    setSystemsState(s);
    storage.setSystems(s);
  }, []);

  const setBrainstorms = useCallback((b) => {
    setBrainstormsState(b);
    storage.setBrainstorms(b);
  }, []);

  const setThoughts = useCallback((t) => {
    setThoughtsState(t);
    storage.setThoughts(t);
  }, []);

  const setReviews = useCallback((r) => {
    setReviewsState(r);
    storage.setReviews(r);
  }, []);

  const today = todayKey();
  const todayEntry = entries[today] || {};
  const streak = streakCount(entries);
  const todayScore = todayEntry.evening?.scores
    ? computeAlignmentScore(todayEntry.evening.scores)
    : null;

  const value = {
    loading,
    profile, setProfile,
    onboarded, setOnboarded,
    entries, saveEntry,
    goals, setGoals,
    systems, setSystems,
    brainstorms, setBrainstorms,
    thoughts, setThoughts,
    reviews, setReviews,
    today, todayEntry, streak, todayScore,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
