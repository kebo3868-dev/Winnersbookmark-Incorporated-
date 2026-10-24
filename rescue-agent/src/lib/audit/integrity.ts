import type { EvidenceInput, EvidenceRecordLike } from '@/types/audit';

export type FindingStatus = 'CONFIRMED' | 'PARTIALLY VERIFIED' | 'MANUAL REVIEW REQUIRED' | 'NOT OBSERVED' | 'SCAN ERROR' | 'NOT APPLICABLE';
export function evidenceConfidence(n: number): 'High' | 'Medium' | 'Low' {
  return n >= 80 ? 'High' : n >= 60 ? 'Medium' : 'Low';
}
export const CONFIDENCE_DEFINITION = 'Evidence confidence is a deterministic heuristic, not a calibrated probability: High (80–100) means direct public markup or a recorded HTTP observation; Medium (60–79) means limited or indirect evidence; Low (below 60) means insufficient or ambiguous evidence. Confidence does not verify a transaction or internal operation.';

// Conservative prose-based display adapter for current and historical records.
// A future schema migration should persist status and verification method explicitly.
export function findingStatus(e: Pick<EvidenceRecordLike, 'evidenceType' | 'fact' | 'supportingContext'>): FindingStatus {
  if (e.evidenceType === 'COLLECTION_FAILURE') return 'SCAN ERROR';
  if (/not applicable/i.test(e.fact)) return 'NOT APPLICABLE';
  if (/manual (?:validation|review)|not verified|unverified|could not be verified|could not be resolved|widget|PAGE_MARKUP|ORDERING_PATH_UNCLEAR/i.test(e.fact + ' ' + (e.supportingContext ?? ''))) return 'MANUAL REVIEW REQUIRED';
  if (/^no |not detected|not observed/i.test(e.fact)) return 'NOT OBSERVED';
  if (/owner.reported|appears|likely|can dilute|friction|hypothesis/i.test(e.fact)) return 'PARTIALLY VERIFIED';
  return 'CONFIRMED';
}

/** Preserve case-sensitive paths and meaningful query parameters. */
export function canonicalEvidenceUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString();
  } catch { return raw; }
}

/** Same source + category + fact only; distinct supporting sources survive. */
export function deduplicateEvidence(items: EvidenceInput[]): EvidenceInput[] {
  const seen = new Set<string>();
  return items.filter((e) => {
    const key = JSON.stringify([canonicalEvidenceUrl(e.sourceUrl ?? ''), e.evidenceType, e.fact.replace(/\s+/g, ' ').trim()]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
