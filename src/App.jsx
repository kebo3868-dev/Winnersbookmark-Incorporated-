import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { lazy, Suspense } from 'react';

const Onboarding       = lazy(() => import('./pages/Onboarding'));
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const Accounts         = lazy(() => import('./pages/Accounts'));
const Income           = lazy(() => import('./pages/Income'));
const Expenses         = lazy(() => import('./pages/Expenses'));
const Budget           = lazy(() => import('./pages/Budget'));
const Subscriptions    = lazy(() => import('./pages/Subscriptions'));
const Bills            = lazy(() => import('./pages/Bills'));
const CashFlow         = lazy(() => import('./pages/CashFlow'));
const Goals            = lazy(() => import('./pages/Goals'));
const Calendar         = lazy(() => import('./pages/Calendar'));
const Insights         = lazy(() => import('./pages/Insights'));
const Notifications    = lazy(() => import('./pages/Notifications'));
const Settings         = lazy(() => import('./pages/Settings'));

function Loader() {
  return (
    <div className="min-h-screen bg-wb-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-wb-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-wb-muted text-sm">Loading…</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { onboarded, loading } = useFinance();
  if (loading) return <Loader />;
  if (!onboarded) {
    return (
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="*" element={<Onboarding />} />
        </Routes>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/accounts"      element={<Accounts />} />
        <Route path="/income"        element={<Income />} />
        <Route path="/expenses"      element={<Expenses />} />
        <Route path="/budget"        element={<Budget />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/bills"         element={<Bills />} />
        <Route path="/cashflow"      element={<CashFlow />} />
        <Route path="/goals"         element={<Goals />} />
        <Route path="/calendar"      element={<Calendar />} />
        <Route path="/insights"      element={<Insights />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings"      element={<Settings />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FinanceProvider>
        <AppRoutes />
      </FinanceProvider>
    </BrowserRouter>
  );
}
