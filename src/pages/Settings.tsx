import { useState, useEffect } from 'react';
import { Save, Zap, CheckCircle2, XCircle, Info } from 'lucide-react';
import { settingsDB } from '../lib/database';
import { getAIProviderLabel, isAIConfigured } from '../services/aiService';
import { useToast } from '../context/ToastContext';
import { PRICING_TIERS } from '../types';
import { formatCurrency } from '../utils/formatters';
import type { AppSettings } from '../types';

type FormState = Omit<AppSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    founder_name: 'Keith Warren',
    company_name: 'Winners Bookmark Agency',
    phone: '',
    website: '',
    business_email: '',
    business_address: '',
    default_signature: '',
    compliance_footer: 'If you prefer not to receive future emails from me, reply "opt out" and I will remove you from my list.',
    brand_footer: 'Designed by Winnersbookmark Incorporated',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = settingsDB.get();
    setForm({
      founder_name: s.founder_name,
      company_name: s.company_name,
      phone: s.phone,
      website: s.website,
      business_email: s.business_email,
      business_address: s.business_address,
      default_signature: s.default_signature,
      compliance_footer: s.compliance_footer,
      brand_footer: s.brand_footer,
    });
  }, []);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function updateSignature() {
    const sig = `${form.founder_name || 'Keith Warren'}\nFounder, ${form.company_name || 'Winners Bookmark Agency'}\n${form.phone || '[Phone Number]'}\n${form.website || '[Website]'}\n${form.business_address || '[Business Mailing Address]'}`;
    setForm(prev => ({ ...prev, default_signature: sig }));
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      settingsDB.save(form);
      toast('Settings saved', 'success');
    } finally {
      setSaving(false);
    }
  }

  const aiConfigured = isAIConfigured();
  const aiLabel = getAIProviderLabel();

  return (
    <div className="max-w-3xl mx-auto pb-16 fade-in">
      <div className="mb-6">
        <p className="eyebrow">Configuration</p>
        <h1 className="display-title text-paper">Settings</h1>
        <p className="text-mist text-sm mt-1">Agency info, signature, compliance footer, and AI configuration.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Agency Info */}
        <div className="glass p-5 space-y-4">
          <h2 className="section-title">Agency Info</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Founder Name</label>
              <input type="text" value={form.founder_name} onChange={e => set('founder_name', e.target.value)} placeholder="Keith Warren" />
            </div>
            <div>
              <label className="label">Company Name</label>
              <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Winners Bookmark Agency" />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(813) 555-0000" />
            </div>
            <div>
              <label className="label">Website</label>
              <input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://winnersbookmark.com" />
            </div>
            <div>
              <label className="label">Business Email</label>
              <input type="email" value={form.business_email} onChange={e => set('business_email', e.target.value)} placeholder="keith@winnersbookmark.com" />
            </div>
          </div>
          <div>
            <label className="label">
              Business Mailing Address{' '}
              <span className="text-danger">* Required for compliance</span>
            </label>
            <textarea
              value={form.business_address}
              onChange={e => set('business_address', e.target.value)}
              placeholder="123 Main St, Tampa, FL 33601"
              rows={2}
            />
            {!form.business_address && (
              <p className="text-danger text-xs mt-1 flex items-center gap-1">
                <XCircle size={12} /> Business address is required before any email can be approved.
              </p>
            )}
          </div>
        </div>

        {/* Signature */}
        <div className="glass p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Default Email Signature</h2>
            <button type="button" onClick={updateSignature} className="btn-ghost text-xs px-3 py-1.5">
              Auto-fill from above
            </button>
          </div>
          <textarea
            value={form.default_signature}
            onChange={e => set('default_signature', e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
        </div>

        {/* Compliance */}
        <div className="glass p-5 space-y-4">
          <h2 className="section-title">Compliance Footer</h2>
          <div>
            <label className="label">Opt-Out Line (added to every email)</label>
            <textarea value={form.compliance_footer} onChange={e => set('compliance_footer', e.target.value)} rows={2} />
          </div>
          <div>
            <label className="label">Brand Footer</label>
            <input type="text" value={form.brand_footer} onChange={e => set('brand_footer', e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn-gold w-full justify-center" disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>

      {/* AI Provider Status */}
      <div className="glass p-5 mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-gold" />
          <h2 className="section-title">AI Provider Status</h2>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium ${aiConfigured ? 'text-success' : 'text-gold'}`}>
          {aiConfigured ? <CheckCircle2 size={16} /> : <Info size={16} />}
          {aiLabel}
        </div>
        {!aiConfigured && (
          <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 space-y-2">
            <p className="text-sm text-chalk font-medium">Running in Demo Mode</p>
            <p className="text-xs text-mist leading-relaxed">
              The app is fully functional with realistic mock AI data. To enable live AI generation, create a <code className="text-gold bg-ink-card px-1.5 py-0.5 rounded">.env</code> file in the project root with one of:
            </p>
            <pre className="text-xs text-paper bg-ink-card2 rounded-lg p-3 overflow-x-auto">
{`VITE_GEMINI_API_KEY=your_key_here
VITE_AI_PROVIDER=gemini

# or for OpenAI:
VITE_OPENAI_API_KEY=your_key_here
VITE_AI_PROVIDER=openai`}
            </pre>
          </div>
        )}
      </div>

      {/* Pricing Reference */}
      <div className="glass p-5 mt-6 space-y-4">
        <h2 className="section-title">Pricing Tiers Reference</h2>
        <div className="space-y-3">
          {(Object.entries(PRICING_TIERS) as [string, typeof PRICING_TIERS[keyof typeof PRICING_TIERS]][]).map(([key, tier]) => (
            <div key={key} className="bg-ink-card/50 rounded-xl p-4 border border-ink-line">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-paper text-sm">{tier.name}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {tier.features.map(f => (
                      <li key={f} className="text-xs text-mist flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gold/60" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-gold font-bold text-sm">{formatCurrency(tier.setup)} setup</p>
                  <p className="text-gold-light text-sm font-semibold">{formatCurrency(tier.monthly)}/mo</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10">
        <p className="text-[11px] text-ghost">Designed by Winnersbookmark Incorporated</p>
      </div>
    </div>
  );
}
