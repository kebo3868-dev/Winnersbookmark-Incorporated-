import { useMemo, useState } from 'react';
import { Plus, Trash2, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import EmptyState from '../components/EmptyState';
import PromptCard from '../components/PromptCard';
import { Field } from '../components/Field';
import { useStudio, newPage, newPanel } from '../context/StudioContext';
import { CAMERA_ANGLES, LIGHTING } from '../data/options';
import { panelPrompt, characterBibleLine } from '../lib/prompts';

export default function PageBuilder() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const { updateActive } = useStudio();
  const [openPage, setOpenPage] = useState(project.pagesList?.[0]?.id || null);

  const addPage = () => {
    const nextNumber = (project.pagesList?.length || 0) + 1;
    const pg = newPage(nextNumber, project.panelsPerPage || 5);
    const pagesList = [...(project.pagesList || []), pg];
    updateActive({ pagesList });
    setOpenPage(pg.id);
  };

  const removePage = (id) => {
    if (!confirm('Delete this page?')) return;
    const pagesList = (project.pagesList || []).filter(p => p.id !== id).map((p, i) => ({ ...p, number: i + 1 }));
    updateActive({ pagesList });
  };

  const patchPage = (id, p) => {
    const pagesList = (project.pagesList || []).map(pg => pg.id === id ? { ...pg, ...p } : pg);
    updateActive({ pagesList });
  };

  const addPanel = (pageId) => {
    const pagesList = project.pagesList.map(pg => {
      if (pg.id !== pageId) return pg;
      const next = newPanel((pg.panels?.length || 0) + 1);
      return { ...pg, panels: [...(pg.panels || []), next] };
    });
    updateActive({ pagesList });
  };

  const removePanel = (pageId, panelId) => {
    const pagesList = project.pagesList.map(pg => {
      if (pg.id !== pageId) return pg;
      const panels = pg.panels.filter(pn => pn.id !== panelId).map((pn, i) => ({ ...pn, number: i + 1 }));
      return { ...pg, panels };
    });
    updateActive({ pagesList });
  };

  const patchPanel = (pageId, panelId, p) => {
    const pagesList = project.pagesList.map(pg => {
      if (pg.id !== pageId) return pg;
      const panels = pg.panels.map(pn => pn.id === panelId ? { ...pn, ...p } : pn);
      return { ...pg, panels };
    });
    updateActive({ pagesList });
  };

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Page Builder"
          title="Lay out the comic, panel by panel"
          subtitle="Each panel becomes a publish-ready image prompt with negative prompt locked in."
          right={<button onClick={addPage} className="btn-gold"><Plus size={16}/> Add Page</button>}
        />

        {(project.pagesList || []).length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No pages yet"
            body="Start with page 1. Each new page is created with your project’s panel-per-page count."
            action={<button onClick={addPage} className="btn-gold"><Plus size={16}/> Add Page 1</button>}
          />
        ) : (
          <div className="space-y-3">
            {project.pagesList.map(pg => {
              const open = openPage === pg.id;
              return (
                <div key={pg.id} className="glass">
                  <button
                    type="button"
                    onClick={() => setOpenPage(open ? null : pg.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-electric/10 border border-electric/30 text-electric-glow flex items-center justify-center font-comic">
                        {pg.number}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-paper">Page {pg.number}</div>
                        <div className="text-xs text-mist truncate">{pg.summary || 'No summary yet'} · {pg.panels?.length || 0} panels</div>
                      </div>
                    </div>
                    {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>

                  {open && (
                    <div className="px-4 pb-5 space-y-4 slide-up">
                      <Field label="Scene summary">
                        <input value={pg.summary} onChange={e => patchPage(pg.id, { summary: e.target.value })}
                          placeholder="Hero arrives at the rooftop and sees the city for the first time as it really is." />
                      </Field>

                      <div className="space-y-3">
                        {(pg.panels || []).map(pn => (
                          <Panel
                            key={pn.id}
                            project={project}
                            page={pg}
                            panel={pn}
                            onPatch={(p) => patchPanel(pg.id, pn.id, p)}
                            onRemove={() => removePanel(pg.id, pn.id)}
                          />
                        ))}
                      </div>

                      <div className="flex justify-between pt-2">
                        <button onClick={() => addPanel(pg.id)} className="btn-ghost text-sm"><Plus size={14}/> Add panel</button>
                        <button onClick={() => removePage(pg.id)} className="btn-ghost text-mist hover:!text-danger text-xs">
                          <Trash2 size={13}/> Delete page
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Panel({ project, page, panel, onPatch, onRemove }) {
  const generated = useMemo(() => panelPrompt({
    style: project.style,
    action: panel.action,
    setting: panel.background || project.world?.location,
    cameraAngle: panel.cameraAngle,
    lighting: panel.lighting,
    emotion: panel.emotion,
    palette: project.world?.palette,
    composition: 'rule-of-thirds with strong silhouette',
    cinematic: project.tone,
    textPlacement: panel.dialogue ? 'dialogue balloons / captions' : null,
    negative: panel.negative,
    characterBible: characterBibleLine(project.characters?.[0]),
  }), [project, panel]);

  return (
    <div className="rounded-xl border border-ink-line bg-ink-card/40 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chip-gold font-comic">PANEL {panel.number}</span>
          <span className="chip">{panel.cameraAngle || 'no shot'}</span>
        </div>
        <button onClick={onRemove} className="btn-ghost text-xs text-mist hover:!text-danger"><Trash2 size={12}/></button>
      </div>

      <div className="field-row">
        <Field label="Camera angle">
          <select value={panel.cameraAngle} onChange={e => onPatch({ cameraAngle: e.target.value })}>
            <option value="">Choose</option>
            {CAMERA_ANGLES.map(a => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Lighting">
          <select value={panel.lighting} onChange={e => onPatch({ lighting: e.target.value })}>
            <option value="">Choose</option>
            {LIGHTING.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Emotional tone">
          <input value={panel.emotion} onChange={e => onPatch({ emotion: e.target.value })} placeholder="Tense, defiant, brittle…" />
        </Field>
        <Field label="Background">
          <input value={panel.background} onChange={e => onPatch({ background: e.target.value })} placeholder="Rain-slick rooftop, neon underlight" />
        </Field>
      </div>

      <Field label="Character action">
        <textarea value={panel.action} onChange={e => onPatch({ action: e.target.value })}
          placeholder="Aaron steps to the ledge, hands open, refusing to fall." />
      </Field>

      <div className="field-row">
        <Field label="Dialogue (one line per balloon)">
          <textarea value={panel.dialogue} onChange={e => onPatch({ dialogue: e.target.value })}
            placeholder={`AARON: "Tell them I jumped."\nVOICE: "They already know."`} />
        </Field>
        <Field label="Caption boxes">
          <textarea value={panel.captions} onChange={e => onPatch({ captions: e.target.value })}
            placeholder="Three blocks east of the only home he’d ever known…" />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Sound effects (SFX)">
          <input value={panel.sfx} onChange={e => onPatch({ sfx: e.target.value })} placeholder="BWOOM · KRAK · whump" />
        </Field>
        <Field label="Continuity notes">
          <input value={panel.continuity} onChange={e => onPatch({ continuity: e.target.value })} placeholder="Ring on right hand · costume torn on left shoulder" />
        </Field>
      </div>

      <Field label="Negative prompt (optional, appended to defaults)">
        <input value={panel.negative} onChange={e => onPatch({ negative: e.target.value })} placeholder="no extra cars in background, no daytime sky" />
      </Field>

      <PromptCard
        eyebrow={`Page ${page.number} · Panel ${panel.number}`}
        title="Image generation prompt"
        prompt={panel.prompt || generated}
        accent="electric"
        actions={
          <button onClick={() => onPatch({ prompt: generated })} className="btn-ghost text-xs">Regenerate</button>
        }
      />
    </div>
  );
}
