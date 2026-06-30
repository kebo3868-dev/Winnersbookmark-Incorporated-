import { Link } from 'react-router-dom';
import { Home, BookOpen } from 'lucide-react';
import Layout from '../components/Layout';
import { useMeta } from '../lib/useMeta';

export default function NotFound() {
  useMeta('Page Not Found', 'The page you’re looking for doesn’t exist.');
  return (
    <Layout>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-28 text-center">
        <div className="font-display text-7xl font-extrabold text-gradient-gold">404</div>
        <h1 className="mt-4 font-display text-3xl font-bold text-paper">This page drifted off.</h1>
        <p className="mt-3 text-mist leading-relaxed">
          The page you’re looking for doesn’t exist — but the work still does. Get back on track.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-gold"><Home size={16} /> Back Home</Link>
          <Link to="/blog" className="btn-ghost !px-5 !py-3"><BookOpen size={16} /> Read the Blog</Link>
        </div>
      </section>
    </Layout>
  );
}
