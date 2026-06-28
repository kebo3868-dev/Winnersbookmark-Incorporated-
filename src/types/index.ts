// ============================================================
// WINNERS BOOKMARK FITNESS — Master Type Definitions
// ============================================================

export type GoalType =
  | 'muscle_gain'
  | 'fat_loss'
  | 'recomposition'
  | 'strength'
  | 'maintenance';

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'bodyweight'
  | 'cables'
  | 'machine'
  | 'resistance_band'
  | 'kettlebell'
  | 'pull_up_bar';

export type WorkoutLocation = 'gym' | 'home' | 'hybrid';

export type NutritionGoal = 'muscle_gain' | 'fat_loss' | 'maintenance' | 'performance';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'calves'
  | 'forearms'
  | 'full_body'
  | 'cardio';

export type LibraryCategory =
  | 'exercise'
  | 'workout'
  | 'nutrition'
  | 'testosterone'
  | 'recovery'
  | 'mindset';

// ============================================================
// USER
// ============================================================
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: GoalType;
  trainingLevel: TrainingLevel;
  trainingDaysPerWeek: number;
  equipment: EquipmentType[];
  workoutLocation: WorkoutLocation;
  injuries: string;
  nutritionGoal: NutritionGoal;
  preferredDurationMin: number;
  bodyFocusPriorities: string[];
  assignedProgramId: string;
  createdAt: string;
  isPremium: boolean;
  avatarUrl?: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;
}

// ============================================================
// EXERCISES
// ============================================================
export interface ExerciseSet {
  setNumber: number;
  reps: string;
  weight?: string;
  restSeconds: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: string[];
  equipment: EquipmentType[];
  difficulty: TrainingLevel;
  instructions: string[];
  commonMistakes: string[];
  breathingCues: string;
  tempo?: string;
  beginnerMod: string;
  advancedProg: string;
  defaultSets: ExerciseSet[];
  thumbnailUrl: string;
  videoUrl: string;
  videoDurationSec: number;
  isPremium: boolean;
  tags: string[];
}

// ============================================================
// WORKOUTS & PROGRAMS
// ============================================================
export interface WorkoutExercise {
  exerciseId: string;
  sets: ExerciseSet[];
  notes?: string;
  isSuperset?: boolean;
  supersetWith?: string;
}

export interface WorkoutDay {
  id: string;
  name: string;
  goal: string;
  estimatedDurationMin: number;
  warmUp: string[];
  exerciseBlocks: WorkoutExercise[];
  coolDown: string[];
  dayNumber: number;
  focusMuscles: MuscleGroup[];
  isRestDay: boolean;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  level: TrainingLevel;
  durationWeeks: number;
  daysPerWeek: number;
  goal: GoalType;
  location: WorkoutLocation;
  equipment: EquipmentType[];
  workoutDays: WorkoutDay[];
  thumbnailUrl: string;
  isPremium: boolean;
  tags: string[];
}

// ============================================================
// NUTRITION
// ============================================================
export interface MacroTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealCard {
  id: string;
  name: string;
  category: 'pre_workout' | 'post_workout' | 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  proteinG: number;
  prep: string;
  description: string;
  thumbnailUrl: string;
  ingredients: string[];
  tags: string[];
  isPremium: boolean;
}

export interface NutritionArticle {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string[];
  thumbnailUrl: string;
  readTimeSec: number;
  isPremium: boolean;
}

// ============================================================
// TESTOSTERONE (Educational Only)
// ============================================================
export interface TestosteroneCard {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string[];
  keyPoints: string[];
  disclaimer: string;
  thumbnailUrl: string;
  isPremium: boolean;
}

export interface HabitItem {
  id: string;
  label: string;
  icon: string;
  category: 'sleep' | 'training' | 'nutrition' | 'lifestyle';
}

export interface DailyHabits {
  date: string;
  habits: Record<string, boolean>;
}

// ============================================================
// PROGRESS
// ============================================================
export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  notes?: string;
}

export interface MeasurementEntry {
  id: string;
  date: string;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
  shoulderCm?: number;
  notes?: string;
}

export interface WorkoutCompletion {
  id: string;
  date: string;
  programId: string;
  workoutDayId: string;
  workoutName: string;
  completedExercises: string[];
  durationMin: number;
  notes?: string;
}

export interface PREntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  weightKg: number;
  reps: number;
  notes?: string;
}

export interface ProgressState {
  weightLog: WeightEntry[];
  measurements: MeasurementEntry[];
  workoutHistory: WorkoutCompletion[];
  prs: PREntry[];
  streak: number;
  lastWorkoutDate: string | null;
}

// ============================================================
// LIBRARY
// ============================================================
export interface LibraryItem {
  id: string;
  title: string;
  category: LibraryCategory;
  description: string;
  thumbnailUrl: string;
  isPremium: boolean;
  contentId: string;
  tags: string[];
}

// ============================================================
// APP STATE
// ============================================================
export interface AppState {
  activeTab: string;
  activeProgramId: string | null;
  currentWorkoutDayId: string | null;
  savedItemIds: string[];
  recentlyViewedIds: string[];
  dailyHabits: DailyHabits;
  progress: ProgressState;
  nutritionTargets: MacroTarget;
  notificationsEnabled: boolean;
}

export interface OnboardingData {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: GoalType;
  trainingLevel: TrainingLevel;
  trainingDaysPerWeek: number;
  equipment: EquipmentType[];
  workoutLocation: WorkoutLocation;
  injuries: string;
  nutritionGoal: NutritionGoal;
  preferredDurationMin: number;
  bodyFocusPriorities: string[];
}
