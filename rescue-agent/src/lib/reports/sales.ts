import type { EvidenceRecordLike, JourneyStageResult } from '@/types/audit';
import type { RankedOpportunity } from './owner';
import {
  inheritState,
  mayStateDefinitively,
  stateForOpportunity,
  stateRank,
  validationInstruction,
  type EvidenceState,
} from '@/lib/audit/evidenceState';

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

  const bestSalesAngle = topLeak
    ? canAssert
      ? `Lead with the audit evidence: "${topLeak.title}". It is verified, concrete, and about their money — not about our product. State it plainly.`
      : `Lead with the audit evidence: "${topLeak.title}". [${leadState}] Public evidence suggests this and it is NOT confirmed — open it as an observation and a question, never as a statement of fact. ${validationInstruction(leadState, 'this finding')}`
    : 'Lead with the clean audit: their public presence is solid, so the open question is what happens off-line (calls, follow-up, repeat visits) — which only they can answer.';

  const likelyObjection = aiFitLeaks.length > 0
    ? '"We\'re too busy to set up new systems, and AI sounds complicated / impersonal for a restaurant."'
    : '"Our website is fine and business is okay — why would we pay for an audit or a system?"';

  const objectionStrategy = aiFitLeaks.length > 0
    ? 'Agree — being too busy is exactly the problem the system absorbs. Reframe: the AI handles the repetitive 80% (hours, directions, FAQs, after-hours inquiries) so staff handle the human 20%. Offer the 15-minute review as zero-commitment proof, walking through their own audit evidence.'
    : 'Do not argue with "fine." Show the specific evidence from the audit and ask one discovery question about what the audit could not see. Position the discovery audit as a way to verify — not a sales pitch.';

  const evidenceHook = topLeak?.evidenceIds.length
    ? input.evidence.find((e) => e.id === topLeak.evidenceIds[0])?.fact ?? topLeak.problem
    : 'the public audit of their website';

  // The one sentence a rep may actually say out loud about the lead finding.
  // Derived from the state, so a weaker finding cannot be phrased as a stronger
  // one however the surrounding copy is edited later.
  const leadClaim = topLeak
    ? canAssert
      ? `one thing stood out: ${evidenceHook}`
      : `one thing worth a look: public evidence suggests ${lowerFirst(stripDefinitive(evidenceHook))} — I could not confirm it from the outside, which is why I am asking rather than telling`
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
      ? `Reference the specific finding (${topLeak.title.toLowerCase()}) with its evidence, offer the full audit free, and anchor the ask to a 15-minute review. Evidence first, product second.`
      : 'Compliment what the audit confirmed they do well, then raise the unverifiable areas as open questions worth 15 minutes.',
    emailOpener: topLeak
      ? `Subject: Found something on the ${restaurantName} website\n\nI ran a digital audit of ${restaurantName} and ${leadClaim}. I put the full findings in a short report — happy to send it over, no strings. Worth 15 minutes?`
      : `Subject: Quick note about the ${restaurantName} website\n\nI ran a digital audit of ${restaurantName} — most of it came back strong. Two or three things public data can't verify are usually where restaurants quietly lose repeat business. Happy to share the report — worth 15 minutes?`,
    callOpener: topLeak
      ? canAssert
        ? `"Hi, this is [name] with Winners Bookmark — I put together a digital audit of ${restaurantName} and found something I think you'd want to know about: ${lowerFirst(topLeak.title)}. Do you have 90 seconds for the short version?"`
        : `"Hi, this is [name] with Winners Bookmark — I put together a digital audit of ${restaurantName}. One thing I could not check from the outside: ${lowerFirst(stripDefinitive(topLeak.title))}. Can I ask you about it — 90 seconds?"`
      : `"Hi, this is [name] with Winners Bookmark — I ran a digital audit of ${restaurantName}. Good news: most of it is solid. I've got two questions the audit couldn't answer that usually decide whether a restaurant is leaking repeat business. 90 seconds?"`,
    talkTrack: buildTalkTrack(restaurantName, overallScore, topLeaks, phoneStage, followUpStage, recommendedTier),
    followUpAngle: topLeak
      ? `If no response in 4–5 days: send one specific evidence item (${evidenceHook.slice(0, 120)}) as a screenshot/quote with a one-line question. No pitch${canAssert ? '' : ', and keep it as a question — this finding is not confirmed'}. Then a final value-add follow-up a week later.`
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

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildDiscoveryQuestions(topLeaks: RankedOpportunity[], journey: JourneyStageResult[]): string[] {
  const questions: string[] = [];
  const phone = journey.find((s) => s.stage === 'PHONE');
  const followUp = journey.find((s) => s.stage === 'FOLLOW_UP');
  const hasCatering = topLeaks.some((l) => /CATERING/i.test(l.category));
  const hasOrdering = topLeaks.some((l) => /ORDERING/i.test(l.category));

  if (phone && phone.status !== 'HEALTHY') {
    questions.push('During your busiest service periods, what happens when your team cannot immediately answer the phone?');
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
  lines.push(`MINUTE 0–2 — Frame: "I audited ${name}'s public digital presence the way a customer experiences it. Everything I'm about to show you is evidence from your own website — and I'll flag anything that's an assumption."`);
  lines.push(
    score !== null
      ? `MINUTE 2–5 — Score: walk through the Rescue Score (${score}/100) and coverage. Emphasize what scored well first — credibility before critique.`
      : 'MINUTE 2–5 — Coverage: explain what could and could not be verified publicly. Honesty about limits is the differentiator.',
  );
  if (topLeaks.length > 0) {
    // Each finding is labelled with the strength it was actually established
    // at, so the rep does not have to remember which of three findings was the
    // confirmed one while a restaurant owner is listening.
    const labelled = topLeaks
      .map((l) => {
        const state = stateForOpportunity(l);
        return mayStateDefinitively(state)
          ? `"${l.title}" — VERIFIED, state it plainly`
          : `"${l.title}" — ${state}, ask about it, do not assert it`;
      })
      .join('; ');
    lines.push(
      `MINUTE 5–10 — Top leaks: show the top ${topLeaks.length} findings with their evidence. For each: "here's what we saw, here's why it costs you customers, here's the fix." ` +
        `Say only what the evidence supports — ${labelled}.`,
    );
    // The combined claim strength of everything being presented. A talk track
    // built on three unconfirmed findings is not a confident conversation, and
    // saying so here is cheaper than saying it after the call.
    const combined = inheritState(...topLeaks.map(stateForOpportunity));
    if (!mayStateDefinitively(combined)) {
      lines.push(
        `EVIDENCE DISCIPLINE — the strongest claim this brief supports overall is ${combined}. ` +
          `${validationInstruction(combined, 'these findings')} Do not describe anything here as broken, failing, unavailable or a dead end.`,
      );
    }
  } else {
    lines.push('MINUTE 5–10 — Findings: public presence is solid; pivot to the three areas public data cannot see (calls, follow-up, reactivation) and ask the discovery questions.');
  }
  lines.push(`MINUTE 10–13 — Verify: ask the top discovery questions. Their answers confirm or kill the assumptions — say so out loud, it builds trust.`);
  lines.push(`MINUTE 13–15 — Next step: recommend ${tier} and explain exactly why the evidence points there. If their answers changed the picture, say that instead. Book the follow-up before hanging up.`);
  return lines.join('\n');
}
