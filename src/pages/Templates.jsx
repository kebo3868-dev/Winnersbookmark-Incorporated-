import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { TEMPLATES, findTemplate } from '../data/templates';
import { useStudio } from '../context/StudioContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function Templates() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { createProject } = useStudio();

  const spawn = (t) => {
    const p = createProject({
      title: t.title,
      genre: t.genre,
      style: t.style,
      audience: t.audience,
      tone: t.tone,
      pages: t.pages,
      panelsPerPage: t.panelsPerPage,
      logline: t.logline,
      mainCharacter: t.mainCharacter,
      villain: t.villain,
      setting: t.setting,
      storyGoal: t.storyGoal,
    });
    nav(`/project/${p.id}`);
  };

  // ?spawn=id from dashboard
  useEffect(() => {
    const id = params.get('spawn');
    if (id) {
      const t = findTemplate(id);
      if (t) spawn(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Template Library"
          title="Spark a comic in one tap"
          subtitle="Twelve prebuilt story starters across genres. Pick one — it spawns a full project pre-filled with logline, cast, and setting."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id} onClick={() => spawn(t)}
              className="glass card-pad text-left hover:border-gold/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow mb-1">{t.genre} · {t.style}</div>
                  <div className="font-display font-semibold text-paper">{t.title}</div>
                  <p className="text-mist text-xs mt-1 line-clamp-3">{t.logline}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip-gold">{t.pages} pages</span>
                    <span className="chip">{t.audience}</span>
                    <span className="chip">{t.tone}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-electric/10 border border-electric/30 text-electric-glow flex items-center justify-center shrink-0">
                  <Sparkles size={16}/>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-mist group-hover:text-paper">
                Spawn project <ArrowRight size={12}/>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
