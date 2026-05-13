import { useRef } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { Field } from '../components/Field';
import { useStudio } from '../context/StudioContext';
import { Trash2, Download, Upload, AlertTriangle } from 'lucide-react';
import { downloadText } from '../lib/exports';

export default function Settings() {
  const { settings, updateSettings, projects, clearAll } = useStudio();
  const fileRef = useRef(null);

  const exportAll = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), settings, projects }, null, 2);
    downloadText(`winnersbookmark-cinecomic-backup-${Date.now()}.json`, payload);
  };

  const importAll = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.projects)) throw new Error('No projects array');
      if (!confirm(`Import ${data.projects.length} projects? This will replace your current library.`)) return;
      localStorage.setItem('winnersbookmark.cinecomic.v1', JSON.stringify({
        projects: data.projects,
        activeId: data.projects[0]?.id || null,
        settings: data.settings || settings,
      }));
      window.location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  };

  const wipe = () => {
    if (!confirm('Delete ALL projects and reset the studio? This cannot be undone.')) return;
    clearAll();
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <Layout>
      <div className="page max-w-2xl">
        <PageHeader
          eyebrow="Settings"
          title="Studio preferences"
          subtitle="Identity, backups, and danger zone."
        />

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Creator</div>
          <div className="field-row">
            <Field label="Creator name (shown in exports)">
              <input value={settings.creatorName} onChange={e => updateSettings({ creatorName: e.target.value })} placeholder="Your name or studio" />
            </Field>
            <Field label="Publisher mark (cover footer)">
              <input value={settings.publisherMark} onChange={e => updateSettings({ publisherMark: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="glass card-pad-lg accent-top mb-6">
          <div className="eyebrow mb-3">Backups</div>
          <p className="text-mist text-sm mb-3">Projects are saved on this device only. Export to JSON to back up or move to another device.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportAll} className="btn-gold"><Download size={16}/> Export full library</button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={14}/> Import backup</button>
            <input type="file" accept="application/json" ref={fileRef} onChange={importAll} hidden />
          </div>
        </div>

        <div className="glass card-pad-lg border-danger/30 mb-6">
          <div className="eyebrow mb-3 text-danger/90 flex items-center gap-2"><AlertTriangle size={12}/> Danger zone</div>
          <p className="text-mist text-sm mb-3">Erase every project, character, page, and prompt from this device. Cannot be recovered without a backup.</p>
          <button onClick={wipe} className="btn-ghost text-danger hover:!text-danger border-danger/40 hover:!border-danger">
            <Trash2 size={14}/> Reset studio
          </button>
        </div>

        <div className="glass card-pad text-xs text-mist">
          <div className="eyebrow mb-2">Future integrations</div>
          <p>
            The studio is built to plug into Supabase auth/database, Stripe subscriptions, Claude / OpenAI / Gemini APIs, image-generation APIs,
            and PDF / Canva / Drive exports. Project state is already JSON-serializable, so swapping localStorage for a remote sync layer is a single adapter.
          </p>
        </div>
      </div>
    </Layout>
  );
}
