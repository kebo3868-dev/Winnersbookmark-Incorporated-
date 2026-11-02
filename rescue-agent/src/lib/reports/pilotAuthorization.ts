/**
 * WHEN MAY AN AUTOMATION BE IMPLEMENTED? ONLY ON STRUCTURED, BOUND RECORDS.
 *
 * The earlier design let a sentence "authorise" a pilot by carrying the
 * gate's words — and words can name another restaurant's demand, another
 * product's tests or a vendor's approval. Authorisation is now a decision over
 * structured records, each bound to the restaurant being audited AND the
 * product being proposed:
 *
 *   demand     a record from this restaurant's own operating data showing
 *              measurable demand for this product, verified by the operator;
 *   readiness  this product's own readiness test AND safety test for this
 *              restaurant, both completed and passed;
 *   approval   this restaurant's owner approving a limited, monitored pilot of
 *              this product.
 *
 * A record for another restaurant, another product or another approver does
 * not count; a failed, incomplete or unverified one does not count. Free text
 * never counts: nothing a summary, a stored recommendation or a Sales Brief
 * says can produce an authorisation.
 *
 * The audit stores none of these records today (no schema change in this
 * release), so implementation is never authorised and every report offers at
 * most the conditional pilot decision, from its deterministic templates, for a
 * pilot candidate the audit's own scored findings identified
 * (isAutomationCandidate). This module is where an implementation decision
 * would be made once such records exist; until then it is the reason none is.
 */

export interface PilotTarget {
  /** The restaurant being audited. */
  restaurantId: string;
  /** The product being proposed, by its solution category ("AI Front Desk & Missed-Call Text Back"). */
  product: string;
}

export interface DemandRecord {
  restaurantId: string;
  product: string;
  source: 'RESTAURANT_OPERATING_RECORDS' | 'INDUSTRY_DATA' | 'VENDOR_DATA' | 'OTHER';
  measurableDemand: boolean;
  verifiedByOperator: boolean;
}

export interface ReadinessRecord {
  restaurantId: string;
  product: string;
  readinessTest: 'PASSED' | 'FAILED' | 'INCOMPLETE';
  safetyTest: 'PASSED' | 'FAILED' | 'INCOMPLETE';
}

export interface ApprovalRecord {
  restaurantId: string;
  product: string;
  approverRole: 'OWNER' | 'VENDOR' | 'OPERATOR' | 'STAFF' | 'OTHER';
  decision: 'APPROVED' | 'WITHHELD' | 'DECLINED';
  scope: 'LIMITED_MONITORED_PILOT' | 'FULL_ROLLOUT' | 'OTHER';
}

export interface PilotRecords {
  demand: DemandRecord[];
  readiness: ReadinessRecord[];
  approvals: ApprovalRecord[];
}

/** What the audit stores today: nothing. */
export const NO_PILOT_RECORDS: PilotRecords = { demand: [], readiness: [], approvals: [] };

export type PilotRequirement = 'demand' | 'readiness' | 'approval';

export interface PilotAuthorisation {
  implementationAuthorised: boolean;
  missing: PilotRequirement[];
}

const bound = (r: { restaurantId: string; product: string }, t: PilotTarget) =>
  r.restaurantId === t.restaurantId && r.product === t.product;

/**
 * Whether a limited, monitored pilot of `target.product` may be implemented at
 * `target.restaurantId`. Every requirement must be met by a record bound to
 * both; anything else is missing.
 */
export function authorisePilotImplementation(target: PilotTarget, records: PilotRecords): PilotAuthorisation {
  const missing: PilotRequirement[] = [];
  if (!records.demand.some((d) => bound(d, target) && d.source === 'RESTAURANT_OPERATING_RECORDS' && d.measurableDemand && d.verifiedByOperator)) {
    missing.push('demand');
  }
  if (!records.readiness.some((r) => bound(r, target) && r.readinessTest === 'PASSED' && r.safetyTest === 'PASSED')) {
    missing.push('readiness');
  }
  if (!records.approvals.some((a) => bound(a, target) && a.approverRole === 'OWNER' && a.decision === 'APPROVED' && a.scope === 'LIMITED_MONITORED_PILOT')) {
    missing.push('approval');
  }
  return { implementationAuthorised: missing.length === 0, missing };
}
