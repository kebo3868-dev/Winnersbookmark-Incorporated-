import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import { BookmarkNotch } from './Logo';
import type { Agent } from '@/data/agents';

/**
 * THE AGENT CARD
 *
 * Presents each agent as a proprietary product rather than a service package.
 * Three things do that work:
 *
 *  1. A monitor-style readout with its own chrome, so the card contains a piece
 *     of the product rather than only describing it.
 *  2. A relative proportion bar — deliberately unlabeled. It shows the SHAPE
 *     of what the system handles without asserting a measured quantity, which
 *     the company has no data to support.
 *  3. Real operational status, read from the registry.
 *
 * Renders from a registry entry, so a new agent gets this treatment
 * automatically. An agent with no truthful readout omits the panel rather than
 * showing a placeholder.
 */
export default function AgentCard({ agent, index = 0 }: { agent: Agent; index?: number }) {
  const bars = agent.signal?.weights ?? [];
  const total = bars.reduce((a, b) => a + b, 0) || 1;

  return (
    <article className="surface-interactive group flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-6 pb-5 sm:p-7 sm:pb-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <BookmarkNotch size={10} className="text-cobalt-core" />
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-muted">
              WBI Agent {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <h3 className="text-display-3 text-text-bright">{agent.name}</h3>
        </div>
        <StatusBadge status={agent.status} className="mt-1" />
      </div>

      <p className="px-6 text-body text-text-secondary sm:px-7">{agent.tagline}</p>

      {/* Readout */}
      {agent.signal && (
        <div className="mx-6 mt-6 overflow-hidden rounded-[10px] border border-ink-line bg-ink-base/70 sm:mx-7">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-2.5">
            <span className="metric-label">{agent.signal.caption}</span>
            <span className="status-dot bg-cobalt-bright" />
          </div>

          <ul className="divide-y divide-ink-line/60">
            {agent.signal.rows.map((row) => (
              <li key={row} className="flex items-center gap-2.5 px-4 py-2.5">
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-cobalt-core" />
                <span className="truncate text-[0.8125rem] text-text-secondary">{row}</span>
              </li>
            ))}
          </ul>

          {/* Unlabeled proportion bar — a shape, never a claimed number. */}
          {bars.length > 0 && (
            <div className="px-4 pb-4 pt-3.5">
              <div className="flex h-1 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
                {bars.map((w, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-cobalt-core transition-opacity duration-300"
                    style={{ flex: `0 0 ${(w / total) * 100}%`, opacity: 1 - i * 0.19 }}
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-text-faint">
                Relative distribution of what this system handles. Not a performance measurement.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action — mt-auto keeps buttons aligned across a grid row */}
      <div className="mt-auto p-6 pt-6 sm:p-7 sm:pt-7">
        <Link href={`/solutions/${agent.slug}`} className="btn-text" aria-label={`Learn more about ${agent.name}`}>
          Learn more
          <span aria-hidden="true" className="arrow">→</span>
        </Link>
      </div>
    </article>
  );
}
