import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import type { Agent } from '@/data/agents';

/**
 * The card used everywhere an agent is listed. Because it renders straight from
 * a registry entry, a new agent appears on the homepage, the solutions index
 * and anywhere else this is used the moment it is added to the data — with its
 * real status attached, not a status someone remembered to update.
 */
export default function AgentCard({ agent }: { agent: Agent }) {
  return (
    <article className="card card-hover group flex flex-col p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-display-sm font-bold text-snow">{agent.name}</h3>
        <StatusBadge status={agent.status} />
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-snow-dim">{agent.tagline}</p>

      <ul className="mt-6 space-y-2.5">
        {agent.outcomes.slice(0, 3).map((outcome) => (
          <li key={outcome} className="flex gap-2.5 text-sm text-snow-dim">
            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-electric-light" />
            {outcome}
          </li>
        ))}
      </ul>

      {/* mt-auto pins the action to the bottom so cards of differing text
          length still line their buttons up across a grid row. */}
      <div className="mt-auto pt-7">
        <Link
          href={`/solutions/${agent.slug}`}
          className="btn-ghost"
          aria-label={`Learn more about ${agent.name}`}
        >
          Learn more
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}
