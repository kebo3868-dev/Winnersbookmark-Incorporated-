import { useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ProjectGuard from '../components/ProjectGuard';
import CopyButton from '../components/CopyButton';
import { Download, FileText, Code2, BookOpen, Image as ImageIcon, BookCopy, ListChecks, Share2, Upload } from 'lucide-react';
import { buildExportPayload, downloadText } from '../lib/exports';
import { useStudio } from '../context/StudioContext';

export default function ExportCenter() {
  return <ProjectGuard>{({ project }) => <Inner project={project} />}</ProjectGuard>;
}

function Inner({ project }) {
  const payload = useMemo(() => buildExportPayload(project), [project]);
  const fileRef = useRef(null);
  const { replaceProject } = useStudio();

  const slug = (project.title || 'comic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const items = [
    { id: 'script',    title: 'Full Comic Script',   desc: 'Markdown — pages, panels, dialogue, captions.', icon: FileText,  text: payload.script,    file: `${slug}-script.md` },
    { id: 'bible',     title: 'Character Bible',     desc: 'Markdown — every character with portrait prompt.', icon: BookOpen, text: payload.bible,    file: `${slug}-character-bible.md` },
    { id: 'prompts',   title: 'Image Prompts',       desc: 'Plaintext — every panel’s image generation prompt.', icon: ImageIcon, text: payload.prompts,  file: `${slug}-panel-prompts.txt` },
    { id: 'outline',   title: 'Page-by-Page Outline',desc: 'Plaintext — pacing outline.',                icon: FileText, text: payload.outline,   file: `${slug}-outline.txt` },
    { id: 'cover',     title: 'Cover Prompt',        desc: 'Plaintext — final cinematic cover prompt.',  icon: BookCopy, text: payload.cover,     file: `${slug}-cover.txt` },
    { id: 'checklist', title: 'Publishing Checklist',desc: 'Markdown — launch-ready checklist.',         icon: ListChecks, text: payload.checklist, file: `${slug}-checklist.md` },
    { id: 'social',    title: 'Social Media Promo',  desc: 'Captions, hashtags, scripts, voiceover.',    icon: Share2,    text: payload.social,    file: `${slug}-social-kit.md` },
    { id: 'json',      title: 'JSON Project File',   desc: 'Machine-readable — back up or move between devices.', icon: Code2,  text: payload.json,      file: `${slug}.json` },
  ];

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.id) throw new Error('Missing project id');
      replaceProject({ ...data, id: project.id });
      alert('Project imported and replaced.');
    } catch (err) {
      alert('Could not import file: ' + err.message);
    }
    e.target.value = '';
  };

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Export Center"
          title="Ship the comic out of the studio"
          subtitle="Copy or download every artifact you need to publish, pitch, or hand to an artist."
          right={
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} className="btn-ghost text-sm"><Upload size={14}/> Import JSON</button>
              <input type="file" accept="application/json" ref={fileRef} onChange={importJson} hidden />
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-3">
          {items.map(it => (
            <div key={it.id} className="glass card-pad">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold-light flex items-center justify-center shrink-0">
                    <it.icon size={16}/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-paper">{it.title}</div>
                    <div className="text-mist text-xs">{it.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CopyButton text={it.text} />
                  <button onClick={() => downloadText(it.file, it.text)} className="btn-ghost text-xs">
                    <Download size={14}/> Download
                  </button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-chalk font-sans bg-ink-card2/70 border border-ink-line rounded-lg p-3 max-h-[220px] overflow-auto">
                {it.text || '— empty —'}
              </pre>
            </div>
          ))}
        </div>

        <div className="glass card-pad mt-6 text-sm">
          <div className="eyebrow mb-2">PDF / Canva / Drive</div>
          <p className="text-mist">
            For PDF, paste the script Markdown into any Markdown-to-PDF tool (e.g. Pandoc, Typora, or print from a browser). For Canva and Google Drive, copy the
            social and cover prompts directly — full API exports are queued on the integration roadmap.
          </p>
        </div>
      </div>
    </Layout>
  );
}
