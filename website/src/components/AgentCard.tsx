import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import type { Agent } from '@/data/agents';

/**
 * The card used everywhere an agent is listed. Because it renders straight from
 * a registry entry, a new agent appears on the homepage, the solutions index
 * and anywhere else this is used the moment it is added to the data — with its
 * real status attached, not a status someone remembered to update.
 *
 * The whole card is the link target (via a stretched ::after on the anchor), so
 * a visitor on a phone can tap anywhere on it, while screen readers still get a
 * single, well-named link rather than a card full of nested ones.
 */
export default function AgentCard({ agent }: { agent: Agent }) {
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden p-7 sm:p-9">
      {/* Lit top edge on hover — the only motion on the card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-electric-light/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-snow-faint">
          Agent {String(agent.order).padStart(2, '0')}
        </span>
        <StatusBadge status={agent.status} />
      </div>

      <h3 className="mt-8 font-display text-[clamp(1.9rem,3.4vw,2.5rem)] leading-[1.05] tracking-[-0.015em] text-snow">
        {agent.name}
      </h3>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-snow-dim">{agent.tagline}</p>

      <ul className="mt-7 divide-y divide-night-line border-y border-night-line">
        {agent.outcomes.slice(0, 3).map((outcome) => (
          <li key={outcome} className="flex gap-3 py-3 text-sm leading-relaxed text-snow-dim">
            <span aria-hidden="true" className="mt-[3px] font-mono text-[11px] text-electric-light">
              ✓
            </span>
            {outcome}
          </li>
        ))}
      </ul>

      {/* mt-auto pins the action to the bottom so cards of differing text
          length still line their buttons up across a grid row. */}
      <div className="mt-auto pt-8">
        <Link
          href={`/solutions/${agent.slug}`}
          className="btn-ghost after:absolute after:inset-0 after:content-['']"
          aria-label={`Learn more about ${agent.name}`}
        >
          Learn more
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}
