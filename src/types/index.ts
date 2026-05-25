export type CRMStage =
  | 'New Lead'
  | 'Researched'
  | 'Bottleneck Audit Created'
  | 'Email Drafted'
  | 'Email Approved'
  | 'Email Sent'
  | 'Follow-Up 1'
  | 'Follow-Up 2'
  | 'Discovery Call Booked'
  | 'Proposal Sent'
  | 'Trial Offered'
  | 'Trial Started'
  | 'Closed Won'
  | 'Closed Lost'
  | 'Do Not Contact';

export const CRM_STAGES: CRMStage[] = [
  'New Lead', 'Researched', 'Bottleneck Audit Created', 'Email Drafted',
  'Email Approved', 'Email Sent', 'Follow-Up 1', 'Follow-Up 2',
  'Discovery Call Booked', 'Proposal Sent', 'Trial Offered', 'Trial Started',
  'Closed Won', 'Closed Lost', 'Do Not Contact',
];

export type ScoreLabel = 'Low' | 'Medium' | 'High';
export type PricingTier = 'Essential' | 'Pro' | 'Anchor';
export type TrialStatus = 'Offered' | 'Accepted' | 'Active' | 'Completed' | 'Converted' | 'Not Converted';
export type FollowUpStatus = 'Scheduled' | 'Due Today' | 'Completed' | 'Skipped' | 'Do Not Contact';
export type EmailStatus = 'Draft' | 'Approved' | 'Sent';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

export interface Lead {
  id: string;
  user_id?: string;
  restaurant_name: string;
  owner_name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  cuisine: string;
  rating: number;
  review_count: number;
  lead_source: string;
  google_place_id: string;
  google_maps_url: string;
  has_online_ordering: YesNoUnknown;
  has_reservations: YesNoUnknown;
  has_catering_page: YesNoUnknown;
  has_contact_form: YesNoUnknown;
  bottleneck_score: number;
  score_label: ScoreLabel;
  main_bottleneck: string;
  top_bottlenecks: string[];
  recommended_offer: string;
  crm_stage: CRMStage;
  opt_out: boolean;
  notes: string;
  last_contacted_at: string;
  next_followup_at: string;
  created_at: string;
  updated_at: string;
}

export type LeadInput = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'bottleneck_score' | 'score_label' | 'crm_stage' | 'opt_out' | 'top_bottlenecks'>;

export interface Audit {
  id: string;
  user_id?: string;
  lead_id: string;
  digital_presence_score: number;
  customer_friction_score: number;
  revenue_capture_score: number;
  ai_opportunity_score: number;
  bottleneck_score: number;
  score_label: ScoreLabel;
  audit_summary: string;
  top_bottlenecks: string[];
  recommended_solution: string;
  estimated_revenue_leak: string;
  outreach_angle: string;
  confidence_level: ScoreLabel;
  missing_information: string[];
  next_best_action: string;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  user_id?: string;
  lead_id: string;
  subject: string;
  body: string;
  email_type: string;
  status: EmailStatus;
  approved_by_user: boolean;
  sent_at: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  user_id?: string;
  lead_id: string;
  followup_number: number;
  scheduled_date: string;
  followup_type: string;
  status: FollowUpStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Trial {
  id: string;
  user_id?: string;
  lead_id: string;
  trial_start_date: string;
  trial_end_date: string;
  trial_status: TrialStatus;
  features_included: string[];
  success_criteria: string[];
  conversion_status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  user_id?: string;
  founder_name: string;
  company_name: string;
  phone: string;
  website: string;
  business_email: string;
  business_address: string;
  default_signature: string;
  compliance_footer: string;
  brand_footer: string;
  created_at: string;
  updated_at: string;
}

export interface AuditResult {
  restaurant_name: string;
  bottleneck_score: number;
  score_label: ScoreLabel;
  digital_presence_score: number;
  customer_friction_score: number;
  revenue_capture_score: number;
  ai_opportunity_score: number;
  top_bottlenecks: string[];
  main_revenue_leak: string;
  recommended_ai_solution: string;
  recommended_pricing_tier: PricingTier;
  suggested_outreach_angle: string;
  audit_summary: string;
  confidence_level: ScoreLabel;
  missing_information: string[];
  next_best_action: string;
}

export interface EmailDraftResult {
  subject: string;
  body: string;
  email_type: string;
  cta: string;
  compliance_checks: {
    has_truthful_subject: boolean;
    has_opt_out: boolean;
    has_business_address: boolean;
    has_respectful_language: boolean;
    has_no_false_claims: boolean;
  };
}

export const PRICING_TIERS = {
  Essential: {
    name: 'Essential AI Front Desk',
    setup: 997,
    monthly: 750,
    features: [
      'Website chatbot & FAQ assistant',
      'Missed-call text-back',
      'Basic reservation / inquiry capture',
      'Weekly lead report',
    ],
  },
  Pro: {
    name: 'Pro Restaurant Growth System',
    setup: 1500,
    monthly: 1200,
    features: [
      'Everything in Essential',
      'Catering / private-party lead capture',
      'Review response assistant',
      'Email / DM triage',
      'Specials and event promotion workflow',
      'Monthly optimization call',
    ],
  },
  Anchor: {
    name: 'Anchor / Operations Partner',
    setup: 2500,
    monthly: 2000,
    features: [
      'Everything in Pro',
      'Custom workflow design',
      'Multi-location support',
      'Staff-facing AI assistant',
      'Event / party booking workflow',
      'Monthly bottleneck report',
      'Priority optimization',
    ],
  },
} as const;

export const TRIAL_FEATURES = [
  'FAQ chatbot demo',
  'Missed-call text-back demo',
  'Reservation / private-party inquiry capture demo',
  'Weekly missed-opportunity report',
];

export const TRIAL_SUCCESS_CRITERIA = [
  'More guest inquiries captured',
  'Faster response time',
  'Missed-call opportunities identified',
  'Reservation / private-party inquiries collected',
  'Staff pressure reduced',
  'Owner sees clear value',
];
