import type { EvidenceRecordLike, JourneyStageResult } from '@/types/audit';
import type { RankedOpportunity } from './owner';
import { COMPANY } from '@/lib/config';
import {
  inheritState,
  mayStateDefinitively,
  STATE_PLAIN,
  stateForOpportunity,
  stateRank,
  validationInstruction,
  type EvidenceState,
} from '@/lib/audit/evidenceState';
import { evidenceBasisFor } from '@/lib/audit/evidenceBasis';

/**
 * CLAIM SAFETY IN THE SALES BRIEF
 *
 * The brief is the document a salesperson reads into a phone call. It is the
 * last place in the system where a hedge can be lost, and the first place where
 * losing one has a consequence: the audit says "requires manual validation", the
 * brief says "their ordering is broken", and the rep says that to an owner whose
 * ordering works. The call is over, and so is the relationship.
 *
 * Two rules, enforced structurally rather than by careful writing:
 *
 *   1. Every claim inherits the evidence state of the finding it came from, via
 *      `inheritState`. A brief claim can be weaker than its evidence; it can
 *      never be stronger.
 *   2. Definitive failure language ("broken", "failing", "unavailable", "dead
 *      end") is reachable only from VERIFIED. Everything else is phrased with
 *      "public evidence suggests", "appears", "may", "requires validation".
 */

export interface SalesBriefContent {
  leadQualityScore: number;
  salesOpportunityScore: number;
  painLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  buyerPersona: string;
  bestSalesAngle: string;
  topDiscoveryQuestion: string;
  discoveryQuestions: string[];
  likelyObjection: string;
  objectionStrategy: string;
  recommendedOffer: string;
  outreachAngle: string;
  emailOpener: string;
  callOpener: string;
  talkTrack: string;
  followUpAngle: string;
  priority: 'HOT' | 'WARM' | 'NURTURE' | 'LOW_PRIORITY';
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Internal WBI sales brief. Deterministic, grounded in audit evidence only.
 * Never invents owner names, revenue, staff counts, call volume, or financials.
 */
export function generateSalesBrief(input: {
  restaurantName: string;
  overallScore: number | null;
  coverageScore: number;
  topLeaks: RankedOpportunity[];
  journey: JourneyStageResult[];
  evidence: EvidenceRecordLike[];
  recommendedTier: string;
}): SalesBriefContent {
  const { restaurantName, overallScore, topLeaks, journey, recommendedTier } = input;

  // The finding to lead with. NOT simply the highest-priority one.
  //
  // Priority blends impact, urgency, confidence and AI fit, so an uncertain
  // transaction-link finding can outscore a validated opportunity — and then the
  // rep opens the call with the one claim they cannot defend. Evidence strength
  // is the primary sort; priority only breaks ties within a strength band.
  const leadFinding = selectLeadFinding(topLeaks);
  const topLeak = leadFinding?.leak ?? null;
  const leadState: EvidenceState = leadFinding?.state ?? 'INSUFFICIENT_DATA';
  const canAssert = mayStateDefinitively(leadState);
  // Strongly indicated by what the website itself shows, but not confirmed end
  // to end — for example a button read from the markup and never tapped on a
  // device. "Could not check from the outside" would understate it; asserting
  // it would overstate it. It is raised as what the site shows, plus a question.
  const strongLead = leadState === 'STRONG_EVIDENCE';
  // Where the finding's layers are known — what was verified, what was not
  // tested, what was not measured — they ARE the status. "Strongly indicated,
  // not yet confirmed" said less than the audit knew, about a button whose
  // markup was read straight off the page.
  const basis = topLeak && !canAssert ? evidenceBasisFor(topLeak.category) : null;

  // Lead quality: more confirmed, high-priority pain = better-qualified lead.
  const avgPriority = topLeaks.length ? topLeaks.reduce((s, l) => s + l.rescuePriorityScore, 0) / topLeaks.length : 0;
  const confirmedCount = topLeaks.filter((l) => !l.manualValidationRequired).length;
  const leadQualityScore = clamp(avgPriority * 0.7 + confirmedCount * 10 + (input.coverageScore >= 60 ? 10 : 0));

  const aiFitLeaks = topLeaks.filter((l) => l.aiFitScore >= 70);
  const salesOpportunityScore = clamp(avgPriority * 0.5 + aiFitLeaks.length * 15 + (overallScore !== null && overallScore < 70 ? 15 : 0));

  const painLevel: SalesBriefContent['painLevel'] =
    overallScore !== null && overallScore < 55 ? 'SEVERE' : avgPriority >= 70 ? 'HIGH' : avgPriority >= 50 ? 'MODERATE' : 'LOW';

  const priority: SalesBriefContent['priority'] =
    salesOpportunityScore >= 75 ? 'HOT' : salesOpportunityScore >= 55 ? 'WARM' : salesOpportunityScore >= 35 ? 'NURTURE' : 'LOW_PRIORITY';

  const phoneStage = journey.find((s) => s.stage === 'PHONE');
  const followUpStage = journey.find((s) => s.stage === 'FOLLOW_UP');

  const discoveryQuestions = buildDiscoveryQuestions(topLeaks, journey);

  // The finding's own title is written in plain assertive form ("...is
  // failing"), which is correct for a verified finding and a false claim for
  // anything else. Quoting it unchanged is how a hedge gets lost even though the
  // sentence around it is careful, so the title is rewritten to match the state
  // it was actually established at.
  const leadTitle = topLeak ? (canAssert ? topLeak.title : stripDefinitive(topLeak.title)) : null;

  const bestSalesAngle = topLeak
    ? canAssert
      ? `Lead with the audit evidence: "${topLeak.title}". It is verified, concrete, and about their own customers' experience — not about our product. State it plainly.`
      : // One status and one instruction. This said the finding was unconfirmed
        // three times in three phrasings, which reads as nervousness on a call.
        `Lead with the audit evidence: "${leadTitle}". Status: ${basis ? basis.summary : STATE_PLAIN[leadState]}. ` +
        `Open it as an observation and a question, never as a statement of fact. ${basis ? basis.nextCheck : validationInstruction(leadState, 'this finding')}`
    : 'Lead with the clean audit: their public presence is solid, so the open question is what happens off-line (calls, follow-up, repeat visits) — which only they can answer.';

  const likelyObjection = aiFitLeaks.length > 0
    ? '"We\'re too busy to set up new systems, and AI sounds complicated / impersonal for a restaurant."'
    : '"Our website is fine and business is okay — why would we pay for an audit or a system?"';

  const objectionStrategy = aiFitLeaks.length > 0
    // No invented share of calls: what fraction is repetitive is exactly what
    // their call records would show, and the rep may not supply a number.
    ? `Agree — being too busy is exactly the problem the system is built for. Reframe: the AI is designed to take the repetitive questions (hours, directions, FAQs, after-hours inquiries) so staff keep the conversations that need a person — and their own call records will show how much of the load that is before anything is installed. Offer the ${COMPANY.reviewMinutes}-minute review as zero-commitment proof, walking through their own audit evidence.`
    : 'Do not argue with "fine." Show the specific evidence from the audit and ask one discovery question about what the audit could not see. Position the discovery audit as a way to verify — not a sales pitch.';

  // WHAT A PROSPECT IS SHOWN IS CHOSEN BY MEANING, NOT BY POSITION.
  //
  // The hook used to be the finding's FIRST attached evidence record. For the
  // phone question that record is "A phone number is publicly displayed" — a
  // verified, healthy signal — and the email then told the owner the audit
  // "could not confirm" it. Now:
  //   - a verified finding quotes an observed GAP from its own evidence (a fact
  //     stating something was missing or failed), never a presence signal;
  //   - an unverified finding quotes no evidence at all. It is raised as the
  //     open question it is, because there is nothing confirmed to quote.
  const observedGap = topLeak && canAssert ? observedGapFor(topLeak, input.evidence) : null;
  const verifiedHook = topLeak ? observedGap ?? firstSentence(topLeak.problem) : null;
  const openQuestion = topLeak ? lowerFirst(leadTitle ?? topLeak.title) : null;

  // The one sentence a rep may actually say out loud about the lead finding.
  // Derived from the state, so a weaker finding cannot be phrased as a stronger
  // one however the surrounding copy is edited later.
  const leadClaim = topLeak
    ? canAssert
      ? `one thing stood out: ${verifiedHook}`
      : basis
        ? `one thing on the website stood out: ${basis.ownerObservation}. ${basis.ownerCaveat}, which is why I would like to check it with you`
        : strongLead
        ? `one thing the website itself points to: ${openQuestion}. I have not confirmed it end to end and I am not assuming what it costs you, which is why I would like to check it with you`
        : `one thing I could not check from the outside: ${openQuestion}. It is a question, not a finding, which is why I am asking rather than telling`
    : 'most of it came back strong';

  return {
    leadQualityScore,
    salesOpportunityScore,
    painLevel,
    buyerPersona:
      'Independent restaurant owner-operator or GM. Time-poor, works in service, skeptical of marketing vendors, responsive to concrete operational evidence about their own business. (Persona inferred from business type — no personal information about the actual owner was collected.)',
    bestSalesAngle,
    topDiscoveryQuestion: discoveryQuestions[0],
    discoveryQuestions,
    likelyObjection,
    objectionStrategy,
    recommendedOffer: recommendedTier,
    outreachAngle: topLeak
      ? `Reference the specific finding (${(leadTitle ?? topLeak.title).toLowerCase()}) with its evidence, offer the full audit free, and anchor the ask to a ${COMPANY.reviewMinutes}-minute review. Evidence first, product second.${canAssert ? '' : ' Ask about it rather than asserting it.'}`
      : `Compliment what the audit confirmed they do well, then raise the unverifiable areas as open questions worth a ${COMPANY.reviewMinutes}-minute review.`,
    emailOpener: topLeak
      ? `Subject: Found something on the ${restaurantName} website\n\nI ran a digital audit of ${restaurantName} and ${leadClaim}. I put the full findings in a short report — happy to send it over, no strings. Worth ${COMPANY.reviewMinutes} minutes?`
      // No general claim about what restaurants "lose": the open areas are
      // named as unknowns, which is all the audit can say about them.
      : `Subject: Quick note about the ${restaurantName} website\n\nI ran a digital audit of ${restaurantName} — most of it came back strong. A few things public data can't verify — calls, follow-up and repeat visits — are worth a short conversation. Happy to share the report — worth ${COMPANY.reviewMinutes} minutes?`,
    callOpener: topLeak
      ? canAssert
        ? `"Hi, this is [name] with Winnersbookmark — I put together a digital audit of ${restaurantName} and found something I think you'd want to know about: ${lowerFirst(topLeak.title)}. Do you have 90 seconds for the short version?"`
        : basis
          ? `"Hi, this is [name] with Winnersbookmark — I put together a digital audit of ${restaurantName}. One thing on your website I would like to check with you: ${basis.ownerObservation}. Can I ask you about it — 90 seconds?"`
          : strongLead
          ? `"Hi, this is [name] with Winnersbookmark — I put together a digital audit of ${restaurantName}. One thing your website points to that I would like to check with you: ${lowerFirst(leadTitle ?? topLeak.title)}. Can I ask you about it — 90 seconds?"`
          : `"Hi, this is [name] with Winnersbookmark — I put together a digital audit of ${restaurantName}. One thing I could not check from the outside: ${lowerFirst(leadTitle ?? topLeak.title)}. Can I ask you about it — 90 seconds?"`
      : `"Hi, this is [name] with Winnersbookmark — I ran a digital audit of ${restaurantName}. Good news: most of it is solid. I've got two questions about calls and repeat visits that a public audit can't answer. 90 seconds?"`,
    talkTrack: buildTalkTrack(restaurantName, overallScore, topLeaks, phoneStage, followUpStage, recommendedTier),
    followUpAngle: topLeak
      ? canAssert
        ? `If no response in 4–5 days: send one specific evidence item (${(verifiedHook ?? '').slice(0, 120)}) as a screenshot/quote with a one-line question. No pitch. Then a final value-add follow-up a week later.`
        : strongLead
          ? // The status is already in the sales angle; the follow-up only says how to send it.
            `If no response in 4–5 days: send the observation — "${leadTitle ?? topLeak.title}" — with a one-line question asking whether it matches what they see on their own phone. Quote it as what the website shows. No pitch. Then a final value-add follow-up a week later.`
          : `If no response in 4–5 days: send the open question itself — "${leadTitle ?? topLeak.title}" — as a one-line question. Attach no evidence item: this finding is not confirmed, so there is nothing to quote as fact. No pitch. Then a final value-add follow-up a week later.`
      : 'If no response: follow up once with a single useful observation from the audit, then move to nurture cadence.',
    priority,
  };
}

/**
 * Choose the finding to lead the call with.
 *
 * Evidence strength first, priority score only as a tie-break within a band.
 * This is the fix for "uncertain transaction-link findings outranking a stronger
 * validated opportunity": a MANUAL_VALIDATION_REQUIRED broken-link finding
 * scores 90 on impact and 90 on urgency, so on raw priority it beat a verified
 * technical failing every time — and it was the one claim the rep could not
 * stand behind.
 */
export function selectLeadFinding(
  leaks: RankedOpportunity[],
): { leak: RankedOpportunity; state: EvidenceState } | null {
  if (leaks.length === 0) return null;
  const scored = leaks.map((leak) => ({ leak, state: stateForOpportunity(leak) }));
  scored.sort((a, b) => {
    const byStrength = stateRank(b.state) - stateRank(a.state);
    if (byStrength !== 0) return byStrength;
    return b.leak.rescuePriorityScore - a.leak.rescuePriorityScore;
  });
  return scored[0];
}

/**
 * Strip definitive failure verbs out of a clause so it can carry a hedge.
 *
 * Cosmetic on its own — the real guarantee is that this is only ever applied to
 * copy already routed down a non-VERIFIED branch. It exists so a finding TITLE
 * written in plain assertive language ("A transaction link on the website is
 * failing") does not smuggle that assertion into a hedged sentence.
 */
function stripDefinitive(text: string): string {
  return text
    .replace(/\bis failing\b/gi, 'may not be working')
    .replace(/\bare failing\b/gi, 'may not be working')
    .replace(/\bis broken\b/gi, 'may not be working')
    .replace(/\bare broken\b/gi, 'may not be working')
    .replace(/\bis unavailable\b/gi, 'may be unavailable')
    .replace(/\bare unavailable\b/gi, 'may be unavailable')
    .replace(/\bdead end\b/gi, 'possible dead end')
    .replace(/\bfailed when tested\b/gi, 'did not respond as expected when tested');
}

/**
 * Minute ranges for the review agenda — frame, score, findings, verify, next
 * step — contiguous from 0 and ending at the review length. The next step takes
 * whatever the first four leave, so changing the review length cannot leave the
 * agenda adding up to something else.
 */
function reviewAgenda(totalMinutes: number): string[] {
  const bounds = [0];
  for (const length of [2, 3, 6, 5]) bounds.push(bounds[bounds.length - 1] + length);
  bounds.push(Math.max(totalMinutes, bounds[bounds.length - 1] + 1));
  return bounds.slice(0, -1).map((start, i) => `MINUTE ${start}–${bounds[i + 1]}`);
}

/**
 * The first fact in a verified finding's own evidence that states a GAP —
 * something missing, failed or not found — or null when it has none.
 *
 * Read for meaning, not position: evidence is attached in whatever order the
 * journey stage collected it, and a presence signal ("A phone number is
 * publicly displayed") is the opposite of a problem to show an owner.
 */
const GAP_FACT = /\b(no|not|without|lacks?|missing|failed|fails|could not|cannot|only)\b/i;
function observedGapFor(leak: RankedOpportunity, evidence: EvidenceRecordLike[]): string | null {
  for (const id of leak.evidenceIds) {
    const record = evidence.find((e) => e.id === id);
    if (record && GAP_FACT.test(record.fact.slice(0, 80))) return record.fact;
  }
  return null;
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildDiscoveryQuestions(topLeaks: RankedOpportunity[], journey: JourneyStageResult[]): string[] {
  const questions: string[] = [];
  const phone = journey.find((s) => s.stage === 'PHONE');
  const followUp = journey.find((s) => s.stage === 'FOLLOW_UP');
  const hasCatering = topLeaks.some((l) => /CATERING/i.test(l.category));
  const hasOrdering = topLeaks.some((l) => /ORDERING/i.test(l.category));
  const orderButtonMismatch = topLeaks.some((l) => /ORDER BUTTON/i.test(l.category));

  if (phone && phone.status !== 'HEALTHY') {
    questions.push('During your busiest service periods, what happens when your team cannot immediately answer the phone?');
  }
  if (orderButtonMismatch) {
    questions.push('Your website\'s online ordering button places a phone call — is online ordering meant to be offered, or is ordering by phone the plan?');
  }
  questions.push('What questions does your staff answer repeatedly every day — on the phone or at the door?');
  if (followUp && followUp.status !== 'HEALTHY') {
    questions.push('Do you currently have an automated system for following up with customers after they visit or order?');
  }
  if (hasCatering) {
    questions.push('What happens to catering, private dining, or large-party inquiries that come in after hours?');
  }
  if (hasOrdering) {
    questions.push('Roughly what share of your online orders come through third-party apps versus direct, and do you know what the commissions cost you monthly?');
  }
  questions.push('Do you have a process for bringing customers back who have not visited in 60, 90, or 180 days?');
  questions.push('If your phone, reservations, and follow-up ran themselves for a week, where would you spend the time you got back?');
  return questions.slice(0, 5);
}

function buildTalkTrack(
  name: string,
  score: number | null,
  topLeaks: RankedOpportunity[],
  phone: JourneyStageResult | undefined,
  followUp: JourneyStageResult | undefined,
  tier: string,
): string {
  const lines: string[] = [];
  // Built from the configured review length, so the agenda always totals it.
  const [frame, scoreBlock, findingsBlock, verify, nextStep] = reviewAgenda(COMPANY.reviewMinutes);
  lines.push(`${frame} — Frame: "I audited ${name}'s public digital presence the way a customer experiences it. Everything I'm about to show you is evidence from your own website — and I'll flag anything that's an assumption."`);
  lines.push(
    score !== null
      ? `${scoreBlock} — Score: walk through the Rescue Score (${score}/100) and coverage. Emphasize what scored well first — credibility before critique.`
      : `${scoreBlock} — Coverage: explain what could and could not be verified publicly. Honesty about limits is the differentiator.`,
  );
  if (topLeaks.length > 0) {
    // Each finding is labelled with the strength it was actually established
    // at, so the rep does not have to remember which of three findings was the
    // confirmed one while a restaurant owner is listening. One line each: run
    // together with "ask about it, do not assert it" after every one, the list
    // was a paragraph a rep could not find their place in.
    const labelled = topLeaks.map((l) => {
      const state = stateForOpportunity(l);
      if (mayStateDefinitively(state)) return `• "${l.title}" — VERIFIED, state it plainly`;
      const layers = evidenceBasisFor(l.category);
      return `• "${stripDefinitive(l.title)}" — ${layers ? layers.summary : STATE_PLAIN[state]}`;
    });
    lines.push(
      // "Why it costs you customers" asserted a loss for every finding,
      // including the ones the brief itself says not to assert.
      `${findingsBlock} — Top findings: show the top ${topLeaks.length} findings with their evidence. For each: "here's what we saw, here's what we could not see, here's how you can check it." ` +
        'Say only what the evidence supports:',
      ...labelled,
    );
    // One instruction for everything not confirmed, said once. It used to
    // open "the strongest claim this brief supports overall is: not
    // confirmed", which read as a verdict on findings whose evidence was
    // verified.
    const open = topLeaks.filter((l) => !mayStateDefinitively(stateForOpportunity(l))).length;
    if (open > 0) {
      const combined = inheritState(...topLeaks.map(stateForOpportunity));
      const which =
        open === topLeaks.length
          ? topLeaks.length === 1
            ? 'This finding is not'
            : `None of these ${topLeaks.length} findings is`
          : `${open} of these ${topLeaks.length} findings are not`;
      lines.push(
        `EVIDENCE DISCIPLINE — ${which} confirmed end to end. ${validationInstruction(combined, 'these findings')} ` +
          'Present each as an observation to check with the owner, never as a confirmed defect.',
      );
    }
  } else {
    lines.push(`${findingsBlock} — Findings: public presence is solid; pivot to the three areas public data cannot see (calls, follow-up, reactivation) and ask the discovery questions.`);
  }
  lines.push(`${verify} — Verify: ask the top discovery questions. Their answers confirm or kill the assumptions — say so out loud, it builds trust.`);
  lines.push(`${nextStep} — Next step: recommend ${tier} and explain exactly why the evidence points there. If their answers changed the picture, say that instead. Book the follow-up before hanging up.`);
  return lines.join('\n');
}
