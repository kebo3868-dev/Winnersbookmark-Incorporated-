import { useMemo } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import EmptyState from '../components/EmptyState';
import PromptCard from '../components/PromptCard';
import CopyButton from '../components/CopyButton';
import { Image as ImageIcon } from 'lucide-react';
import { buildAllPanelPrompts } from '../lib/exports';
import { panelPrompt, characterBibleLine } from '../lib/prompts';

export default function PanelPrompts() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const allText = useMemo(() => buildAllPanelPrompts(project), [project]);
  const totalPanels = (project.pagesList || []).reduce((s, p) => s + (p.panels?.length || 0), 0);

  if (!(project.pagesList || []).length) {
    return (
      <Layout>
        <div className="page">
          <PageHeader eyebrow="Panel Prompts" title="Per-panel image prompts" />
          <EmptyState
            icon={ImageIcon}
            title="No pages yet"
            body="Build pages first, then this view will produce ready-to-paste prompts for every panel."
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Panel Prompt Generator"
          title={`${totalPanels} prompts ready`}
          subtitle="Every panel’s prompt is built from the style, world, character bible, and panel notes."
          right={<CopyButton text={allText} label="Copy all" className="btn-gold" />}
        />

        <div className="space-y-4">
          {project.pagesList.map(pg => (
            <div key={pg.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Page {pg.number}</div>
                  <div className="font-display font-semibold text-paper">{pg.summary || '—'}</div>
                </div>
                <span className="chip">{pg.panels?.length || 0} panels</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {(pg.panels || []).map(pn => (
                  <PromptCard
                    key={pn.id}
                    eyebrow={`Page ${pg.number} · Panel ${pn.number} · ${pn.cameraAngle || 'shot'}`}
                    title={pn.action ? truncate(pn.action, 80) : 'Untitled action'}
                    prompt={pn.prompt || panelPrompt({
                      style: project.style,
                      action: pn.action,
                      setting: pn.background || project.world?.location,
                      cameraAngle: pn.cameraAngle, lighting: pn.lighting, emotion: pn.emotion,
                      palette: project.world?.palette,
                      characterBible: characterBibleLine(project.characters?.[0]),
                      textPlacement: pn.dialogue ? 'dialogue balloons / captions' : null,
                      negative: pn.negative,
                    })}
                    accent="electric"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
