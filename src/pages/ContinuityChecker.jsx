import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import { runContinuityCheck } from '../lib/continuity';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export default function ContinuityChecker() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const issues = runContinuityCheck(project);
  const warns = issues.filter(i => i.severity === 'warn').length;
  const infos = issues.filter(i => i.severity === 'info').length;

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Continuity Checker"
          title="Find what breaks the story"
          subtitle="Auto-flags character, costume, dialogue, and pacing risks before you publish."
          right={
            <div className="flex gap-2">
              <span className="chip-gold">{warns} warnings</span>
              <span className="chip">{infos} notes</span>
            </div>
          }
        />

        {issues.length === 0 ? (
          <div className="glass card-pad text-center">
            <CheckCircle2 size={28} className="mx-auto text-gold-light mb-2" />
            <div className="font-display font-semibold text-paper">Clean read</div>
            <p className="text-mist text-sm mt-1">No issues detected. Lock it down and publish.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((i, idx) => {
              const isWarn = i.severity === 'warn';
              const Icon = isWarn ? AlertTriangle : Info;
              return (
                <div
                  key={idx}
                  className={`glass card-pad flex items-start gap-3 border ${isWarn ? 'border-gold/40' : 'border-ink-line'}`}
                >
                  <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
                    isWarn ? 'bg-gold/10 border border-gold/30 text-gold-light' : 'bg-ink-card2 border border-ink-line text-chalk'
                  }`}>
                    <Icon size={15}/>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-wider text-mist font-semibold mb-0.5">{i.area}</div>
                    <div className="text-sm text-paper">{i.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
