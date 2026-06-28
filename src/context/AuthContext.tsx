import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, AuthState } from '../types';
import { storage, generateId } from '../utils/storage';

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  completeOnboarding: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    onboardingComplete: false,
  });

  useEffect(() => {
    const user = storage.getUser();
    const onboarded = storage.isOnboardingComplete();
    if (user) {
      setState({ user, isAuthenticated: true, isLoading: false, onboardingComplete: onboarded });
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  const signUp = useCallback(async (email: string, _password: string, name: string) => {
    // Scaffold: In production, call your auth API here.
    // Passwords are never stored in localStorage.
    const newUser: UserProfile = {
      id: generateId(),
      name,
      email,
      age: 0,
      heightCm: 0,
      weightKg: 0,
      goal: 'muscle_gain',
      trainingLevel: 'beginner',
      trainingDaysPerWeek: 3,
      equipment: [],
      workoutLocation: 'gym',
      injuries: '',
      nutritionGoal: 'muscle_gain',
      preferredDurationMin: 60,
      bodyFocusPriorities: [],
      assignedProgramId: '',
      createdAt: new Date().toISOString(),
      isPremium: false,
    };
    storage.saveUser(newUser);
    storage.saveToken(`mock_token_${newUser.id}`);
    setState({ user: newUser, isAuthenticated: true, isLoading: false, onboardingComplete: false });
  }, []);

  const signIn = useCallback(async (email: string, _password: string) => {
    // Scaffold: In production, validate credentials against your backend.
    const existing = storage.getUser();
    if (existing && existing.email === email) {
      const onboarded = storage.isOnboardingComplete();
      setState({ user: existing, isAuthenticated: true, isLoading: false, onboardingComplete: onboarded });
    } else {
      // Demo: create a session for any email
      const demoUser: UserProfile = {
        id: generateId(),
        name: email.split('@')[0],
        email,
        age: 28,
        heightCm: 178,
        weightKg: 82,
        goal: 'muscle_gain',
        trainingLevel: 'intermediate',
        trainingDaysPerWeek: 4,
        equipment: ['barbell', 'dumbbell', 'cables'],
        workoutLocation: 'gym',
        injuries: '',
        nutritionGoal: 'muscle_gain',
        preferredDurationMin: 60,
        bodyFocusPriorities: ['chest', 'shoulders', 'arms'],
        assignedProgramId: 'prog_4day_muscle',
        createdAt: new Date().toISOString(),
        isPremium: false,
      };
      storage.saveUser(demoUser);
      storage.saveToken(`mock_token_${demoUser.id}`);
      const onboarded = storage.isOnboardingComplete();
      setState({ user: demoUser, isAuthenticated: true, isLoading: false, onboardingComplete: onboarded });
    }
  }, []);

  const signOut = useCallback(() => {
    storage.clearAuth();
    setState({ user: null, isAuthenticated: false, isLoading: false, onboardingComplete: false });
  }, []);

  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...partial };
      storage.saveUser(updated);
      return { ...prev, user: updated };
    });
  }, []);

  const completeOnboarding = useCallback((profileData: Partial<UserProfile>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...profileData };
      storage.saveUser(updated);
      storage.setOnboardingComplete(true);
      return { ...prev, user: updated, onboardingComplete: true };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, updateProfile, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
