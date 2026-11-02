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
  /\b(should|must|need(s)? to|ought to|has to|have to|had better|would do well|is best|are best|it('s| is) time|(is|are|was|were) to be)\b|\b(recommend\w*|suggest\w*|advis\w*|propos\w*|urg(e|es|ed|ing)|encourag\w*|consider\w*|benefit\w* from|worth (a look|considering|exploring|trying|it|adding|getting)|makes? sense|is what\b[^.]*\bneeds?|needs? (an?|some|a new)\b)|\b(needs|need)\b(?! to be (measured|confirmed|checked|verified|validated|assessed|answered by (staff|the team)))/i;
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
 * FAIL CLOSED ON SENTENCES ABOUT AN AUTOMATION. Such a sentence is allowed
 * only when it reports what was observed — something detected, found, linked,
 * used, shown or not verified — or asks a question. Anything else said about
 * an automation ("The AI Front Desk is a worthwhile purchase.", "… is
 * available.") is an assertion the audit did not observe, and is not shown.
 */
const OBSERVES =
  /\b(was|were|is|are|been|being|be) (not )?(detected|found|observed|seen|shown|listed|linked|displayed|rendered|loaded|resolved|verified|tested|embedded|present|visible|referenced|mentioned|configured|checked|named|used|offered|provided|operated|hosted|connected)\b|\b(detected|found|observed|lists|linked|links to|embeds|shows|displays|uses|offers|mentions|references|appears|contains|includes|runs|hosts|loads|opens|points to|did not|does not|do not|no longer|(was|were|is|are|has|have) (not|never))\b|^(no|none|neither)\b|^(based on|measured by|scored (on|from)|derived from|not assessed|not observed|not measured|not verified|requires your data|unknown)\b|\b(invisible to|leaves no (public )?trace|not visible|is not something a public page can show)\b|\brequires? (direct |your |internal |owner |the owner's |the restaurant's own )?(access|data|records|validation|confirmation|platform access)\b/i;
/**
 * A value judgement — merit, worth, cost-benefit — in any phrasing. About an
 * automation it is an endorsement, whatever verb carries it, so it is never
 * allowed, observation verb or not.
 */
const VALUE_JUDGEMENT =
  /\b(worth\w*|sound|smart|wise|good|great|excellent|valuable|profitable|cost[- ]effective|affordable|economical|essential|indispensable|must[- ]have|no[- ]brainer|ideal|perfect|best|better|strong|solid|compelling|attractive|sensible|prudent|justified|beneficial|helpful|useful|effective|powerful|game[- ]chang\w*|win|winner|bargain|deal|asset|investment|purchase|buy|spend|upgrade|addition|recommended|endorsed)\b|\bpays? (for )?itself\b|\bearns? its keep\b|\bmoney well spent\b|\bvalue for money\b|\breturn on investment\b|\bROI\b/i;

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

/**
 * Whether a text — one field, read as a whole — recommends, suggests or
 * endorses automation, changes who handles guests without naming a person, or
 * acquires a product.
 */
export function assessNarrative(text: string, options: NarrativeOptions = {}): NarrativeVerdict {
  const violations: NarrativeVerdict['violations'] = [];
  let automationInContext = false;
  for (const raw of sentencesOf(text)) {
    const sentence = normalise(raw);
    const labelFree = sentence.replace(/^•\s*/, '').replace(/^[^—\n]{1,30}\s—\s(?=[A-Z])/, '');
    // Descriptions are read as descriptions: what the audit could or could
    // not observe, negated modals and descriptive passives are set aside.
    const s = withoutSelfDescription(labelFree)
      .replace(OBSERVATIONAL_MODAL, 'was checked')
      .replace(NEGATED_MODAL, 'did not')
      .replace(DESCRIPTIVE_PASSIVE, 'is configured');
    // Labels quoted from the page are checked one by one, for an automation by name only.
    if ((s.match(LABEL_LIST) ?? []).length >= 2 && s.split(LABEL_LIST).every((seg) => seg.trim().split(/\s+/).length <= 7)) {
      if (s.split(LABEL_LIST).some((seg) => mentionsAutomation(seg))) violations.push({ sentence, reason: 'quotes a label naming an automation' });
      continue;
    }
    // Judged on the whole sentence, with no word window: a handling verb and a
    // guest channel anywhere in it, or a technology word and a guest channel.
    // Channel noun compounds ("inquiry handling", "call volume", "call
    // records") name a subject, not an action, and are set aside first.
    const verbal = s.replace(CHANNEL_COMPOUND, 'the subject');
    const handles = handlesGuestCommunication(verbal) || (HANDLING_VERB.test(verbal) && GUEST_CHANNEL_WORD.test(verbal));
    const namesAutomation = mentionsAutomation(s) || /\bAI (FRONT DESK|REACTIVATION)\b/i.test(s) ||
      (TECHNOLOGY_WORD.test(s) && GUEST_CHANNEL_WORD.test(s)) || (TECH_OBJECT.test(s) && handles && !HUMAN_PERFORMER.test(s));
    const about = namesAutomation || (automationInContext && REFERS_BACK.test(s));
    const instructs = opensWithInstruction(s) && !REPAIRS_EXISTING.test(s);
    const repairOnly = REPAIRS_EXISTING.test(s) && !ACQUIRES.test(s.replace(REPAIRS_EXISTING, ''));
    // Proposing a change, as opposed to describing what exists.
    const proposes = !repairOnly &&
      (instructs || MODAL_DIRECTIVE.test(s) || PROPOSES_CHANGE.test(s) || SUGGESTION.test(s) || OFFERS_AS_OPTION.test(s) ||
        ENDORSEMENT.test(s) || OUTCOME_CLAIM.test(s));
    const humanOnly = HUMAN_PERFORMER.test(s) && !NON_HUMAN.test(s) && !namesAutomation;

    if (!(options.approved?.has(labelFree) || options.approved?.has(sentence))) {
      if (about && proposes) {
        violations.push({ sentence, reason: 'recommends, suggests or endorses an automation' });
      } else if ((proposes || (CAPABILITY.test(s) && (namesAutomation || NON_HUMAN.test(s)))) && !repairOnly && handles && !humanOnly) {
        violations.push({ sentence, reason: 'changes who handles guest calls, inquiries or reservations without naming a person' });
      } else if (proposes && ACQUIRES.test(s) && TECH_OBJECT.test(s)) {
        violations.push({ sentence, reason: 'acquires a system or product' });
      } else if (about && VALUE_JUDGEMENT.test(s)) {
        violations.push({ sentence, reason: 'judges the value of an automation' });
      } else if (namesAutomation && !repairOnly && !OBSERVES.test(s) && !/\?$/.test(s)) {
        violations.push({ sentence, reason: 'asserts something about an automation that is not an observation' });
      }
    }

    if (namesAutomation) automationInContext = true;
    else if (OWN_SUBJECT.test(s) && !REFERS_BACK.test(s)) automationInContext = false;
  }
  return { safe: violations.length === 0, violations };
}

/** A stored narrative field as it may be shown: unchanged when the policy allows it, otherwise the fallback. */
export function safeNarrative(text: string, fallback: string, options: NarrativeOptions = {}): string {
  return assessNarrative(text, options).safe ? text : fallback;
}
