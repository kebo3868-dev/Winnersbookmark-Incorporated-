import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import DailyEntry from './pages/DailyEntry';
import GoalsVision from './pages/GoalsVision';
import SystemBuilder from './pages/SystemBuilder';
import BrainstormVault from './pages/BrainstormVault';
import Reviews from './pages/Reviews';
import Insights from './pages/Insights';

function AppRoutes() {
  const { onboarded, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-wb-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-wb-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-wb-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/daily" element={<DailyEntry />} />
      <Route path="/goals" element={<GoalsVision />} />
      <Route path="/systems" element={<SystemBuilder />} />
      <Route path="/vault" element={<BrainstormVault />} />
      <Route path="/reviews" element={<Reviews />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
