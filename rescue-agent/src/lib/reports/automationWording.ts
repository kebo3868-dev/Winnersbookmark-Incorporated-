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

// ── AI-written summaries: authorised by grammar, not by keywords ───────────
//
// An AI-written executive summary is free text, so it is screened and an unsafe
// one is rejected whole: the report falls back to its deterministic, approved
// summary. A false positive costs nothing worse than that fallback; a false
// negative puts an unconditional product claim in front of a client.
//
// The earlier screen accepted a sentence as "gated" when the gate's KEYWORDS
// were present. Keywords are not conditions: "only after call records show no
// measurable demand", "its readiness and safety tests failed", "the owner has
// withheld approval", "industry records confirm the demand" and "the vendor
// approves" all carried them. Now a sentence about automation is acceptable only
// if it PARSES, completely, into one of two closed forms:
//
//   1. A gated proposal (parseGatedProposal):
//        [If <conditions>,] <subject> could|may|might be considered|evaluated|
//        worth … a limited, monitored pilot[, but] only after|if|once|when
//        <conditions>.
//      where the conditions, taken together, are exactly one each of
//        demand     <the restaurant's own | call/booking/inquiry …> records
//                   confirm|show|demonstrate|document [measurable] demand
//        readiness  it|the <product> passes its own readiness and safety tests
//        approval   the owner|you approve(s) [it|the pilot]
//      Each condition is matched as a whole clause against an affirmative
//      pattern. Anything a pattern does not cover — a negation, a failed or
//      incomplete test, withheld approval, industry or vendor records, vendor
//      approval, an extra clause, a trailing remark — does not parse, and a
//      sentence that does not parse is not authorised. That is the fail-closed
//      rule: the screen never decides that a condition is satisfied; it only
//      accepts the one sentence shape that keeps every condition open and
//      affirmative.
//   2. An explicit non-recommendation (parseDisclaimer): "No automation change
//      is proposed [until <conditions>]", "We do not recommend any automation
//      …", "<subject> is not recommended …" — nothing else in the sentence.
//
// Every other sentence that mentions an automation — by name ("AI Front Desk")
// or by description ("automatic telephone answering", "a digital telephone
// attendant", "calls picked up by software") — is unsafe, whatever its verb. A
// sentence that uses gate vocabulary without parsing is unsafe too. Each
// sentence is judged on its own, so a safe sentence (a disclaimer, a gated
// proposal) never authorises a separate one beside it.

/**
 * An automation named outright: the product, the technique or what it does.
 * "AI Discovery Audit" and self-descriptions are removed first (VALIDATION_SERVICE).
 */
const AUTOMATION_NAMED =
  /\b(AI|A\.I\.|automat\w*|Front Desk|chat ?bots?|bots?|robot\w*|robo\w*|IVR|auto[- ]?(attendants?|responders?|repl(y|ies)|answer\w*|text\w*|dial\w*)|autoresponders?|phone tree|voice (answering|receptionist|agent|assistant|bot|system|technology|AI)|receptionists?|text-back|missed-call|intake|reactivation|virtual (receptionists?|assistants?|agents?|hosts?|attendants?|concierges?|operators?|front desk)|answering (services?|systems?|software|machines?|technology|platforms?|solutions?|tools?)|machine learning|LLMs?|GPT|conversational)\b/i;

/** Technology that does a person's job in the conversation with a guest. */
const STRONG_TECH = String.raw`(?:automatic|automated|automatically|auto|robotic|unattended|self-service|hands-free|machines?|software|computer\w*|algorithm\w*)`;
/** Weaker qualifiers: technology only when attached to a role a person would fill. */
const WEAK_TECH = String.raw`(?:digital|virtual|electronic|smart|cloud|24\/7|always-on|round-the-clock|after-hours)`;
const COMMUNICATION = String.raw`(?:answer\w*|attendants?|receptionists?|hosts?|operators?|agents?|assistants?|phones?|telephon\w*|calls?|calling|callers?|lines?|repl(?:y|ies|ying)|respon\w*|inquir\w*|bookings?|reservations?|messag\w*|texts?|texting|follow-?ups?|intake|concierges?|switchboards?|voicemail|front desk|greet\w*|orders?|ordering)`;
const ROLE = String.raw`(?:answer\w*|attendants?|receptionists?|hosts?|operators?|agents?|assistants?|concierges?|front desk|switchboards?|greeters?|employees?|staff\w*|workers?|coverage)`;
const near = (a: string, b: string) => new RegExp(String.raw`\b${a}\b(?:\W+\w+){0,4}?\W+${b}\b|\b${b}\b(?:\W+\w+){0,4}?\W+${a}\b`, 'i');
const TECH_NEAR_COMMUNICATION = near(STRONG_TECH, COMMUNICATION);
const WEAK_TECH_NEAR_ROLE = near(WEAK_TECH, ROLE);
/** A guest conversation handled with no person in it. */
const WITHOUT_A_PERSON =
  /\b(answer|handl|pick|tak|respond|return|field|screen|rout|cover)\w*\b[^.;]{0,40}\b(without (a |any )?(staff|person|people|human|humans|employees?|hosts?)|by (software|a machine|machines|a system|technology|a computer|an app|an algorithm))\b/i;

/**
 * Whether a sentence is about an automation — named or described. Exported for
 * the Sales Brief screen (salesWording.ts), which uses the same definition.
 */
export function mentionsAutomation(sentence: string): boolean {
  return AUTOMATION_NAMED.test(sentence) || TECH_NEAR_COMMUNICATION.test(sentence) ||
    WEAK_TECH_NEAR_ROLE.test(sentence) || WITHOUT_A_PERSON.test(sentence);
}

/**
 * Not an automation: the validation service, and descriptions of the summary
 * or the audit itself ("AI-enhanced summary", "the automated audit", "the page
 * markup was read automatically").
 */
const VALIDATION_SERVICE =
  /\bAI Discovery Audit\b|\bAI[- ](enhanced|generated|written|assisted (audit|analysis|summary|review))\b|\bautomated (audit|analysis|check|checks|review|scan|crawl)\b|\b(read|checked|collected|analy[sz]ed|scanned|tested|detected|found) automatically\b/gi;

/** A text with self-descriptions of the audit and summary removed, before automation is looked for. */
export function withoutSelfDescription(text: string): string {
  return text.replace(VALIDATION_SERVICE, 'validation audit');
}
/**
 * A sentence that refers back to something named earlier ("Put it in place",
 * "They should install one") — the second half of a recommendation split
 * across sentences.
 */
const BACK_REFERENCE = /\b(it|its|this|that|these|those|they|them|one|the (system|tool|product|service|platform|solution|assistant|receptionist|attendant))\b/i;
/**
 * Recommending, adopting or crowning something — active, passive or softened.
 * Kept broad on purpose: a false positive costs only the fallback to the
 * deterministic summary.
 */
export const RECOMMENDS =
  /\b(deploy\w*|install\w*|implement\w*|adopt\w*|roll(s|ed|ing)? (it |them )?out|rollout|launch\w*|introduc\w*|put (it |them |one )?in place|set (it |them |one )?up|bring(s|ing)? (it |them |one )?(on|in)|brought (on|in)|switch(es|ed|ing)? (to|on|over)|mov(e|es|ed|ing) to|upgrad\w* to|turn(s|ed|ing)? on|sign(s|ed|ing)? up|subscrib\w*|purchas\w*|buy(s|ing)?|go(es|ing)? live|get(s|ting)? (an?|the) |add(s|ed|ing)? (an?|the) |us(e|es|ing) (an?|the) |benefit\w* from|invest\w* in|recommend\w*|(suggest|advis|propos|urg)\w* (an?|the|that|it|them|adding|using|installing|getting|switching|moving|piloting|trying)|go(es|ing)? with|went with|opt(s|ed|ing)? for|choos\w*|chose\w*|select\w*|pick(s|ed|ing)?|rel(y|ies|ied|ying) on|lean(s|ed|ing)? on|onboard\w*|pilot\w*|trial\w*|try(ing)? (out )?(an?|the|it)|makes? sense|is what|is (worth|needed)|needs? (it|one|an?|the))\b|\bis (the|a|an|your) (right|matched|best|ideal|perfect|obvious|clear|recommended|natural|proven|smart|sensible|logical) (fix|solution|answer|choice|tool|system|next step|move|option|investment|fit|match)\b|\b(would|will|could) be (a|an) (good|great|ideal|smart|strong|valuable|worthwhile|sensible) (fit|addition|investment|choice|solution|step|option)\b|\b(should|must|need(s)? to|ought to|has to|have to) be \w+(ed|en|t)\b|\b(should|must|need(s)? to|ought to|has to|have to) (use|get|add|have|consider|start|run)\b/i;
/**
 * A promised or implied result — never acceptable, gated or not: no outcome
 * has been measured. Includes softened forms ("would likely solve", "could
 * help reduce missed inquiries").
 */
const OUTCOME_CLAIM =
  /\b(will|would|could|can|might|may|should|is likely to|are likely to|is expected to|are expected to)\s+(likely\s+|probably\s+|certainly\s+|help\s+(to\s+)?)?(stop|solve|eliminate|end|prevent|recover|capture|win back|bring back|answer every|resolve)\b|\b(will|would|could|can|might|may|should|is likely to|is expected to)\s+(likely\s+|probably\s+|help\s+(to\s+)?)?(reduce|cut|increase|boost|improve|raise|lift|double|grow|save)\b[^.]{0,40}\b(missed|lost|unanswered|dropped|calls|inquir\w*|orders|revenue|bookings|sales|conversions?|guests?)\b|\b(stops?|eliminates?|prevents?|recovers?|ends?|solves?) (the )?(missed|lost|unanswered|dropped|phone)\b|\bguarantee\w*\b|\bnever miss\b|\bno (single )?(call|calls|inquir\w*|guest|guests|order|orders|booking|bookings)\b[^.]{0,30}\b(would|will|could)\b[^.]{0,20}\b(go|be|get)\b[^.]{0,10}\b(unanswered|missed|lost|dropped)\b|\bhelp(s|ed|ing)? (with|against|reduce|cut|stop|fix|solve|prevent)\b[^.]{0,30}\b(missed|lost|unanswered|dropped)\b/i;
/** Praise or comparison that recommends without a recommending verb. */
export const ENDORSEMENT =
  /\b(beats?|beating|better|best|superior|outperform\w*|unmatched|unbeatable|unrivall?ed|ideal|perfect|must-have|essential|indispensable|game[- ]chang\w*|comes? close|(right|good|great|strong|natural|perfect|ideal) (fit|match) for|second to none|top choice|clear choice|obvious choice|biggest risk|no-brainer)\b|\bno (alternative|substitute|competitor|rival|other (option|system|tool|product|choice))\b|\bnothing (beats|compares|matches|comes close)\b|\bonly (option|choice|solution|answer)\b|\bwithout an? (AI|automat\w*|Front Desk|receptionist|chatbot|bot)\b/i;
/** An instruction to act, or a modal that makes one. */
export const DIRECTIVE =
  /\b(deploy\w*|install\w*|implement\w*|adopt\w*|roll(s|ed|ing)? (it |them )?out|rollout|launch\w*|put (it |them |one |an? [\w-]+ ?[\w-]* )?in place|set (it |them |one )?up|bring(s|ing)? (it |them |one )?(on|in)|brought (on|in)|switch(es|ed|ing)? (to|on|over)|mov(e|es|ed|ing) to|upgrad\w* to|turn(s|ed|ing)? on|sign(s|ed|ing)? up|subscrib\w*|purchas\w*|buy(s|ing)?|go(es|ing)? live|onboard\w*|go(es|ing)? with|opt(s|ed|ing)? for|choos\w*)\b|\b(should|must|need(s)? to|ought to|has to|have to)\b/i;
/** A sentence that opens with an instruction ("Put …", "Let a machine …"). */
export const IMPERATIVE_START =
  /^(?:please\s+|so\s+|then\s+|now\s+|just\s+)?(put|get|add|install|use|deploy|set|switch|buy|purchase|try|let|have|give|hire|bring|start|begin|consider|adopt|implement|launch|roll|make|replace|turn|activate|enable|connect|integrate|sign|subscribe|go|choose|pick|select|move|upgrade|automate|outsource|invest|introduce|trial|pilot|evaluate|explore|test|offer|switch)\b/i;
/** Something you would buy, install or hire to handle guests. */
const TECH_OBJECT =
  /\b(systems?|software|tools?|platforms?|technolog(y|ies)|apps?|applications?|solutions?|products?|vendors?|packages?|subscriptions?|providers?|attendants?|receptionists?|operators?|assistants?|agents?|concierges?|devices?|widgets?|plug-?ins?|integrations?)\b/i;
/** Hurry: a gated recommendation is never immediate. */
const IMMEDIACY =
  /\b(now|immediately|today|tomorrow|right away|straight away|at once|without delay|asap|as soon as possible|this (week|month|quarter|season|year)|next (week|month))\b/i;
/** A joint that attaches a second, separate instruction. */
const CONTRAST =
  /\b(while|whereas|however|although|though|meanwhile|in the meantime|regardless|either way|in any case|anyway|instead|separately|on the other hand|so|but|yet|even|except|unless|despite)\b/i;
/** Words that negate, fail or withhold. Never part of an authorised sentence's subject. */
const NEGATION =
  /\b(not|no|never|none|nor|without|n't|cannot|fail\w*|incomplete|pending|withh\w*|declin\w*|refus\w*|reject\w*|denied|den(y|ies)|absent|lack\w*|insufficient|unproven|unverified|untested|unapproved|unclear|unknown)\b|n't\b/i;
/** Vocabulary of the gate. A sentence that uses it must parse as a gate or a disclaimer. */
const GATE_VOCABULARY =
  /\bonly (after|if|once|when)\b|\breadiness\b|\bsafety (tests?|checks?|validation)\b|\bapprov\w*|\bpilot\w*|\bmeasurable demand\b|\b(records?|logs?|data) (confirm|confirms|confirmed|show|shows|showed|shown|demonstrat\w*|document\w*|prove\w*)\b|\bauthori[sz]\w*|\bsign(s|ed)? off\b/i;
/** Sources that are not this restaurant, or approval that is not the owner's. */
const NOT_THE_RESTAURANT =
  /\b(industry|vendors?|suppliers?|providers?|third[- ]party|national|regional|average|typical|benchmark\w*|comparable|similar|other|peer|peers|competitors?|market|published|external|sample|survey|stud(y|ies)|chain|franchise|platform|manufacturer|resellers?|partners?|consultants?|Winnersbookmark|we|our|us)\b/i;

export type GateCondition = 'demand' | 'readiness' | 'approval';

/** "<owner>" in a demand clause: whose records. */
const RECORD_OWNER = String.raw`(?:the restaurant's own|the restaurant's|your own|your|its own|the owner's own|the owner's|(?:[A-Z][\w&.-]*\s){0,3}[A-Z][\w&.-]*['’]s own|the)`;
/** The restaurant's own operating records, by kind. */
const RECORD_KIND = String.raw`(?:call|phone|booking|reservation|inquiry|event inquiry|private-event inquiry|catering inquiry|order|ordering|sales|POS|operating)`;
const CLAUSE_END = String.raw`(?=\s*,|\s+and\s|$)`;
/**
 * The three conditions, each as the one affirmative, still-open clause shape it
 * may take. Anchored: a clause either matches as a whole or not at all.
 */
const CONDITION_CLAUSES: [GateCondition, RegExp][] = [
  [
    'demand',
    new RegExp(
      String.raw`^(?<owner>${RECORD_OWNER}\s+)?(?<kind>${RECORD_KIND}(?:\s+(?:and|or)\s+${RECORD_KIND})*\s+)?(?:records|logs|data)\s+` +
        String.raw`(?:confirms?|shows?|demonstrates?|documents?|have confirmed|have shown|have demonstrated|have documented)\s+` +
        String.raw`(?:(?:the|measurable|sufficient|high|repetitive|clear|real|enough|consistent),?\s+)*demand(?:\s+for\s+(?:it|this|them|the pilot|that|a pilot))?${CLAUSE_END}`,
      'i',
    ),
  ],
  [
    'readiness',
    new RegExp(
      String.raw`^(?:(?:it|the (?:product|system|tool|pilot|service|automation)|the (?:[A-Z][\w-]*\s){0,4}[A-Z][\w-]*)\s+(?:passes|has passed)\s+(?:all of\s+)?its own readiness and safety tests(?:\s+for this restaurant)?` +
        String.raw`|its (?:own )?readiness and safety tests (?:pass|have passed)(?:\s+for this restaurant)?)${CLAUSE_END}`,
      'i',
    ),
  ],
  [
    'approval',
    new RegExp(
      String.raw`^(?:the (?:restaurant )?owner|the restaurant's owner|you)\s+(?:explicitly\s+)?(?:approves|approve|has approved|have approved)` +
        String.raw`(?:\s+(?:it|the pilot|this pilot|them|a limited, monitored pilot))?(?:\s+(?:explicitly|in writing))?${CLAUSE_END}`,
      'i',
    ),
  ],
];
const CONDITION_SEPARATOR = /^(?:\s*,\s*(?:and\s+)?|\s+and\s+)/i;

/** One clause, checked: its shape, and that its source and approver are the restaurant's own. */
function matchCondition(text: string): { kind: GateCondition; length: number } | null {
  for (const [kind, re] of CONDITION_CLAUSES) {
    const m = re.exec(text);
    if (!m) continue;
    const clause = m[0];
    if (NOT_THE_RESTAURANT.test(clause.replace(/^(the restaurant's own|the restaurant's)\s+/i, '')) || NEGATION.test(clause)) return null;
    if (kind === 'demand') {
      // "the records" alone does not say whose: it needs an owner or a kind of operating record.
      const owner = (m.groups?.owner ?? '').trim();
      if ((!owner || /^the$/i.test(owner)) && !m.groups?.kind) return null;
    }
    return { kind, length: clause.length };
  }
  return null;
}

/**
 * A list of conditions joined by commas and "and". With `allowRest`, parsing
 * may stop at a comma that is followed by something other than a condition
 * (the subject after a leading "If …,"); otherwise all of it must parse.
 */
function parseConditionList(text: string, allowRest: boolean): { kinds: GateCondition[]; rest: string } | null {
  let rest = text.trim();
  const kinds: GateCondition[] = [];
  for (;;) {
    const m = matchCondition(rest);
    if (!m) return null;
    kinds.push(m.kind);
    rest = rest.slice(m.length);
    if (rest.trim() === '') return { kinds, rest: '' };
    const sep = CONDITION_SEPARATOR.exec(rest);
    if (!sep) return null;
    const after = rest.slice(sep[0].length);
    if (!matchCondition(after)) {
      if (allowRest && /^\s*,\s*$/.test(sep[0])) return { kinds, rest: after.trim() };
      return null;
    }
    rest = after;
  }
}

/** The subject of a gated proposal or disclaimer: a plain noun phrase, nothing that acts, negates, hurries or praises. */
function validSubject(subject: string): boolean {
  const s = subject.trim();
  if (!s || s.split(/\s+/).length > 30) return false;
  if (!/^(the|an?|this|its|[A-Z])/.test(s)) return false;
  return !/\b(is|are|was|were|be|been|being|should|must|will|would|shall|can|could|may|might|need|needs|has|have|had|do|does|did|then)\b/i.test(s) &&
    !NEGATION.test(s) && !DIRECTIVE.test(s) && !RECOMMENDS.test(s) && !ENDORSEMENT.test(s) && !IMMEDIACY.test(s) &&
    !CONTRAST.test(s) && !OUTCOME_CLAIM.test(s) && !GATE_VOCABULARY.test(s);
}

export interface GateParse {
  authorised: boolean;
  /** The conditions found, in order. */
  conditions: GateCondition[];
  reason?: string;
}

const PROPOSAL_HEAD =
  /\s+(?:could|may|might)\s+be\s+(?:considered|evaluated|assessed|worth(?:\s+(?:considering|evaluating|assessing))?)(?:\s+(?:as|for))?\s+a limited, monitored pilot/gi;
const GATE_TAIL = /^\s*(?:,|—|–)?\s*(?:but\s+)?only\s+(?:after|if|once|when)\s+(.+)$/i;
const REQUIRED: GateCondition[] = ['demand', 'readiness', 'approval'];

/**
 * A gated proposal, parsed. Authorised only when the whole sentence is the
 * closed form described above and its conditions are exactly demand,
 * readiness and approval, once each.
 */
export function parseGatedProposal(sentence: string): GateParse {
  const s = sentence.trim().replace(/[.!?;]+$/, '');
  const fail = (reason: string, conditions: GateCondition[] = []): GateParse => ({ authorised: false, conditions, reason });
  const heads = [...s.matchAll(PROPOSAL_HEAD)];
  if (heads.length !== 1) return fail('no single "could be considered as a limited, monitored pilot" proposal');
  const head = heads[0];
  const before = s.slice(0, head.index);
  const after = s.slice(head.index! + head[0].length);

  const conditions: GateCondition[] = [];
  let subject = before;
  const leading = /^(?:if|once|when)\s+(.+)$/i.exec(before);
  if (leading) {
    const parsed = parseConditionList(leading[1], true);
    if (!parsed || !parsed.rest) return fail('a leading condition does not parse as an affirmative condition');
    conditions.push(...parsed.kinds);
    subject = parsed.rest;
  }
  if (!validSubject(subject)) return fail('the subject is not a plain noun phrase', conditions);

  const tail = GATE_TAIL.exec(after);
  if (!tail) return fail('no "only after …" gate', conditions);
  const parsedTail = parseConditionList(tail[1], false);
  if (!parsedTail) return fail('a gate condition does not parse as an affirmative condition', conditions);
  conditions.push(...parsedTail.kinds);

  for (const need of REQUIRED) {
    const count = conditions.filter((c) => c === need).length;
    if (count !== 1) return fail(count === 0 ? `missing condition: ${need}` : `repeated condition: ${need}`, conditions);
  }
  if (IMMEDIACY.test(s) || ENDORSEMENT.test(s) || OUTCOME_CLAIM.test(s)) return fail('hurries, endorses or promises', conditions);
  return { authorised: true, conditions };
}

const DISCLAIMER_STAGE = String.raw`(?:\s+(?:here|at this stage|for now|for this restaurant|currently|yet|on (?:the )?public evidence(?: alone)?|from (?:the )?public evidence(?: alone)?))?`;
const DISCLAIMER_UNTIL = String.raw`(?:\s+until\s+(?<until>.+))?`;
const DISCLAIMERS: RegExp[] = [
  new RegExp(
    String.raw`^No (?:automation|AI|pilot)(?: (?:change|product|system|tool|purchase|pilot))? (?:is|are|has been|will be) (?:currently |yet )?(?:proposed|recommended|justified|warranted|planned)` +
      DISCLAIMER_STAGE + DISCLAIMER_UNTIL + '$',
    'i',
  ),
  new RegExp(
    String.raw`^(?:We|Winnersbookmark|This audit|This report|The audit) (?:do|does) not (?:recommend|propose) (?:any )?(?:automation|an? automation (?:change|purchase|pilot)|automation (?:changes|purchases|pilots)|a pilot|any pilot)` +
      DISCLAIMER_STAGE + DISCLAIMER_UNTIL + '$',
    'i',
  ),
  new RegExp(
    String.raw`^(?<subject>.+?) (?:is|are) not (?:currently |yet )?(?:recommended|proposed|justified|warranted)` + DISCLAIMER_STAGE + DISCLAIMER_UNTIL + '$',
    'i',
  ),
];

/**
 * An explicit non-recommendation that does nothing else. An "until …" part
 * must itself parse as affirmative conditions, each at most once.
 */
export function parseDisclaimer(sentence: string): boolean {
  const s = sentence.trim().replace(/[.!?;]+$/, '');
  for (const re of DISCLAIMERS) {
    const m = re.exec(s);
    if (!m) continue;
    if (m.groups?.subject !== undefined && !validSubject(m.groups.subject)) continue;
    if (m.groups?.until !== undefined) {
      const parsed = parseConditionList(m.groups.until, false);
      if (!parsed || new Set(parsed.kinds).size !== parsed.kinds.length) continue;
    }
    if (IMMEDIACY.test(s.replace(/\b(currently|yet)\b/gi, '')) || ENDORSEMENT.test(s) || OUTCOME_CLAIM.test(s)) continue;
    return true;
  }
  return false;
}

export interface SummaryScreen {
  safe: boolean;
  /** The sentences that failed, for the operator log. */
  unsafe: string[];
}

/** Why a sentence is unsafe, or null. */
function unsafeReason(sentence: string, summaryMentionsAutomation: boolean): string | null {
  if (OUTCOME_CLAIM.test(sentence) || /\bis the matched fix\b/i.test(sentence)) return 'promises an outcome or calls it the fix';
  if (parseGatedProposal(sentence).authorised || parseDisclaimer(sentence)) return null;
  if (mentionsAutomation(sentence)) return 'mentions an automation outside an authorised gate or disclaimer';
  if (GATE_VOCABULARY.test(sentence)) return 'uses gate wording that does not parse as an authorised gate';
  const recommends = RECOMMENDS.test(sentence) || DIRECTIVE.test(sentence) || IMPERATIVE_START.test(sentence) || ENDORSEMENT.test(sentence);
  if (recommends && TECH_OBJECT.test(sentence)) return 'recommends a system or product';
  if (recommends && summaryMentionsAutomation && BACK_REFERENCE.test(sentence)) return 'recommends something named earlier';
  return null;
}

/**
 * Whether an AI-written summary may be shown to a client. One unsafe sentence
 * rejects the whole summary; the caller falls back to the deterministic
 * summary. Used at audit time (orchestrator) and whenever a report renders, so
 * summaries stored before this rule are screened too.
 */
export function screenAiSummary(text: string): SummaryScreen {
  const scrubbed = withoutSelfDescription(text);
  const sentences = scrubbed.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const named = sentences.some(mentionsAutomation);
  const unsafe = sentences.filter((s) => unsafeReason(s, named) !== null);
  return { safe: unsafe.length === 0, unsafe };
}

/** The instruction the summary model is given about automation. */
export const AI_SUMMARY_AUTOMATION_RULE =
  'Never recommend installing, deploying, adopting or launching any automation or AI product, never call one the fix or the ' +
  'solution, and never promise a result (no "will stop missed calls"). Do not describe automation in other words either ' +
  '(automatic answering, digital attendants, software that takes calls). An automation may be mentioned only in exactly this ' +
  "form: \"<automation> could be considered as a limited, monitored pilot only after the restaurant's own records show " +
  'measurable demand, it passes its own readiness and safety tests, and the owner approves it." Never propose one for a ' +
  'finding whose recommendation says it is exploratory. Any summary that does not follow these rules is discarded.';

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

// ── Pilot candidates and exploratory opportunities ──────────────────────────

/**
 * Findings whose recommended solution is an automation, whatever their AI fit:
 * the phone, retention and catering / private-event findings.
 */
const AUTOMATION_CATEGORY = /PHONE-DEPENDENT|RETENTION|CATERING|PRIVATE/i;
/**
 * A pilot candidate: a strong automation fit (AI fit >= 70). Only these reach a
 * pilot decision — in Section 06, the Decision box and Days 15–21 alike.
 *
 * PR #63's safeguard holds: a link alone does not establish demand. The
 * catering finding (AI fit 60) rests on a private-party link, so it is not a
 * pilot candidate; it is an exploratory opportunity (isExploratoryOpportunity).
 */
export function isAutomationCandidate(o: { category: string; aiFitScore: number }): boolean {
  return o.aiFitScore >= 70;
}
/**
 * An automation opportunity shown for visibility only, below the strong fit:
 * exploratory, no purchase justified, no pilot recommended, the restaurant's
 * own records first. Shown the same way on its finding card, in Section 06,
 * the Decision box and Days 15–21.
 */
export function isExploratoryOpportunity(o: { category: string; aiFitScore: number }): boolean {
  return !isAutomationCandidate(o) && AUTOMATION_CATEGORY.test(o.category);
}

/** The status every exploratory opportunity carries, wherever it is shown. */
export const EXPLORATORY_STATUS =
  'This opportunity is exploratory only: public evidence alone does not establish demand for it, so no automation purchase ' +
  'is justified and no pilot is recommended.';

/**
 * What an exploratory opportunity's finding card recommends: understanding and
 * improving the current workflow from the restaurant's own records — never an
 * automation, a purchase or a pilot. Replaces the stored solution text whole,
 * so no stored or historical wording ("… is the matched fix", "… may be worth a
 * limited, monitored pilot") can reach the card.
 */
function exploratorySolution(category: string): string {
  if (/CATERING|PRIVATE/i.test(category)) {
    return 'Before considering any automation, collect acknowledgment records, response times and booking records for recent ' +
      'event inquiries, and use them to map how each inquiry is received, acknowledged, passed to a named staff member and ' +
      'followed up today. Where the records show gaps, improve that workflow first: a named owner for every inquiry and a ' +
      `consistent acknowledgment. ${EXPLORATORY_STATUS} Only if those records show slow or missed responses could automation be ` +
      'assessed as a proposal at all.';
  }
  if (/PHONE/i.test(category)) {
    return 'Before any system: pull 30 days of call records — total calls, unanswered calls, and the most common reasons — and ' +
      'use them to see how calls are answered, transferred and returned today. Where the records show gaps, improve that ' +
      `process first. ${EXPLORATORY_STATUS} Only if those records show calls going unanswered could automation be assessed ` +
      'as a proposal at all.';
  }
  if (/RETENTION/i.test(category)) {
    return 'First check whether a list already exists in your POS or reservation system — if it does, this is a publishing ' +
      `gap, not a data gap. If it does not, a visible email/SMS capture offer is the starting point. ${EXPLORATORY_STATUS}`;
  }
  return `Review the restaurant's own records for this area before considering any change. ${EXPLORATORY_STATUS}`;
}

/**
 * An opportunity's recommended solution, as a client reads it. Exploratory
 * opportunities get the exploratory recommendation; pilot candidates and
 * everything else get presentRecommendedSolution.
 */
export function presentOpportunitySolution(o: { category: string; aiFitScore: number; recommendedSolution: string }): string {
  return isExploratoryOpportunity(o) ? exploratorySolution(o.category) : presentRecommendedSolution(o.category, o.recommendedSolution);
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
