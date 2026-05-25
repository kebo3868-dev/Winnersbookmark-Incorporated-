import type { Lead, Audit, EmailDraft, FollowUp, Trial, AppSettings, CRMStage, ScoreLabel } from '../types';

const KEYS = {
  leads: 'rara_leads',
  audits: 'rara_audits',
  email_drafts: 'rara_email_drafts',
  followups: 'rara_followups',
  trials: 'rara_trials',
  settings: 'rara_settings',
};

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function getAll<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function setAll<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

export const leadsDB = {
  getAll(): Lead[] {
    return getAll<Lead>(KEYS.leads);
  },

  getById(id: string): Lead | undefined {
    return getAll<Lead>(KEYS.leads).find(l => l.id === id);
  },

  create(data: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Lead {
    const leads = getAll<Lead>(KEYS.leads);
    const lead: Lead = { ...data, id: uid(), created_at: now(), updated_at: now() };
    setAll(KEYS.leads, [...leads, lead]);
    return lead;
  },

  update(id: string, data: Partial<Omit<Lead, 'id' | 'created_at'>>): Lead | undefined {
    const leads = getAll<Lead>(KEYS.leads);
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return undefined;
    leads[idx] = { ...leads[idx], ...data, updated_at: now() };
    setAll(KEYS.leads, leads);
    return leads[idx];
  },

  updateStage(id: string, stage: CRMStage): Lead | undefined {
    return leadsDB.update(id, { crm_stage: stage });
  },

  updateScore(id: string, score: number, label: ScoreLabel, topBottlenecks: string[], mainBottleneck: string): Lead | undefined {
    return leadsDB.update(id, {
      bottleneck_score: score,
      score_label: label,
      top_bottlenecks: topBottlenecks,
      main_bottleneck: mainBottleneck,
    });
  },

  markOptOut(id: string): Lead | undefined {
    return leadsDB.update(id, { opt_out: true, crm_stage: 'Do Not Contact' });
  },

  delete(id: string): void {
    setAll(KEYS.leads, getAll<Lead>(KEYS.leads).filter(l => l.id !== id));
    auditsDB.deleteByLead(id);
    emailDraftsDB.deleteByLead(id);
    followupsDB.deleteByLead(id);
    trialsDB.deleteByLead(id);
  },
};

// ─── AUDITS ───────────────────────────────────────────────────────────────────

export const auditsDB = {
  getAll(): Audit[] {
    return getAll<Audit>(KEYS.audits);
  },

  getByLead(leadId: string): Audit[] {
    return getAll<Audit>(KEYS.audits).filter(a => a.lead_id === leadId);
  },

  getLatestByLead(leadId: string): Audit | undefined {
    const all = auditsDB.getByLead(leadId);
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  },

  create(data: Omit<Audit, 'id' | 'created_at'>): Audit {
    const audits = getAll<Audit>(KEYS.audits);
    const audit: Audit = { ...data, id: uid(), created_at: now() };
    setAll(KEYS.audits, [...audits, audit]);
    return audit;
  },

  deleteByLead(leadId: string): void {
    setAll(KEYS.audits, getAll<Audit>(KEYS.audits).filter(a => a.lead_id !== leadId));
  },
};

// ─── EMAIL DRAFTS ─────────────────────────────────────────────────────────────

export const emailDraftsDB = {
  getAll(): EmailDraft[] {
    return getAll<EmailDraft>(KEYS.email_drafts);
  },

  getByLead(leadId: string): EmailDraft[] {
    return getAll<EmailDraft>(KEYS.email_drafts).filter(d => d.lead_id === leadId);
  },

  getById(id: string): EmailDraft | undefined {
    return getAll<EmailDraft>(KEYS.email_drafts).find(d => d.id === id);
  },

  create(data: Omit<EmailDraft, 'id' | 'created_at' | 'updated_at'>): EmailDraft {
    const drafts = getAll<EmailDraft>(KEYS.email_drafts);
    const draft: EmailDraft = { ...data, id: uid(), created_at: now(), updated_at: now() };
    setAll(KEYS.email_drafts, [...drafts, draft]);
    return draft;
  },

  update(id: string, data: Partial<Omit<EmailDraft, 'id' | 'created_at'>>): EmailDraft | undefined {
    const drafts = getAll<EmailDraft>(KEYS.email_drafts);
    const idx = drafts.findIndex(d => d.id === id);
    if (idx === -1) return undefined;
    drafts[idx] = { ...drafts[idx], ...data, updated_at: now() };
    setAll(KEYS.email_drafts, drafts);
    return drafts[idx];
  },

  approve(id: string): EmailDraft | undefined {
    return emailDraftsDB.update(id, { status: 'Approved', approved_by_user: true });
  },

  markSent(id: string): EmailDraft | undefined {
    return emailDraftsDB.update(id, { status: 'Sent', sent_at: now() });
  },

  delete(id: string): void {
    setAll(KEYS.email_drafts, getAll<EmailDraft>(KEYS.email_drafts).filter(d => d.id !== id));
  },

  deleteByLead(leadId: string): void {
    setAll(KEYS.email_drafts, getAll<EmailDraft>(KEYS.email_drafts).filter(d => d.lead_id !== leadId));
  },
};

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

export const followupsDB = {
  getAll(): FollowUp[] {
    return getAll<FollowUp>(KEYS.followups);
  },

  getByLead(leadId: string): FollowUp[] {
    return getAll<FollowUp>(KEYS.followups).filter(f => f.lead_id === leadId);
  },

  create(data: Omit<FollowUp, 'id' | 'created_at' | 'updated_at'>): FollowUp {
    const followups = getAll<FollowUp>(KEYS.followups);
    const fu: FollowUp = { ...data, id: uid(), created_at: now(), updated_at: now() };
    setAll(KEYS.followups, [...followups, fu]);
    return fu;
  },

  update(id: string, data: Partial<Omit<FollowUp, 'id' | 'created_at'>>): FollowUp | undefined {
    const followups = getAll<FollowUp>(KEYS.followups);
    const idx = followups.findIndex(f => f.id === id);
    if (idx === -1) return undefined;
    followups[idx] = { ...followups[idx], ...data, updated_at: now() };
    setAll(KEYS.followups, followups);
    return followups[idx];
  },

  complete(id: string): FollowUp | undefined {
    return followupsDB.update(id, { status: 'Completed' });
  },

  delete(id: string): void {
    setAll(KEYS.followups, getAll<FollowUp>(KEYS.followups).filter(f => f.id !== id));
  },

  deleteByLead(leadId: string): void {
    setAll(KEYS.followups, getAll<FollowUp>(KEYS.followups).filter(f => f.lead_id !== leadId));
  },
};

// ─── TRIALS ───────────────────────────────────────────────────────────────────

export const trialsDB = {
  getAll(): Trial[] {
    return getAll<Trial>(KEYS.trials);
  },

  getByLead(leadId: string): Trial[] {
    return getAll<Trial>(KEYS.trials).filter(t => t.lead_id === leadId);
  },

  getById(id: string): Trial | undefined {
    return getAll<Trial>(KEYS.trials).find(t => t.id === id);
  },

  create(data: Omit<Trial, 'id' | 'created_at' | 'updated_at'>): Trial {
    const trials = getAll<Trial>(KEYS.trials);
    const trial: Trial = { ...data, id: uid(), created_at: now(), updated_at: now() };
    setAll(KEYS.trials, [...trials, trial]);
    return trial;
  },

  update(id: string, data: Partial<Omit<Trial, 'id' | 'created_at'>>): Trial | undefined {
    const trials = getAll<Trial>(KEYS.trials);
    const idx = trials.findIndex(t => t.id === id);
    if (idx === -1) return undefined;
    trials[idx] = { ...trials[idx], ...data, updated_at: now() };
    setAll(KEYS.trials, trials);
    return trials[idx];
  },

  delete(id: string): void {
    setAll(KEYS.trials, getAll<Trial>(KEYS.trials).filter(t => t.id !== id));
  },

  deleteByLead(leadId: string): void {
    setAll(KEYS.trials, getAll<Trial>(KEYS.trials).filter(t => t.lead_id !== leadId));
  },
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  founder_name: 'Keith Warren',
  company_name: 'Winners Bookmark Agency',
  phone: '',
  website: '',
  business_email: '',
  business_address: '',
  default_signature: 'Keith Warren\nFounder, Winners Bookmark Agency\n[Phone Number]\n[Website]\n[Business Mailing Address]',
  compliance_footer: 'If you prefer not to receive future emails from me, reply "opt out" and I will remove you from my list.',
  brand_footer: 'Designed by Winnersbookmark Incorporated',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const settingsDB = {
  get(): AppSettings {
    const all = getAll<AppSettings>(KEYS.settings);
    return all[0] || DEFAULT_SETTINGS;
  },

  save(data: Partial<AppSettings>): AppSettings {
    const current = settingsDB.get();
    const updated: AppSettings = { ...current, ...data, updated_at: now() };
    setAll(KEYS.settings, [updated]);
    return updated;
  },
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────

export function seedDemoData(): void {
  if (leadsDB.getAll().length > 0) return;

  const demos: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      restaurant_name: "Tony's Tampa Grille",
      owner_name: 'Tony Marchetti',
      city: 'Tampa',
      address: '1234 Kennedy Blvd, Tampa, FL 33609',
      phone: '8135550101',
      email: 'info@tonystampgrille.com',
      website: 'https://tonystampgrille.com',
      cuisine: 'Italian',
      rating: 4.2,
      review_count: 187,
      lead_source: 'Google Search',
      google_place_id: '',
      google_maps_url: '',
      has_online_ordering: 'no',
      has_reservations: 'no',
      has_catering_page: 'no',
      has_contact_form: 'yes',
      bottleneck_score: 72,
      score_label: 'High',
      main_bottleneck: 'No online ordering or reservation system — high revenue capture opportunity',
      top_bottlenecks: [
        'No online ordering — potential revenue loss during off-hours',
        'No reservation system — guests must call during busy hours',
        'No catering page — private event inquiries may be lost',
      ],
      recommended_offer: 'Pro Restaurant Growth System',
      crm_stage: 'Researched',
      opt_out: false,
      notes: 'Popular local spot. Owner is active on social media. Good candidate for the pilot.',
      last_contacted_at: '',
      next_followup_at: '',
    },
    {
      restaurant_name: 'Sunrise Diner St. Pete',
      owner_name: 'Maria Sandoval',
      city: 'St. Petersburg',
      address: '567 Central Ave, St. Petersburg, FL 33701',
      phone: '7275550234',
      email: '',
      website: 'https://sunrisediner-stpete.com',
      cuisine: 'American',
      rating: 4.5,
      review_count: 312,
      lead_source: 'Referral',
      google_place_id: '',
      google_maps_url: '',
      has_online_ordering: 'yes',
      has_reservations: 'no',
      has_catering_page: 'no',
      has_contact_form: 'no',
      bottleneck_score: 58,
      score_label: 'Medium',
      main_bottleneck: 'No reservation or catering page despite high review volume',
      top_bottlenecks: [
        'No reservation system for a 300+ review restaurant',
        'No catering or private party page',
        'No public contact email found',
      ],
      recommended_offer: 'Essential AI Front Desk',
      crm_stage: 'New Lead',
      opt_out: false,
      notes: 'Very high review count. Likely very busy. Missed-call text-back could be valuable.',
      last_contacted_at: '',
      next_followup_at: '',
    },
    {
      restaurant_name: 'Bay Breeze Seafood',
      owner_name: 'James Okafor',
      city: 'Clearwater',
      address: '890 Gulf Blvd, Clearwater, FL 33767',
      phone: '7275550789',
      email: 'contact@baybreeze.com',
      website: 'https://baybreezeseafood.com',
      cuisine: 'Seafood',
      rating: 4.7,
      review_count: 521,
      lead_source: 'Google Maps',
      google_place_id: '',
      google_maps_url: '',
      has_online_ordering: 'yes',
      has_reservations: 'yes',
      has_catering_page: 'no',
      has_contact_form: 'yes',
      bottleneck_score: 64,
      score_label: 'Medium',
      main_bottleneck: 'Missing catering/private event page for high-value revenue stream',
      top_bottlenecks: [
        'No catering or private party inquiry page — major revenue opportunity',
        'High volume restaurant likely experiencing missed calls during peak hours',
        'Review response workflow not automated',
      ],
      recommended_offer: 'Pro Restaurant Growth System',
      crm_stage: 'Bottleneck Audit Created',
      opt_out: false,
      notes: 'One of the top-rated seafood spots in the area. Great candidate for the Pro tier.',
      last_contacted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      next_followup_at: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    },
  ];

  demos.forEach(d => leadsDB.create(d));
}
