'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STAGE_LABELS: Record<string, string> = {
  INITIALIZING: 'INITIALIZING…',
  VALIDATING_WEBSITE: 'VALIDATING WEBSITE…',
  DISCOVERING_PAGES: 'DISCOVERING RESTAURANT PAGES…',
  COLLECTING_EVIDENCE: 'COLLECTING EVIDENCE…',
  ANALYZING_CUSTOMER_JOURNEY: 'ANALYZING CUSTOMER JOURNEY…',
  DETECTING_REVENUE_LEAKS: 'DETECTING REVENUE LEAKS…',
  SCORING_OPPORTUNITIES: 'SCORING OPPORTUNITIES…',
  CALCULATING_RESCUE_SCORE: 'CALCULATING RESCUE SCORE…',
  GENERATING_OWNER_REPORT: 'GENERATING EXECUTIVE REPORT…',
  GENERATING_SALES_BRIEF: 'GENERATING SALES BRIEF…',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

/** Polls real persisted pipeline stages — no fake progress. */
export default function AuditProgress({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<string>('INITIALIZING');
  const [failureReason, setFailureReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audits/${auditId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStage(data.currentStage);
        setFailureReason(data.failureReason);
        if (['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(data.status)) {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        /* transient poll failure — keep polling */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auditId, router]);

  return (
    <div className="card p-10 text-center space-y-4">
      <div className="inline-block h-10 w-10 rounded-full border-2 border-gold-dim border-t-gold animate-spin" />
      <p className="font-display text-xl text-gold tracking-wide">{STAGE_LABELS[stage] ?? stage}</p>
      <p className="text-ivory-faint text-xs uppercase tracking-widest">Live pipeline stage — progress reflects actual system operations</p>
      {failureReason && <p className="text-red-300 text-sm">{failureReason}</p>}
    </div>
  );
}
