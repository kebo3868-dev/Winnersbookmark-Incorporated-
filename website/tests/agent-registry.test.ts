import { describe, it, expect } from 'vitest';
import {
  agents,
  agentsByOrder,
  featuredAgents,
  availableAgents,
  getAgent,
  agentSlugs,
  STATUS_PRESENTATION,
  FEATURE_STATE_LABEL,
} from '@/data/agents';

/**
 * The registry drives every agent page, card, sitemap entry and piece of
 * structured data on the site. A malformed entry does not fail loudly — it
 * ships a broken page — so the invariants are asserted here instead.
 */
describe('agent registry integrity', () => {
  it('has unique slugs', () => {
    const slugs = agentSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has unique order values so listing order is deterministic', () => {
    const orders = agents.map((a) => a.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('uses URL-safe slugs', () => {
    for (const slug of agentSlugs()) {
      expect(slug, slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('gives every agent the fields the page template renders', () => {
    for (const agent of agents) {
      expect(agent.name.length, agent.slug).toBeGreaterThan(0);
      expect(agent.tagline.length, agent.slug).toBeGreaterThan(0);
      expect(agent.description.length, agent.slug).toBeGreaterThan(0);
      expect(agent.statusLabel.length, agent.slug).toBeGreaterThan(0);
      expect(agent.statusNote.length, agent.slug).toBeGreaterThan(0);
      expect(agent.problem.headline.length, agent.slug).toBeGreaterThan(0);
      expect(agent.problem.symptoms.length, agent.slug).toBeGreaterThan(0);
      expect(agent.features.length, agent.slug).toBeGreaterThan(0);
      expect(agent.workflow.length, agent.slug).toBeGreaterThan(0);
      expect(agent.faqs.length, agent.slug).toBeGreaterThan(0);
      expect(agent.cta.primaryLabel.length, agent.slug).toBeGreaterThan(0);
      expect(agent.cta.primaryHref.startsWith('/'), agent.slug).toBe(true);
    }
  });

  it('has a presentation entry for every status it uses', () => {
    for (const agent of agents) {
      expect(STATUS_PRESENTATION[agent.status], agent.slug).toBeDefined();
    }
  });

  it('has a label for every feature state it uses', () => {
    for (const agent of agents) {
      for (const feature of agent.features) {
        expect(FEATURE_STATE_LABEL[feature.state], `${agent.slug}/${feature.title}`).toBeDefined();
      }
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(getAgent('restaurant-rescue-agent')?.name).toBe('Restaurant Rescue Agent');
    expect(getAgent('not-a-real-agent')).toBeUndefined();
  });

  it('orders by the order field', () => {
    const orders = agentsByOrder.map((a) => a.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

/**
 * THE HONESTY CONTRACT, ENFORCED.
 *
 * These are the assertions that stop the site drifting into the overclaiming
 * it was explicitly built to avoid. They are deliberately strict: a future
 * edit that adds a fabricated statistic or promotes an unbuilt agent to
 * "available" fails the build rather than shipping.
 */
describe('honesty contract', () => {
  it('never features an agent that is not actually available', () => {
    for (const agent of featuredAgents) {
      expect(['LIVE', 'PILOT'], agent.slug).toContain(agent.status);
    }
  });

  it('counts as available only what is LIVE or in PILOT', () => {
    for (const agent of availableAgents) {
      expect(['LIVE', 'PILOT'], agent.slug).toContain(agent.status);
    }
    expect(availableAgents.every((a) => a.status !== 'COMING_SOON')).toBe(true);
  });

  it('gives a COMING_SOON agent no shipped features', () => {
    for (const agent of agents.filter((a) => a.status === 'COMING_SOON')) {
      for (const feature of agent.features) {
        expect(feature.state, `${agent.slug}/${feature.title} claims to be shipped`).not.toBe('LIVE');
      }
    }
  });

  it('claims no outcomes for an agent that does not exist yet', () => {
    for (const agent of agents.filter((a) => a.status === 'COMING_SOON')) {
      expect(agent.outcomes, agent.slug).toHaveLength(0);
    }
  });

  it('publishes no case studies until real, attributable ones exist', () => {
    // When this fails, someone has added a case study. Confirm the customer
    // consented and the figures are theirs, then update this test.
    for (const agent of agents) {
      expect(agent.caseStudies, agent.slug).toHaveLength(0);
    }
  });

  it('states no percentage or currency claims anywhere in the registry', () => {
    // The single most damaging thing this site could do is publish an
    // invented recovery figure. No numbers of that shape, anywhere.
    const serialised = JSON.stringify(agents);
    const percentages = serialised.match(/\d+(\.\d+)?\s?%/g) ?? [];
    const currency = serialised.match(/[$£€]\s?\d/g) ?? [];
    expect(percentages, `found percentage claims: ${percentages.join(', ')}`).toHaveLength(0);
    expect(currency, `found currency claims: ${currency.join(', ')}`).toHaveLength(0);
  });

  it('marks every agent with an unambiguous status note', () => {
    for (const agent of agents) {
      // A visitor must never have to infer availability from tone.
      expect(agent.statusNote.length, agent.slug).toBeGreaterThan(40);
    }
  });
});

describe('status presentation consistency', () => {
  it('gives every status a badge colour AND a matching rule colour', () => {
    // The callout rule and the badge must always answer the same question.
    // A green rule beside an amber "Private pilot" badge was a real defect.
    for (const [status, p] of Object.entries(STATUS_PRESENTATION)) {
      expect(p.rule, status).toBeTruthy();
      const badgeTone = p.text.replace('text-signal-', '');
      const ruleTone = p.rule.replace('border-signal-', '').split('/')[0];
      expect(ruleTone, `${status}: rule tone must match badge tone`).toBe(badgeTone);
    }
  });
});
