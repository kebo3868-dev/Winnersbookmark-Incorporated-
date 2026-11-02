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

/**
 * Something an automation is: the product, the technique, or what it does.
 * "AI Discovery Audit" is removed before this is tested — it is the
 * validation service, not an automation.
 */
const AUTOMATION_SUBJECT =
  /\b(AI|A\.I\.|automation|automations|automated|automate|automating|Front Desk|chatbot|chat bot|bot|voice (answering|receptionist|agent|assistant)|receptionist|text-back|missed-call|intake|reactivation|virtual (receptionist|assistant|agent)|answering service)\b/i;
/** Not an automation: the validation service, and descriptions of the summary or audit itself. */
const VALIDATION_SERVICE = /\bAI Discovery Audit\b|\bAI[- ](enhanced|generated|written|assisted (audit|analysis|summary|review))\b/gi;
/**
 * A sentence that refers back to something named earlier ("Put it in place",
 * "They should install one") — the second half of a recommendation split
 * across sentences.
 */
const BACK_REFERENCE = /\b(it|its|this|that|these|those|they|them|one|the (system|tool|product|service|platform|solution|assistant|receptionist))\b/i;
/**
 * Recommending, adopting or crowning it — active, passive or softened. Kept
 * broad on purpose: a false positive costs only the fallback to the
 * deterministic summary.
 */
const RECOMMENDS =
  /\b(deploy\w*|install\w*|implement\w*|adopt\w*|roll(s|ed|ing)? (it |them )?out|rollout|launch\w*|introduc\w*|put (it |them |one )?in place|set (it |them |one )?up|bring(s|ing)? (it |them |one )?(on|in)|brought (on|in)|switch(es|ed|ing)? (to|on|over)|mov(e|es|ed|ing) to|upgrad\w* to|turn(s|ed|ing)? on|sign(s|ed|ing)? up|subscrib\w*|purchas\w*|buy(s|ing)?|go(es|ing)? live|get(s|ting)? (an?|the) |add(s|ed|ing)? (an?|the) |us(e|es|ing) (an?|the) |benefit\w* from|invest\w* in|recommend\w*|(suggest|advis|propos|urg)\w* (an?|the|that|it|them|adding|using|installing|getting|switching|moving|piloting|trying)|go(es|ing)? with|went with|opt(s|ed|ing)? for|choos\w*|chose\w*|select\w*|pick(s|ed|ing)?|rel(y|ies|ied|ying) on|lean(s|ed|ing)? on|onboard\w*|pilot\w*|trial\w*|try(ing)? (out )?(an?|the|it)|makes? sense|is what|is (worth|needed)|needs? (it|one|an?|the))\b|\bis (the|a|an|your) (right|matched|best|ideal|perfect|obvious|clear|recommended|natural|proven|smart|sensible|logical) (fix|solution|answer|choice|tool|system|next step|move|option|investment)\b|\b(would|will|could) be (a|an) (good|great|ideal|smart|strong|valuable|worthwhile|sensible) (fit|addition|investment|choice|solution|step|option)\b|\b(should|must|need(s)? to|ought to|has to|have to) be \w+(ed|en|t)\b|\b(should|must|need(s)? to|ought to|has to|have to) (use|get|add|have|consider|start|run)\b/i;
/**
 * A promised or implied result — never acceptable, gated or not: no outcome
 * has been measured. Includes softened forms ("would likely solve", "could
 * help reduce missed inquiries").
 */
const OUTCOME_CLAIM =
  /\b(will|would|could|can|might|may|should|is likely to|are likely to|is expected to|are expected to)\s+(likely\s+|probably\s+|certainly\s+|help\s+(to\s+)?)?(stop|solve|eliminate|end|prevent|recover|capture|win back|bring back|answer every|resolve)\b|\b(will|would|could|can|might|may|should|is likely to|is expected to)\s+(likely\s+|probably\s+|help\s+(to\s+)?)?(reduce|cut|increase|boost|improve|raise|lift|double|grow|save)\b[^.]{0,40}\b(missed|lost|unanswered|dropped|calls|inquir\w*|orders|revenue|bookings|sales|conversions?|guests?)\b|\b(stops?|eliminates?|prevents?|recovers?|ends?|solves?) (the )?(missed|lost|unanswered|dropped|phone)\b|\bguarantee\w*\b|\bnever miss\b|\bno (single )?(call|calls|inquir\w*|guest|guests|order|orders|booking|bookings)\b[^.]{0,30}\b(would|will|could)\b[^.]{0,20}\b(go|be|get)\b[^.]{0,10}\b(unanswered|missed|lost|dropped)\b|\bhelp(s|ed|ing)? (with|against|reduce|cut|stop|fix|solve|prevent)\b[^.]{0,30}\b(missed|lost|unanswered|dropped)\b/i;

/** Evidence of measurable demand in the restaurant's own operating records. */
function namesRecordedDemand(sentence: string): boolean {
  return /\b(records?|logs?|operating data|call data|booking data|inquiry data)\b/i.test(sentence) &&
    /\b(demand|volume)\b/i.test(sentence) &&
    /\b(confirm\w*|show\w*|demonstrat\w*|evidenc\w*|measur\w*|prov(e|es|en))\b/i.test(sentence);
}

/**
 * A sentence that carries the whole gate, every part of it: conditional
 * ("only after / only if / only once"); measurable demand shown in the
 * restaurant's own records; the product's own readiness and safety tests; the
 * owner's approval; and a limited, monitored pilot. Missing any one part, the
 * sentence is not gated.
 */
function carriesGate(sentence: string): boolean {
  return /\bonly (after|if|once|when)\b/i.test(sentence) &&
    namesRecordedDemand(sentence) &&
    /\breadiness and safety\b/i.test(sentence) &&
    /\bapprov\w*/i.test(sentence) &&
    /\blimited, monitored pilot\b/i.test(sentence);
}

export interface SummaryScreen {
  safe: boolean;
  /** The sentences that failed, for the operator log. */
  unsafe: string[];
}

/**
 * An explicit non-recommendation: the negation applies to proposing,
 * recommending or authorising automation — "No automation change is proposed
 * …", "… is not recommended until …", "We do not recommend …". A bare "no" or
 * "not" is not one: "No alternative beats the AI Front Desk." negates the
 * competition, not the recommendation.
 */
const DISCLAIMER =
  /\bno (automation|AI|pilot)( (change|product|system|tool|purchase))? (is|are|has been|was|will be) (currently |yet )?(proposed|recommended|authori[sz]ed|justified|warranted|planned)\b|\b(is|are) not (currently |yet )?(proposed|recommended|authori[sz]ed|justified|warranted)\b|\b(we )?do(es)? not (recommend|propose)\b|\bno automation change\b/gi;
/** Praise or comparison that recommends without a recommending verb. */
const ENDORSEMENT =
  /\b(beats?|beating|better|best|superior|outperform\w*|unmatched|unbeatable|unrivall?ed|ideal|perfect|must-have|essential|indispensable|game[- ]chang\w*|comes? close|second to none|top choice|clear choice|obvious choice|biggest risk|no-brainer)\b|\bno (alternative|substitute|competitor|rival|other (option|system|tool|product|choice))\b|\bnothing (beats|compares|matches|comes close)\b|\bonly (option|choice|solution|answer)\b|\bwithout an? (AI|automat\w*|Front Desk|receptionist|chatbot|bot)\b/i;
/** An instruction to act, or a modal that makes one. */
const DIRECTIVE =
  /\b(deploy\w*|install\w*|implement\w*|adopt\w*|roll(s|ed|ing)? (it |them )?out|rollout|launch\w*|put (it |them |one )?in place|set (it |them |one )?up|bring(s|ing)? (it |them |one )?(on|in)|brought (on|in)|switch(es|ed|ing)? (to|on|over)|mov(e|es|ed|ing) to|upgrad\w* to|turn(s|ed|ing)? on|sign(s|ed|ing)? up|subscrib\w*|purchas\w*|buy(s|ing)?|go(es|ing)? live|onboard\w*|go(es|ing)? with|opt(s|ed|ing)? for|choos\w*)\b|\b(should|must|need(s)? to|ought to|has to|have to)\b/i;
/** Hurry: a gated recommendation is never immediate. */
const IMMEDIACY =
  /\b(now|immediately|today|tomorrow|right away|straight away|at once|without delay|asap|as soon as possible|this (week|month|quarter|season|year)|next (week|month))\b/i;
/** A joint that attaches a second, separate instruction to a gated one. "but only after" is part of a gate. */
const CONTRAST =
  /\b(while|whereas|however|although|though|meanwhile|in the meantime|regardless|either way|in any case|anyway|instead|separately|on the other hand|so)\b|\bbut\b(?!\s+only\b)/i;

/**
 * A gated recommendation the gate actually governs: it carries the whole gate,
 * and nothing in it escapes the gate — no directive (install, deploy, set up,
 * should …), no immediacy (now, today, this week), no contrast joining a
 * second instruction ("…, while …", "…; however, …", "…, so install …"), and no
 * endorsement ("the ideal solution"). "Install the AI Front Desk now, while a
 * different automation may be considered only after …" carries every gate term
 * and is still an unconditional instruction; it is not gated.
 */
function gatedRecommendation(sentence: string): boolean {
  return carriesGate(sentence) && !DIRECTIVE.test(sentence) && !IMMEDIACY.test(sentence) &&
    !CONTRAST.test(sentence) && !ENDORSEMENT.test(sentence);
}

/**
 * An explicit non-recommendation that does nothing else: the disclaimer
 * phrase is present, and the rest of the sentence neither recommends, endorses,
 * hurries nor joins a second instruction.
 */
function explicitDisclaimer(sentence: string): boolean {
  if (!new RegExp(DISCLAIMER.source, 'i').test(sentence)) return false;
  const rest = sentence.replace(DISCLAIMER, ' ');
  return !RECOMMENDS.test(rest) && !ENDORSEMENT.test(sentence) && !IMMEDIACY.test(sentence) && !CONTRAST.test(sentence);
}

/**
 * Whether an AI-written summary may be shown to a client.
 *
 * FAIL CLOSED ON MENTION, NOT ON VERBS. A list of recommending verbs always
 * leaks ("we suggest", "go with", "is what this restaurant needs", "makes
 * sense"…), so a sentence that NAMES an automation is safe only if it is a
 * gated recommendation the gate actually governs (gatedRecommendation) or an
 * explicit non-recommendation that does nothing else (explicitDisclaimer).
 * Whatever its verb, any other mention is unsafe.
 *
 * Also unsafe: any promised or implied result, softened or absolute ("would
 * likely solve", "no call would go unanswered"); "is the matched fix"; and,
 * once the summary has named an automation, a later sentence that refers back
 * to it and recommends or endorses it ("Install it this month.", "Nothing
 * beats it.") unless it too is gated or a disclaimer.
 *
 * One unsafe sentence rejects the whole summary; the caller falls back to the
 * deterministic summary.
 */
export function screenAiSummary(text: string): SummaryScreen {
  const scrubbed = text.replace(VALIDATION_SERVICE, 'validation audit');
  const namesAutomation = AUTOMATION_SUBJECT.test(scrubbed);
  const sentences = scrubbed.split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);
  const unsafe = sentences.filter((s) => {
    if (OUTCOME_CLAIM.test(s) || /\bis the matched fix\b/i.test(s)) return true;
    if (gatedRecommendation(s) || explicitDisclaimer(s)) return false;
    if (AUTOMATION_SUBJECT.test(s)) return true;
    return namesAutomation && BACK_REFERENCE.test(s) && (RECOMMENDS.test(s) || ENDORSEMENT.test(s));
  });
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
