import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';

// Auth screens
const SplashScreen = lazy(() => import('./screens/auth/SplashScreen'));
const WelcomeScreen = lazy(() => import('./screens/auth/WelcomeScreen'));
const SignInScreen = lazy(() => import('./screens/auth/SignInScreen'));
const SignUpScreen = lazy(() => import('./screens/auth/SignUpScreen'));
const ForgotPasswordScreen = lazy(() => import('./screens/auth/ForgotPasswordScreen'));

// Onboarding
const OnboardingScreen = lazy(() => import('./screens/onboarding/OnboardingScreen'));

// Main app screens
const HomeScreen = lazy(() => import('./screens/home/HomeScreen'));
const TrainingScreen = lazy(() => import('./screens/training/TrainingScreen'));
const WorkoutDetailScreen = lazy(() => import('./screens/training/WorkoutDetailScreen'));
const ExerciseDetailScreen = lazy(() => import('./screens/training/ExerciseDetailScreen'));
const NutritionScreen = lazy(() => import('./screens/nutrition/NutritionScreen'));
const NutritionDetailScreen = lazy(() => import('./screens/nutrition/NutritionDetailScreen'));
const TestosteroneScreen = lazy(() => import('./screens/testosterone/TestosteroneScreen'));
const TestosteroneDetailScreen = lazy(() => import('./screens/testosterone/TestosteroneDetailScreen'));
const ProgressScreen = lazy(() => import('./screens/progress/ProgressScreen'));
const LibraryScreen = lazy(() => import('./screens/library/LibraryScreen'));
const ProfileScreen = lazy(() => import('./screens/profile/ProfileScreen'));

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-ink-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-gold border-ink-line animate-spin"
        />
        <p className="text-xs text-ghost uppercase tracking-widest">Loading</p>
      </div>
    </div>
  );
}

// Main app layout — wraps authenticated screens with bottom nav
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen max-w-md mx-auto">
      {children}
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading, onboardingComplete } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen max-w-md mx-auto">
        <Routes>
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/signin" element={<SignInScreen />} />
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="*" element={<Navigate to="/splash" replace />} />
        </Routes>
      </div>
    );
  }

  // Authenticated but not onboarded
  if (!onboardingComplete) {
    return (
      <div className="min-h-screen max-w-md mx-auto">
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </div>
    );
  }

  // Fully authenticated and onboarded
  return (
    <AppLayout>
      <Routes>
        {/* Home */}
        <Route path="/" element={<HomeScreen />} />

        {/* Training */}
        <Route path="/training" element={<TrainingScreen />} />
        <Route path="/training/workout" element={<WorkoutDetailScreen />} />
        <Route path="/training/workout/:workoutDayId" element={<WorkoutDetailScreen />} />
        <Route path="/training/exercise/:exerciseId" element={<ExerciseDetailScreen />} />

        {/* Nutrition */}
        <Route path="/nutrition" element={<NutritionScreen />} />
        <Route path="/nutrition/article/:contentId" element={<NutritionDetailScreen />} />

        {/* Testosterone */}
        <Route path="/testosterone" element={<TestosteroneScreen />} />
        <Route path="/testosterone/detail/:cardId" element={<TestosteroneDetailScreen />} />

        {/* Progress */}
        <Route path="/progress" element={<ProgressScreen />} />

        {/* Library */}
        <Route path="/library" element={<LibraryScreen />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfileScreen />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <AppRoutes />
          </Suspense>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
