import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { StudioProvider } from './context/StudioContext';
import Logo from './components/Logo';

const Dashboard         = lazy(() => import('./pages/Dashboard'));
const NewProject        = lazy(() => import('./pages/NewProject'));
const Projects          = lazy(() => import('./pages/Projects'));
const ProjectDetail     = lazy(() => import('./pages/ProjectDetail'));
const StoryEngine       = lazy(() => import('./pages/StoryEngine'));
const CharacterVault    = lazy(() => import('./pages/CharacterVault'));
const WorldBuilder      = lazy(() => import('./pages/WorldBuilder'));
const PageBuilder       = lazy(() => import('./pages/PageBuilder'));
const PanelPrompts      = lazy(() => import('./pages/PanelPrompts'));
const CoverCreator      = lazy(() => import('./pages/CoverCreator'));
const DialogueWriter    = lazy(() => import('./pages/DialogueWriter'));
const Storyboard        = lazy(() => import('./pages/Storyboard'));
const ContinuityChecker = lazy(() => import('./pages/ContinuityChecker'));
const ExportCenter      = lazy(() => import('./pages/ExportCenter'));
const SocialMedia       = lazy(() => import('./pages/SocialMedia'));
const Monetization      = lazy(() => import('./pages/Monetization'));
const Templates         = lazy(() => import('./pages/Templates'));
const MasterPrompts     = lazy(() => import('./pages/MasterPrompts'));
const Settings          = lazy(() => import('./pages/Settings'));

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 animate-pulse"><Logo size={56} /></div>
        <div className="eyebrow">Loading Studio…</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StudioProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/new"        element={<NewProject />} />
            <Route path="/projects"   element={<Projects />} />
            <Route path="/templates"  element={<Templates />} />
            <Route path="/master"     element={<MasterPrompts />} />
            <Route path="/settings"   element={<Settings />} />

            <Route path="/project/:id"             element={<ProjectDetail />} />
            <Route path="/project/:id/story"       element={<StoryEngine />} />
            <Route path="/project/:id/characters"  element={<CharacterVault />} />
            <Route path="/project/:id/world"       element={<WorldBuilder />} />
            <Route path="/project/:id/pages"       element={<PageBuilder />} />
            <Route path="/project/:id/prompts"     element={<PanelPrompts />} />
            <Route path="/project/:id/cover"       element={<CoverCreator />} />
            <Route path="/project/:id/dialogue"    element={<DialogueWriter />} />
            <Route path="/project/:id/storyboard"  element={<Storyboard />} />
            <Route path="/project/:id/continuity"  element={<ContinuityChecker />} />
            <Route path="/project/:id/social"      element={<SocialMedia />} />
            <Route path="/project/:id/monetize"    element={<Monetization />} />
            <Route path="/project/:id/export"      element={<ExportCenter />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </StudioProvider>
    </BrowserRouter>
  );
}
