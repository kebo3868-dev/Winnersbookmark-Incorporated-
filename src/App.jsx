import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LogoMark } from './components/Logo';

const Home          = lazy(() => import('./pages/Home'));
const Blog          = lazy(() => import('./pages/Blog'));
const BlogPost      = lazy(() => import('./pages/BlogPost'));
const Categories    = lazy(() => import('./pages/Categories'));
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'));
const Books         = lazy(() => import('./pages/Books'));
const Mentors       = lazy(() => import('./pages/Mentors'));
const MentorDetail  = lazy(() => import('./pages/MentorDetail'));
const Membership    = lazy(() => import('./pages/Membership'));
const About         = lazy(() => import('./pages/About'));
const Contact       = lazy(() => import('./pages/Contact'));
const NotFound      = lazy(() => import('./pages/NotFound'));
const Today         = lazy(() => import('./pages/Today'));
const MonthlyRotation = lazy(() => import('./pages/MonthlyRotation'));
const FocusPage     = lazy(() => import('./pages/FocusPage'));
const Login         = lazy(() => import('./pages/Login'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Admin         = lazy(() => import('./pages/Admin'));

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 animate-pulse"><LogoMark size={52} /></div>
        <div className="eyebrow">Loading…</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"                    element={<Home />} />
          <Route path="/blog"                element={<Blog />} />
          <Route path="/blog/:slug"          element={<BlogPost />} />
          <Route path="/categories"          element={<Categories />} />
          <Route path="/categories/:slug"    element={<CategoryDetail />} />
          <Route path="/books"               element={<Books />} />
          <Route path="/mentors"             element={<Mentors />} />
          <Route path="/mentors/:slug"       element={<MentorDetail />} />
          <Route path="/membership"          element={<Membership />} />
          <Route path="/today"               element={<Today />} />
          <Route path="/monthly-rotation"    element={<MonthlyRotation />} />
          <Route path="/fitness"             element={<FocusPage type="fitness" />} />
          <Route path="/nutrition"           element={<FocusPage type="nutrition" />} />
          <Route path="/money"               element={<FocusPage type="money" />} />
          <Route path="/ai-productivity"     element={<FocusPage type="ai" />} />
          <Route path="/login"               element={<Login />} />
          <Route path="/dashboard"           element={<Dashboard />} />
          <Route path="/admin"               element={<Admin />} />
          <Route path="/about"               element={<About />} />
          <Route path="/contact"             element={<Contact />} />
          <Route path="*"                    element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
