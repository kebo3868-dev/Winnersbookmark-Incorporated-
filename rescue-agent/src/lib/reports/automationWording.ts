/**
 * AN AUTOMATION IS NEVER "THE MATCHED FIX" IN A CLIENT REPORT.
 *
 * The audit engine stores a recommended solution with every finding, and the
 * client report printed it word for word. For the two automation findings the
 * stored text named a product as the answer, gated on demand alone:
 *
 *   phone     "…If that shows high repetitive volume, the Winnersbookmark AI
 *              Front Desk (…) is the matched fix."
 *   catering  "…If they show slow or missed responses, AI-assisted intake (…)
 *              is the matched fix; …"
 *
 * — and earlier engine versions pitched the product outright ("Winnersbookmark
 * AI Front Desk System: AI voice receptionist, …"). The same report's Decision
 * box and 30-day plan allow a pilot only after the records show the demand AND
 * the system passes its own readiness and safety tests, so the two said
 * different things.
 *
 * This rewrites that wording when a report is rendered, so audits already
 * stored read correctly without touching the stored records. Only the
 * recommendation changes: the observation, the validation step it opens with,
 * the category, classification, confidence and scores are untouched. The
 * conditions, in order: the records show the demand; the specific product
 * passes its own readiness and safety tests for this restaurant (named per
 * product); the owner approves; then a limited, monitored pilot.
 */

/** The gate, per product, as one clause completing "… may be worth a limited, monitored pilot — only after …". */
const PHONE_GATE =
  'it passes its own readiness and safety tests for this restaurant (answers on hours, menu and ordering checked against the ' +
  "restaurant's own information; missed-call text-back and transfer to staff tested) and the owner approves the pilot";
const CATERING_GATE =
  'the owner approves the intake questions and acknowledgment wording, every inquiry is verified to reach a named staff member, ' +
  'and the system passes its own readiness and safety tests with human escalation in place — and the owner approves the pilot';

const PHONE_CONDITIONAL =
  'If that shows high, repetitive call volume, the Winnersbookmark AI Front Desk (voice answering, missed-call text-back, FAQ ' +
  `automation, after-hours capture) may be worth a limited, monitored pilot — only after ${PHONE_GATE}. ` +
  'If it does not, this is not a problem worth solving.';
const CATERING_CONDITIONAL =
  'If they show slow or missed responses, AI-assisted inquiry intake (instant acknowledgment, structured intake, human handoff) ' +
  `may be worth a limited, monitored pilot — only after ${CATERING_GATE}. If they do not, no automation is needed here.`;
const RETENTION_CONDITIONAL =
  'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing gap, not a ' +
  'data gap. If it does not, a visible email/SMS capture offer is the starting point, and an AI Reactivation Campaign only ' +
  'becomes worth discussing once there is a list to reactivate.';

/**
 * Stored wording, current and historical, mapped to its conditional form. Each
 * entry replaces only the categorical part: an opening validation sentence
 * ("Before any system: pull 30 days of call records…") is kept as stored.
 */
const REWRITES: { category: RegExp; stored: RegExp; presented: string }[] = [
  // Phone — current engine.
  {
    category: /PHONE-DEPENDENT/i,
    stored:
      /If that shows high repetitive volume, the Winnersbookmark AI Front Desk \(voice answering, missed-call text-back, FAQ automation, after-hours capture\) is the matched fix\. If it does not, this is not a problem worth solving\./,
    presented: PHONE_CONDITIONAL,
  },
  // Phone — before 87d494a (both brand spellings).
  {
    category: /PHONE-DEPENDENT/i,
    stored:
      /^Winners ?[Bb]ookmark AI Front Desk System: AI voice receptionist, missed-call text-back, FAQ automation, and after-hours lead capture\. Validate call volume in a discovery call first\.$/,
    presented:
      'Before any system: pull 30 days of call records — total calls, unanswered calls, and the most common reasons. ' + PHONE_CONDITIONAL,
  },
  // Catering / private events — current engine.
  {
    category: /CATERING|PRIVATE/i,
    stored:
      /If they show slow or missed responses, AI-assisted intake \(instant acknowledgment, structured intake, human handoff\) is the matched fix; if they do not, no automation is needed here\./,
    presented: CATERING_CONDITIONAL,
  },
  // Catering — before d14e2b7.
  {
    category: /CATERING|PRIVATE/i,
    stored:
      /^AI-assisted lead capture and qualification for event inquiries \(instant acknowledgment, structured intake, human handoff\)\. Validate current response times in discovery\.$/,
    presented:
      'Before recommending any automation, collect acknowledgment records, response times and booking records for recent event inquiries. ' +
      CATERING_CONDITIONAL,
  },
  // Retention — before 87d494a ("then run an AI Reactivation Campaign").
  {
    category: /RETENTION/i,
    stored:
      /^Add a visible email\/SMS capture offer, then run an AI Reactivation Campaign once a list exists\. Verify in discovery whether an internal POS database already exists\.$/,
    presented: RETENTION_CONDITIONAL,
  },
];

/** The categorical phrase, wherever it survives (unknown stored variants, an AI-written summary). */
const MATCHED_FIX = /\bis the matched fix\b/gi;
const MATCHED_FIX_CONDITIONAL =
  'may be worth a limited, monitored pilot — only after the records confirm the demand, the system passes its own readiness ' +
  'and safety tests, and the owner approves the pilot';

/** Any remaining "is the matched fix", made conditional. */
export function presentAutomationClaims(text: string): string {
  return text.replace(MATCHED_FIX, MATCHED_FIX_CONDITIONAL);
}

// ── AI-written summaries: screened, not repaired ────────────────────────────
//
// An AI-written executive summary is free text. Rewriting one phrase in it
// ("is the matched fix") left every other way of saying the same thing in
// place: "we recommend deploying the AI Front Desk", "should be installed",
// "will stop missed calls". So a summary is screened instead, a sentence at a
// time, and an unsafe one is rejected whole: the report falls back to its
// deterministic, approved summary. A false positive costs nothing worse than
// that fallback; a false negative puts an unconditional product claim in front
// of a client.

/** Something an automation is: the product, the technique, or what it does. */
const AUTOMATION_SUBJECT =
  /\b(AI|automation|automations|automated|automate|automating|Front Desk|chatbot|bot|voice (answering|receptionist|agent)|text-back|intake|reactivation|virtual (receptionist|assistant))\b/i;
/** Doing it, or naming it the answer. */
const CATEGORICAL_ACTION =
  /\b(deploy\w*|install\w*|implement(s|ed|ing|ation)?|adopt\w*|roll(s|ed|ing)? out|rollout|launch\w*|introduc\w*|put (it )?in place|switch(es|ed|ing)? on|turn(s|ed|ing)? on|sign(s|ed|ing)? up for|subscrib\w* to|purchas\w*|buy(s|ing)?|go(es|ing)? live)\b|\bis (the|a|an|your) (right|matched|best|ideal|perfect|obvious|clear|recommended|natural|proven) (fix|solution|answer|choice|tool|system|next step)\b|\b(should|must|needs? to|ought to) (use|get|add|have|be (deployed|installed|implemented|adopted|added|used))\b/i;
/** A promised result — never acceptable, gated or not: no outcome has been measured. */
const OUTCOME_CLAIM =
  /\bwill (stop|eliminate|end|prevent|fix|solve|recover|capture|cut|reduce|increase|boost|double|bring back|win back|save|answer every)\b|\b(stops?|eliminates?|prevents?|recovers?|ends?) (missed|lost|unanswered|dropped)\b|\bguarantee\w*\b|\bnever miss\b/i;

/** A sentence that carries the whole gate: demand, readiness and safety, approval, a limited monitored pilot. */
function carriesGate(sentence: string): boolean {
  return /only (after|if|once)/i.test(sentence) && /readiness and safety/i.test(sentence) && /approv/i.test(sentence) && /monitored pilot/i.test(sentence);
}

export interface SummaryScreen {
  safe: boolean;
  /** The sentences that failed, for the operator log. */
  unsafe: string[];
}

/**
 * Whether an AI-written summary may be shown to a client. Unsafe: any promised
 * outcome, any "is the matched fix", and any sentence that both names an
 * automation and installs, deploys, adopts or crowns it — unless that sentence
 * carries the whole gate (only after demand, its own readiness and safety
 * tests, approval, and a limited, monitored pilot).
 */
export function screenAiSummary(text: string): SummaryScreen {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const unsafe = sentences.filter((s) =>
    OUTCOME_CLAIM.test(s) ||
    /\bis the matched fix\b/i.test(s) ||
    (AUTOMATION_SUBJECT.test(s) && CATEGORICAL_ACTION.test(s) && !carriesGate(s)));
  return { safe: unsafe.length === 0, unsafe };
}

/** The instruction the summary model is given about automation. */
export const AI_SUMMARY_AUTOMATION_RULE =
  'Never recommend installing, deploying, adopting or launching any automation or AI product, never call one the fix or the ' +
  'solution, and never promise a result (no "will stop missed calls"). An automation may only be mentioned as something to ' +
  'consider as a limited, monitored pilot, only after the restaurant\'s own records show the demand, the product passes its own ' +
  'readiness and safety tests, and the owner approves it.';

// ── Section 06: the gate, stated with every automation proposal ─────────────

/** For the Section 06 introduction. */
export const AUTOMATION_PROPOSAL_GATE =
  'Every automation here is a proposal only. Before any of them is used: your own records must show measurable demand for it; ' +
  'the product must pass its own readiness and safety tests for this restaurant; you must approve it explicitly; and it starts ' +
  'as a limited, monitored pilot, not a full roll-out.';

/** For each Section 06 card: what any implementation requires, completing "… requires …". */
export const AUTOMATION_CARD_REQUIREMENTS =
  'measurable demand in your own records, the product passing its own readiness and safety tests, your explicit approval, ' +
  'and a limited, monitored pilot first';

/**
 * A finding's stored recommended solution, as a client reads it. Known stored
 * wording for the automation findings becomes conditional on demand, the
 * product's own readiness and safety tests, and owner approval; any other
 * "is the matched fix" is made conditional too. Everything else is returned
 * unchanged.
 */
export function presentRecommendedSolution(category: string, text: string): string {
  let out = text;
  for (const rule of REWRITES) {
    if (rule.category.test(category) && rule.stored.test(out)) out = out.replace(rule.stored, rule.presented);
  }
  return presentAutomationClaims(out);
}

/** Tiers that are a product, not a validation step. */
const SYSTEM_TIER = /^AI (?!DISCOVERY)/i;

/** Stored tier rationales that state a product's effect as a fact, mapped to conditional wording. */
const RATIONALE_REWRITES: [RegExp, string][] = [
  [
    /^The evidence shows a phone-dependent journey with lead-capture gaps — exactly the friction the AI Front Desk System \(voice receptionist, missed-call text-back, FAQ automation, lead capture\) is built to absorb\.$/,
    'The public evidence raises open questions about phone and inquiry demand that the AI Front Desk System (voice receptionist, ' +
      'missed-call text-back, FAQ automation, lead capture) is designed for. It is a potential improvement, not a fix for a measured problem.',
  ],
  [/should confirm the demand before it is installed\./, 'should confirm the demand before any pilot is considered.'],
  [
    /^The dominant gap is customer retention and follow-up\. A reactivation campaign converts the existing customer base into repeat visits\.$/,
    'The dominant gap is customer retention and follow-up. A reactivation campaign is designed to bring past guests back; whether ' +
      'it would here depends on an existing guest list and on results in a monitored pilot.',
  ],
];

/**
 * The stored package recommendation, as a client reads it. A product tier
 * (AI Front Desk System, AI Reactivation Campaign) is recommended for
 * evaluation, not installation: a limited, monitored pilot only after the
 * records confirm the demand, the system passes its own readiness and safety
 * tests, and the owner approves. Validation tiers read as stored.
 */
export function presentTierRecommendation(tier: string, rationale: string): { lead: string; rationale: string } {
  let presented = rationale;
  for (const [stored, conditional] of RATIONALE_REWRITES) presented = presented.replace(stored, conditional);
  presented = presentAutomationClaims(presented);
  if (!SYSTEM_TIER.test(tier)) return { lead: `recommends ${tier} as the next step`, rationale: presented };
  return {
    lead:
      `recommends evaluating the ${tier} as the next step — as a limited, monitored pilot only after your records confirm the ` +
      'demand, the system passes its own readiness and safety tests for this restaurant, and you approve it',
    rationale: presented,
  };
}
