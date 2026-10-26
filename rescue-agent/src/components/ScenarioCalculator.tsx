'use client';

import { useState } from 'react';
import { calculateScenario, SCENARIO_SPECS, type ScenarioKind } from '@/lib/reports/scenarios';

/**
 * OPTIONAL SCENARIO CALCULATOR.
 *
 * Every quantity is typed in by the reader; nothing is filled in on their
 * behalf except a figure they already gave us (the average ticket entered when
 * the audit was requested). Until every input is entered, no figure is shown.
 * The calculation runs in the browser and is not stored or sent anywhere.
 */
export default function ScenarioCalculator({
  kind,
  findingTitle,
  observedFriction,
  prefill,
}: {
  kind: ScenarioKind;
  findingTitle: string;
  observedFriction: string;
  prefill: Record<string, number>;
}) {
  const spec = SCENARIO_SPECS[kind];
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.fields.map((f) => [f.key, prefill[f.key] !== undefined ? String(prefill[f.key]) : ''])),
  );
  const values = Object.fromEntries(
    spec.fields.map((f) => [f.key, raw[f.key].trim() === '' ? null : Number(raw[f.key])]),
  );
  const result = calculateScenario(kind, values, observedFriction);
  const missing = spec.fields.filter((f) => raw[f.key].trim() === '').length;

  return (
    <div className="card p-5 sm:p-6 border-gold-dim/30">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h3 className="font-display text-lg text-ivory">{spec.pathwayTitle}</h3>
        <span className="text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 text-gold border-gold/40">Optional · your figures</span>
      </div>
      <p className="text-ivory-faint text-xs mb-4">For: {findingTitle}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {spec.fields.map((f) => (
          <label key={f.key} className="block text-xs text-ivory-dim">
            <span className="block mb-1">{f.label}</span>
            <input
              value={raw[f.key]}
              onChange={(e) => setRaw((r) => ({ ...r, [f.key]: e.target.value }))}
              inputMode="decimal"
              aria-label={f.label}
              className="w-full"
            />
          </label>
        ))}
      </div>
      <p className="text-ivory-faint text-[11px] mt-3">Formula: {spec.formula}</p>
      {result ? (
        <div className="mt-4 border-t border-obsidian-line pt-4 grid sm:grid-cols-2 gap-3">
          <div>
            <p className="label">What-if, per month</p>
            <p className="font-display text-2xl text-gold">{result.monthlyExposure}</p>
          </div>
          <div>
            <p className="label">What-if, per year</p>
            <p className="font-display text-2xl text-gold">{result.annualExposure}</p>
          </div>
          <p className="sm:col-span-2 text-gold-dim text-xs">{result.confidenceStatement}</p>
        </div>
      ) : (
        <p className="mt-4 text-ivory-faint text-xs">
          {missing > 0
            ? `Enter all ${spec.fields.length} figures to see a what-if. No figure is shown until every input is yours.`
            : 'Check the figures: amounts must be zero or more, percentages at most 100, and periods per year at most 366.'}
        </p>
      )}
      <p className="text-ivory-faint text-[11px] mt-3">Records to check your figures against: {spec.dataRequiredToValidate.join(' · ')}</p>
    </div>
  );
}
