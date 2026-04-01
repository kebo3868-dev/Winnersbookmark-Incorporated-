import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Tracker from './pages/Tracker';
import GoalSetter from './pages/GoalSetter';
import Library from './pages/Library';
import Pricing from './pages/Pricing';
import {
  getHabitData,
  toggleHabitForDate,
  getTodayKey,
  getTrialDaysRemaining,
  isTrialActive,
  startTrial,
} from './data/storage';

export default function App() {
  const [habitData, setHabitData] = useState(() => getHabitData());
  const [trialDays, setTrialDays] = useState(() =>
    isTrialActive() ? getTrialDaysRemaining() : null
  );

  // Auto-start trial on first visit
  useEffect(() => {
    startTrial();
    setTrialDays(getTrialDaysRemaining());
  }, []);

  const handleToggleHabit = useCallback((habitId) => {
    const today = getTodayKey();
    const updated = toggleHabitForDate(habitId, today);
    setHabitData({ ...updated });
  }, []);

  const handleStartTrial = useCallback(() => {
    startTrial();
    setTrialDays(getTrialDaysRemaining());
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-wb-black">
        <Navbar trialDays={trialDays} />
        <main className="max-w-6xl mx-auto px-4 pt-24 pb-16">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  habitData={habitData}
                  onToggleHabit={handleToggleHabit}
                />
              }
            />
            <Route
              path="/tracker"
              element={
                <Tracker
                  habitData={habitData}
                  onToggleHabit={handleToggleHabit}
                />
              }
            />
            <Route path="/goals"   element={<GoalSetter />} />
            <Route path="/library" element={<Library />} />
            <Route
              path="/pricing"
              element={<Pricing onStartTrial={handleStartTrial} />}
            />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-wb-border py-8 mt-8">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-wb-muted text-sm">
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span className="font-semibold text-wb-white">Winners Bookmark Incorporated</span>
            </div>
            <p className="text-center italic text-xs">
              "Discipline is the foundation. Everything else is built on top of it."
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://winnersbookmark.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-wb-white transition-colors"
              >
                winnersbookmark.com
              </a>
              <span>•</span>
              <a
                href="mailto:kebo3868@gmail.com"
                className="hover:text-wb-white transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
