import { ORDERING_CHANNEL_HEAD, parseOrderingChannelFact } from '@/lib/audit/orderingChannel';

/**
 * THE CLIENT COPY FOR THE "ORDER ONLINE" BUTTON THAT PLACES A PHONE CALL.
 *
 * One finding, said once. The card used to state the same observation four
 * times — as the business problem, again under "What we know" from the
 * ordering-channel record, a third time from the ordering-path record, and in
 * the evidence layers above them — and attached "VERIFIED IN THE PAGE MARKUP /
 * NOT YET TESTED / NOT MEASURED" to the problem as well as printing them as
 * the layers. Each part of the card now carries one thing:
 *
 *   problem         the observation;
 *   businessImpact  what it means for a visitor;
 *   facts           only evidence the card has not already stated — the
 *                   ordering address that sits in the page code unlinked;
 *   recommended     the decision to make, and the check after the change.
 *
 * The evidence layers (evidenceBasis.ts) carry what was automated, what is a
 * separate manual check and what is not measured.
 *
 * Built from the stored evidence records, so the leak rule writes it for a new
 * audit and the report builder rebuilds it for an audit stored before it
 * existed. No state, score or priority is read or changed here.
 */

export const ORDER_BUTTON_CATEGORY = 'ORDER BUTTON LABEL MISMATCH';

type EvidenceText = { evidenceType: string; fact: string; supportingContext?: string | null };

/** An ordering address present in the page code that no visible button or link points to. */
export interface UnlinkedOrderingAddress {
  url: string;
  /** Query parameters written with no value (`?spot_id=`), which make the address read as unfinished. */
  emptyParameters: string[];
  /** The audit's request for it: `HTTP 404`, a network note, or null when it was not requested. */
  testNote: string | null;
  /** True when the request failed, false when it answered, null when not requested. */
  testFailed: boolean | null;
}

export interface OrderButtonFindingCopy {
  problem: string;
  businessImpact: string;
  facts: string[];
  recommendedSolution: string;
}

/** The ordering-channel record that carries the online-label / phone-call mismatch, if any. */
function mismatchRecord(records: EvidenceText[]): EvidenceText | undefined {
  return records.find(
    (e) => e.evidenceType === 'ORDERING_CHANNEL' && parseOrderingChannelFact(e.fact)?.onlineLabelOpensPhone === true,
  );
}

/**
 * Query parameters written as `name=` with nothing after the equals sign. A
 * bare flag such as `?debug` has no equals sign and is not unfinished.
 */
function emptyParametersOf(url: string): string[] {
  const query = url.split('#')[0].split('?')[1];
  if (query === undefined) return [];
  return query
    .split('&')
    .map((pair) => pair.split('='))
    .filter(([name, value]) => Boolean(name) && value === '')
    .map(([name]) => name);
}

/**
 * The page-code ordering address and the audit's request for it.
 *
 * Read only from the "declared … but is not linked for customers" wording the
 * ordering channel writes for a markup-only destination. A destination that
 * IS linked is not this case and is left to the existing records.
 */
export function readUnlinkedOrderingAddress(records: EvidenceText[]): UnlinkedOrderingAddress | null {
  const channel = mismatchRecord(records);
  const url = channel?.supportingContext?.match(/declared in the page markup \(([^)\s]+)\) but is not linked for customers/)?.[1];
  if (!url) return null;
  const probe = records.find(
    (e) =>
      e.evidenceType === 'ORDERING_PATH' &&
      typeof e.supportingContext === 'string' &&
      (e.supportingContext === url || e.supportingContext.startsWith(`${url}.`) || e.supportingContext.startsWith(`${url} `)),
  );
  let testNote: string | null = null;
  let testFailed: boolean | null = null;
  if (probe) {
    const failed = probe.fact.match(/(?:could not be verified|failed) when tested \((.*)\)(?: — manual validation required)?\.$/);
    const answered = probe.fact.match(/\((HTTP \d{3}[^)]*|fetched[^)]*)\)/);
    if (failed) {
      testNote = failed[1];
      testFailed = true;
    } else if (answered) {
      testNote = answered[1];
      testFailed = false;
    }
  }
  return { url, emptyParameters: emptyParametersOf(url), testNote, testFailed };
}

/** The observation itself: the first sentence of the ordering-channel summary. */
function observationOf(channel: EvidenceText): string {
  return channel.fact.replace(ORDERING_CHANNEL_HEAD, '').split(/(?<=\.)\s/)[0];
}

/** The one line the card adds about the unlinked address: not customer-facing, and no effect claimed. */
export function unlinkedAddressFact(address: UnlinkedOrderingAddress): string {
  const incomplete =
    address.emptyParameters.length > 0
      ? ` It appears incomplete: ${address.emptyParameters.map((p) => `"${p}"`).join(', ')} ${
          address.emptyParameters.length === 1 ? 'has' : 'have'
        } no value.`
      : '';
  const tested =
    address.testFailed === true
      ? ` When the audit requested it, it did not load (${address.testNote}).`
      : address.testFailed === false
        ? ` When the audit requested it, it responded (${address.testNote}).`
        : '';
  return (
    `The page code also contains an online ordering address that no button or link on the page points to: ${address.url}.` +
    incomplete +
    tested +
    // Said without "broken" or "lost", even negated: a reader skimming the
    // card should not meet either word attached to this address.
    ' Customers are not offered this address, so it is not treated as an ordering button they use, and no effect on ' +
    'orders or revenue is claimed from it.'
  );
}

/** The card's copy, or null when the evidence carries no mismatch. */
export function orderButtonFindingCopy(records: EvidenceText[]): OrderButtonFindingCopy | null {
  const channel = mismatchRecord(records);
  if (!channel) return null;
  const address = readUnlinkedOrderingAddress(records);
  const addressStep = address
    ? address.emptyParameters.length > 0
      ? ', and complete or remove the unfinished ordering address in the page code'
      : ', and check the unlinked ordering address in the page code'
    : '';
  return {
    problem: observationOf(channel),
    businessImpact: 'A visitor who chooses to order online is offered a phone call instead of the online checkout the label promises.',
    facts: address ? [unlinkedAddressFact(address)] : [],
    recommendedSolution:
      // "Set up the online ordering page" presumed there is none. The audit
      // does not know: it saw the button, not the restaurant's ordering account.
      `Decide which experience is intended. If online ordering should be offered, point the button at the restaurant's online ordering page — setting one up first if none exists${addressStep}. ` +
      'If orders are taken by phone, relabel the section — for example "Order by Phone" — so the button does what it says. ' +
      'After the change, tap the button on a phone to confirm it behaves as intended. A direct website fix, not an AI project.',
  };
}
