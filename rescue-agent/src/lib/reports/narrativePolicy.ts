import {
  ENDORSEMENT,
  OUTCOME_CLAIM,
  GUEST_CHANNEL_WORD,
  HANDLING_VERB,
  TECHNOLOGY_WORD,
  TECH_OBJECT,
  handlesGuestCommunication,
  mentionsAutomation,
  opensWithInstruction,
  withoutSelfDescription,
} from './automationWording';

/**
 * THE SHARED NARRATIVE POLICY.
 *
 * What a client report or a Sales Brief may say about automation is decided in
 * two layers. This module is the second.
 *
 *   1. Recommendations are not free text. Every recommendation a reader sees is
 *      an audited deterministic template chosen from structured data
 *      (recommendationTemplates.ts for the client report, sales.ts for the
 *      Sales Brief). AI-written summaries are not shown at all, stored
 *      recommendation text is never shown unless it is an exact audited
 *      engine string, and stored Sales Brief text is never shown: the brief is
 *      regenerated from the stored audit data (salesData.ts).
 *   2. Stored OBSERVATIONS — finding titles and descriptions, journey
 *      findings, evidence facts, score explanations — are free text written by
 *      earlier engine versions. They are shown, because they are the audit's
 *      factual record, but only after this policy has checked that they do
 *      not recommend, suggest or endorse automation. One that does is
 *      replaced with a neutral fallback; the stored record is not changed.
 *
 * The policy distinguishes deploying automation from operational
 * improvements. Allowed: observations about existing services ("reservations
 * are taken through OpenTable"), repairs to an existing component ("restyle the
 * booking widget", "repair the contact form so inquiries reach the events
 * inbox"), and anything a named PERSON does ("hire a host to answer calls at
 * dinner", "assign a staff member to return missed calls"). Not allowed: any
 * instruction, recommendation, suggestion or endorsement that
 *   - proposes an automation, named or described ("a speech engine could field
 *     the late calls");
 *   - changes who handles guest calls, inquiries or reservations without naming
 *     a person, or names something non-human ("calls are to be answered by a
 *     prerecorded greeter");
 *   - acquires a system or product ("get a voice model subscription").
 *
 * Context carries across sentences: once a text has mentioned an automation,
 * a later sentence that refers back to something ("It should be installed.",
 * "Put one in place.", "The system is worth it.") is judged as being about that
 * automation, until a sentence with a different explicit subject intervenes.
 */

/**
 * Someone the restaurant employs, the restaurant itself, or its own web pages
 * (guest self-service through the website is an operational improvement, not
 * an automation).
 */
const HUMAN_PERFORMER =
  /\b(staff( members?)?|team( members?)?|employees?|hosts?|hostess(es)?|managers?|servers?|someone|a person|people|humans?|owner|front[- ]of[- ]house|reservationists?|receptionists?|greeters?|bartenders?|chefs?|coordinators?|planners?|named (staff )?member|the restaurant|the business|the website|the site|the homepage|the (menu|FAQ|booking|contact|events?|catering) page|the contact form)\b/i;
/** Anything that makes the one doing the work something other than a person. */
const NON_HUMAN =
  /\b(pre-?recorded|recorded|automat\w*|virtual|digital|synthetic|synthesi[sz]ed|robot\w*|AI|A\.I\.|artificial|computer\w*|software|machines?|electronic|speech|bots?|engines?|models?|programs?|apps?|platforms?|text-to-speech|IVR|phone tree|neural|conversational|chat|kiosks?|lifelike|answering service|outsourc\w*|remote|third-party|on its own|by itself|itself|without (a |any )?(person|staff|anyone|human|people))\b/i;
/** Getting, adding or switching to something — as opposed to repairing what exists. */
const ACQUIRES =
  /\b(get|gets|getting|add|adds|adding|install\w*|deploy\w*|buy\w*|purchas\w*|subscrib\w*|sign(s|ed|ing)? up|adopt\w*|implement\w*|introduc\w*|launch\w*|set(s|ting)? up|switch\w* to|mov\w* to|migrat\w*|replac\w* (it |them )?with|bring\w* in|onboard\w*|trial\w*|pilot\w*|integrat\w*|use|using|rel(y|ies|ying) on|let(s|ting)?|hand\w*|rout\w*|outsourc\w*|invest\w* in|go(es|ing)? with|opt\w* for|choos\w*|lean\w* on|need(s)? (an?|some|a new))\b/i;
/** Repairing, restyling or checking something that already exists: an operational improvement. */
const REPAIRS_EXISTING =
  /^(?:please\s+)?(fix|repair|restyle|style|recolou?r|update|correct|relabel|reconnect|resize|retest|test|check|verify|restore|tidy|rewrite|reword|shorten|enlarge|align|publish|clarify)\s+(the|its|their|your|each|every|all)\b/i;
/** Proposing a change: an instruction, an obligation, a recommendation or an endorsement. Not a description. */
const PROPOSES_CHANGE =
  /\b(should|must|need(s)? to|ought to|has to|have to|had better|would do well|is best|are best|it('s| is) time|(is|are|was|were) to be)\b|\b(recommend\w*|suggest\w*|advis\w*|propos\w*|urg(e|es|ed|ing)|encourag\w*|consider\w*|benefit\w* from|worth (a look|considering|exploring|trying|it|adding|getting)|makes? sense|is what\b[^.]*\bneeds?|needs? (an?|some|a new)\b|requires? (an?|some|a new)\b)|\b(needs|need)\b(?! to be (measured|confirmed|checked|verified|validated|assessed|answered by (staff|the team)))/i;
/** An obligation, by modal ("should", "must", "is to be …"). Verbs in any tense are not: "chooses", "installed". */
const MODAL_DIRECTIVE = /\b(should|must|need(s)? to|ought to|has to|have to)\b|\b(is|are) to be \w+(ed|en|t)\b/i;
/** What the audit could or could not observe is a description, not a suggestion. */
const OBSERVATIONAL_MODAL =
  /\b(could|can|may|might|would|will)( not)? be (resolved|verified|found|confirmed|detected|read|reached|tested|loaded|seen|measured|observed|determined|identified|collected|checked|assessed|parsed|opened)\b(?!\s+(by|through|via|with|using|automatically|instantly)\b)/gi;
const NEGATED_MODAL = /\b(could|can|may|might|would|will|should) not\b|\bcannot\b|\bcan['’]t\b|\bwon['’]t\b|\bcouldn['’]t\b/gi;
/** A descriptive passive of a setup verb: "is set up as a phone link". */
const DESCRIPTIVE_PASSIVE = /\b(is|are|was|were|been|being|be) (set up|put in place|rolled out|switched over|configured)\b/gi;
/** A list of page labels quoted from the site ("View Menu | ORDER NOW | Call Us"), not prose. */
const LABEL_LIST = /\s\|\s/g;

/**
 * What an observation clause does: report something detected, found, linked,
 * shown or not verified; state an audit limitation; or give the basis of a
 * measurement. Only these may be said about an automation affirmatively.
 */
const OBSERVES =
  /\b(was|were|is|are|been|being|be) (not )?(detected|found|observed|seen|shown|listed|linked|displayed|rendered|loaded|resolved|verified|tested|embedded|present|visible|referenced|mentioned|configured|checked|named|used|offered|provided|operated|hosted|connected|published|reachable|collected|recorded)\b|\b(detected|found|observed|linked|links to|embeds|loads|opens|points to|resolves to|no longer)\b|^(based on|measured by|scored (on|from)|derived from|not assessed|not observed|not measured|not verified|requires your data|unknown)\b|\b(invisible to|leaves no (public )?trace|not visible|is not something a public page can show)\b|\brequires? (direct |your |internal |owner |the owner's |the restaurant's own )?(access|data|records|validation|confirmation|platform access)\b/i;
/**
 * Active descriptive verbs ("the page lists", "the restaurant uses", "the
 * site offers"). They report an observation only when what they describe is
 * the restaurant, a person, or one of its pages — something the audit looked
 * at. Said of a product ("automatic call answering offers strong return on
 * investment", "the AI Front Desk provides …") they are a claim about it.
 */
const DESCRIBES = /\b(uses|offers|provides|shows|displays|lists|mentions|references|appears|contains|includes|runs|hosts|features)\b/i;
const OBSERVED_SUBJECT = /\b(page|pages|site|website|homepage|restaurant|business|menu|listing|profile|footer|header|form|link|button|markup|source|greeting|voicemail)\b/i;

/** Whether a clause reports an observation (see OBSERVES and DESCRIBES). */
function observes(s: string): boolean {
  if (OBSERVES.test(s)) return true;
  const m = DESCRIBES.exec(s);
  if (!m) return false;
  const subject = s.slice(0, m.index);
  return HUMAN_PERFORMER.test(subject) || OBSERVED_SUBJECT.test(subject);
}
/** A negated predicate: "is not", "isn't", "does not", "did not". */
const NEGATED_PREDICATE = /\b(is|are|was|were|seems?|remains?) not\b|\b(isn['’]t|aren['’]t|wasn['’]t|weren['’]t)\b|\b(does|do|did) not\b|\b(doesn['’]t|don['’]t|didn['’]t)\b/i;
/** A negated clause: what something is not, does not do, or was not found to do. */
const NEGATED = /\b(not|never|no|none|nothing|neither|nor|n't|without|did not|does not|do not|cannot|fails? to|failed)\b/i;
/**
 * A finite predicate that asserts something — a copula, or a verb of
 * delivering, providing or improving. A grammatical class, not a list of
 * endorsement words: "is a boon", "represents a quantum leap", "is a sound
 * investment" and "delivers results" are all claims because of their
 * predicate, whatever the praise.
 */
const CLAIM_PREDICATE =
  /\b(is|are|was|were|be|been|being|becomes?|remains?|seems?|represents?|constitutes?|offers?|provides?|delivers?|brings?|means|makes?|gives?|helps?|saves?|boosts?|improves?|increases?|raises?|grows?|transforms?|revolutioni[sz]es?|pays?|earns?|wins?|beats?|outperforms?|guarantees?|ensures?|enables?|unlocks?|drives?|generates?|captures?|converts?|solves?|fixes|eliminates?|prevents?|stops?)\b/i;

/**
 * Clause boundaries inside a sentence: ";", "—", ", but/yet/so/while …", " but
 * ", and " and " where a new predicate or instruction starts. A mixed sentence
 * is judged clause by clause, so an acceptable negative statement or repair
 * cannot carry a second, unacceptable clause.
 */
const CLAUSE_BOUNDARY = new RegExp(
  String.raw`\s*;\s*|\s+—\s+|,\s*(?:but|yet|so|while|whereas|although|though|and then|then)\s+|\s+(?:but|yet)\s+|` +
    String.raw`,?\s+and\s+(?=(?:also\s+|then\s+|it\s+|its\s+|they\s+|them\s+|this\s+|that\s+)?(?:is|are|was|were|represents?|offers?|provides?|delivers?|brings?|means|makes?|gives?|helps?|saves?|boosts?|should|must|could|would|will|can|buy|install|deploy|get|add|adopt|purchase|set|switch|replace|use|let|have|put|start|launch|implement|subscribe|sign|move|go|choose|pick|hire|route|hand|send|forward)\b)`,
  'i',
);

/** A clause that tells someone to repair, restyle or check an existing component. */
const REPAIR_CLAUSE = REPAIRS_EXISTING;

/** A suggestion: "a speech engine could field the late calls". */
const SUGGESTION = /\b(could|would|might|may)\b/i;
/** A capability claimed for something not yet in place: "a speech engine can field the calls". */
const CAPABILITY = /\b(can|will)\b/i;
/** "… is one option", "… is worth a look". */
const OFFERS_AS_OPTION =
  /\b(is|are|would be|could be|remains?) (one|an|the|a good|a strong|another|the best|a sensible|a natural|a real|the right|the ideal) (option|possibility|way|route|answer|approach|choice|alternative|fit|candidate|next step|move|job for|fix|solution)\b|\b(is|are) a job for\b/i;

/** A sentence that leans on something said before. */
const REFERS_BACK = /^(it|its|this|that|these|those|they|them|one|such|the (system|tool|product|service|platform|solution|assistant|receptionist|attendant|engine|model|program|app|option))\b|\b(it|them|one|this one|that one)\b/i;
/** A sentence with its own explicit, non-pronoun subject, which resets the context. */
const OWN_SUBJECT = /^(the|a|an|our|its|their|this|that|[A-Z][\w'’-]+)\s+(?!system\b|tool\b|product\b|service\b|platform\b|solution\b|engine\b|model\b|program\b|app\b|option\b)[\w'’-]+/;

/** "inquiry handling", "call volume", "booking records": a channel used as a noun modifier. */
const CHANNEL_COMPOUND =
  /\b(calls?|phone|inquir(y|ies)|reservations?|bookings?|messages?|orders?|guest|event|private-event|catering)[- ](handling|routing|management|intake|volume|records|demand|data|logs?|patterns|times?|rates?|counts?)\b/gi;

/** Text split into sentences, the way every check in this module reads it. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export interface NarrativeVerdict {
  safe: boolean;
  /** The sentences that broke the policy, with why. */
  violations: { sentence: string; reason: string }[];
}

export interface NarrativeOptions {
  /** Exact sentences this caller itself writes and has audited (the Sales Brief's conditional gate sentences). */
  approved?: ReadonlySet<string>;
}

const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A sentence's clauses; a clause without its own subject belongs to the one before it. */
export function clausesOf(sentence: string): string[] {
  return sentence.split(CLAUSE_BOUNDARY).map((c) => c.trim().replace(/^(and|or)\s+/i, '')).filter(Boolean);
}

interface ClauseReading {
  s: string;
  handles: boolean;
  namesAutomation: boolean;
  proposes: boolean;
  repairOnly: boolean;
  humanOnly: boolean;
}

/** One clause, read with the descriptions set aside. */
function readClause(raw: string): ClauseReading {
  const s = withoutSelfDescription(raw)
    .replace(OBSERVATIONAL_MODAL, 'was checked')
    .replace(NEGATED_MODAL, 'did not')
    .replace(DESCRIPTIVE_PASSIVE, 'is configured');
  // Channel noun compounds ("inquiry handling", "call volume", "call
  // records") name a subject, not an action, and are set aside first.
  const verbal = s.replace(CHANNEL_COMPOUND, 'the subject');
  const handles = handlesGuestCommunication(verbal) || (HANDLING_VERB.test(verbal) && GUEST_CHANNEL_WORD.test(verbal));
  const namesAutomation = mentionsAutomation(s) || /\bAI (FRONT DESK|REACTIVATION)\b/i.test(s) ||
    (TECHNOLOGY_WORD.test(s) && GUEST_CHANNEL_WORD.test(s)) || (TECH_OBJECT.test(s) && handles && !HUMAN_PERFORMER.test(s));
  const instructs = opensWithInstruction(s) && !REPAIR_CLAUSE.test(s);
  const repairOnly = REPAIR_CLAUSE.test(s) && !ACQUIRES.test(s.replace(REPAIR_CLAUSE, ''));
  // Proposing a change, as opposed to describing what exists.
  // A negated predicate negates the praise it carries: "is not a good fit"
  // is a negative assessment, not an endorsement. A negated determiner does
  // not ("No alternative beats …" still endorses).
  const negatedPredicate = NEGATED_PREDICATE.test(s);
  const proposes = !repairOnly &&
    (instructs || MODAL_DIRECTIVE.test(s) || PROPOSES_CHANGE.test(s) || SUGGESTION.test(s) ||
      ((OFFERS_AS_OPTION.test(s) || ENDORSEMENT.test(s)) && !negatedPredicate) || OUTCOME_CLAIM.test(s));
  const humanOnly = HUMAN_PERFORMER.test(s) && !NON_HUMAN.test(s) && !namesAutomation;
  return { s, handles, namesAutomation, proposes, repairOnly, humanOnly };
}

/**
 * Whether a text — one field, read as a whole, sentence by sentence and
 * clause by clause — recommends, suggests or endorses automation, changes who
 * handles guests without naming a person, acquires a product, or asserts
 * something about an automation that is not an observation, a negation, a
 * repair or a question.
 */
export function assessNarrative(text: string, options: NarrativeOptions = {}): NarrativeVerdict {
  const violations: NarrativeVerdict['violations'] = [];
  let automationInContext = false;
  for (const raw of sentencesOf(text)) {
    const sentence = normalise(raw);
    const labelFree = sentence.replace(/^•\s*/, '').replace(/^[^—\n]{1,30}\s—\s(?=[A-Z])/, '');
    if (options.approved?.has(labelFree) || options.approved?.has(sentence)) continue;
    // Labels quoted from the page are checked one by one, for an automation by name only.
    if ((labelFree.match(LABEL_LIST) ?? []).length >= 2 && labelFree.split(LABEL_LIST).every((seg) => seg.trim().split(/\s+/).length <= 7)) {
      if (labelFree.split(LABEL_LIST).some((seg) => mentionsAutomation(seg))) violations.push({ sentence, reason: 'quotes a label naming an automation' });
      continue;
    }
    const question = /\?\s*$/.test(labelFree);
    for (const clause of clausesOf(labelFree)) {
      const c = readClause(clause);
      // About an automation: named here, or carried from an earlier clause or
      // sentence by a clause that refers back or has no subject of its own.
      const carried = automationInContext && (REFERS_BACK.test(c.s) || !OWN_SUBJECT.test(c.s));
      const about = c.namesAutomation || carried;
      const observed = observes(c.s);
      const negated = NEGATED.test(c.s);
      if (about && c.proposes) {
        violations.push({ sentence, reason: 'recommends, suggests or endorses an automation' });
      } else if ((c.proposes || (CAPABILITY.test(c.s) && (c.namesAutomation || NON_HUMAN.test(c.s)))) && !c.repairOnly && c.handles && !c.humanOnly) {
        violations.push({ sentence, reason: 'changes who handles guest calls, inquiries or reservations without naming a person' });
      } else if (c.proposes && ACQUIRES.test(c.s) && TECH_OBJECT.test(c.s)) {
        violations.push({ sentence, reason: 'acquires a system or product' });
      } else if (about && !c.repairOnly && !observed && !negated && !question && CLAIM_PREDICATE.test(c.s)) {
        // An affirmative predicate about an automation that reports nothing
        // observed: "is a boon", "represents a quantum leap", "is available".
        violations.push({ sentence, reason: 'asserts something about an automation that is not an observation, a negation or a repair' });
      }
      if (c.namesAutomation) automationInContext = true;
      else if (OWN_SUBJECT.test(c.s) && !REFERS_BACK.test(c.s)) automationInContext = false;
    }
  }
  return { safe: violations.length === 0, violations };
}

/**
 * FREE TEXT QUOTED INSIDE EVIDENCE MAKES NO CLAIMS.
 *
 * Text an evidence template interpolated (a page title, a call-to-action
 * label, a test note) is published only when it passes the narrative policy
 * AND asserts nothing: every clause is a fragment without an asserting
 * predicate, an observation, a negation, a repair or a question. This does
 * not depend on recognising the subject: "The SIP dialog orchestrator is a
 * sound investment" fails on its predicate, whatever an orchestrator is.
 */
export function isClaimFree(text: string): boolean {
  if (!assessNarrative(text).safe) return false;
  for (const raw of sentencesOf(text)) {
    const sentence = normalise(raw);
    if (/\?\s*$/.test(sentence)) continue;
    for (const clause of clausesOf(sentence)) {
      const c = readClause(clause);
      if (c.repairOnly || observes(c.s) || NEGATED.test(c.s)) continue;
      if (CLAIM_PREDICATE.test(c.s)) return false;
    }
  }
  return true;
}
