import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CommandCenterProvider } from './lib/commandCenterStore';
import Home from './pages/command/Home';
import DailyMission from './pages/command/DailyMission';
import Roadmap from './pages/command/Roadmap';
import AIMastery from './pages/command/AIMastery';
import BusinessBuilder from './pages/command/BusinessBuilder';
import ContentSystem from './pages/command/ContentSystem';
import FitnessHealth from './pages/command/FitnessHealth';
import MoneyWealth from './pages/command/MoneyWealth';
import Relationships from './pages/command/Relationships';
import TravelPlanner from './pages/command/TravelPlanner';
import LegacyBuilder from './pages/command/LegacyBuilder';
import WeeklyReview from './pages/command/WeeklyReview';
import MonthlyReview from './pages/command/MonthlyReview';
import ProgressDashboard from './pages/command/ProgressDashboard';
import Profile from './pages/command/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <CommandCenterProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/daily-mission" element={<DailyMission />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/ai-mastery" element={<AIMastery />} />
          <Route path="/business-builder" element={<BusinessBuilder />} />
          <Route path="/content-system" element={<ContentSystem />} />
          <Route path="/fitness-health" element={<FitnessHealth />} />
          <Route path="/money-wealth" element={<MoneyWealth />} />
          <Route path="/relationships" element={<Relationships />} />
          <Route path="/travel-planner" element={<TravelPlanner />} />
          <Route path="/legacy-builder" element={<LegacyBuilder />} />
          <Route path="/weekly-review" element={<WeeklyReview />} />
          <Route path="/monthly-review" element={<MonthlyReview />} />
          <Route path="/progress" element={<ProgressDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CommandCenterProvider>
    </BrowserRouter>
  );
}
