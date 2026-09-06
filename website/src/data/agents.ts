/**
 * THE WBI AI AGENT REGISTRY
 *
 * Every agent the company offers — today and in future — is one entry in the
 * `agents` array below. Pages, cards, navigation, the sitemap and structured
 * data are all generated from this list, so adding the fifth or tenth agent is
 * a data edit, not a redesign. That was the explicit architectural requirement
 * and it is the reason this file exists rather than four hand-built pages.
 *
 * HONESTY CONTRACT
 * ----------------
 * This registry mirrors the discipline the Restaurant Rescue Agent enforces on
 * itself: no claim without something behind it.
 *
 *  - `status` describes what a customer can actually buy TODAY, not what is
 *    planned. An agent with no shipped code is `COMING_SOON`, however far
 *    along the thinking is.
 *  - Feature-level `state` exists because a shipped agent still contains
 *    unfinished parts, and a prospect discovering that after signing is worse
 *    than reading it here first.
 *  - There are no metrics in this file. No "recovers 30% of missed calls", no
 *    percentages, no dollar figures. The company has no published customer
 *    outcome data, so it publishes none. Outcomes are stated as capabilities
 *    ("answers every inbound text"), which is verifiable, rather than results
 *    ("wins back $4,000/month"), which is not.
 *  - `caseStudies` is empty on every agent. When real, consented customer
 *    results exist, they go here and the proof sections render automatically.
 */

export type AgentStatus = 'LIVE' | 'PILOT' | 'IN_DEVELOPMENT' | 'COMING_SOON';

export type FeatureState = 'LIVE' | 'IN_DEVELOPMENT' | 'PLANNED';

export interface AgentFeature {
  title: string;
  description: string;
  /** What a customer can rely on today. Rendered as a visible badge wherever
   *  the feature appears — a planned capability is never shown as shipped. */
  state: FeatureState;
}

export interface WorkflowStep {
  title: string;
  description: string;
}

export interface AgentFaq {
  question: string;
  answer: string;
}

export interface CaseStudy {
  client: string;
  summary: string;
  href?: string;
}

/**
 * A small, honest data display for the agent card.
 *
 * `rows` are SYSTEM CAPABILITIES rendered as a monitor-style readout — what the
 * system does, not what it has achieved. There are no counts, currencies or
 * percentages here and the honesty tests forbid adding them: a card that shows
 * "1,284 calls recovered" would be inventing proof.
 *
 * `weights` drive a relative bar with no axis and no units. It communicates the
 * SHAPE of a distribution, not a measured quantity.
 */
export interface AgentSignal {
  /** Monitor heading, e.g. "Detects". */
  caption: string;
  rows: string[];
  /** 2-4 relative weights, rendered as an unlabelled proportion bar. */
  weights: number[];
}

export interface Agent {
  slug: string;
  name: string;
  /** One line. Appears on cards and as the page's subtitle. */
  tagline: string;
  status: AgentStatus;
  /** Short label for the status chip, e.g. "Live now", "Private pilot". */
  statusLabel: string;
  /** Plain-English note explaining exactly what the status means. Shown on the
   *  agent's page so the status is never ambiguous. */
  statusNote: string;

  /** The business problem, written for an owner, not an engineer. */
  problem: {
    headline: string;
    body: string;
    /** Concrete symptoms an owner recognises in their own business. */
    symptoms: string[];
  };

  /** What the agent is and does. Two or three sentences maximum. */
  description: string;

  features: AgentFeature[];
  workflow: WorkflowStep[];
  /** Capability statements — what the system does. Never performance claims. */
  outcomes: string[];
  faqs: AgentFaq[];
  caseStudies: CaseStudy[];

  /** Card readout. Optional: an agent with nothing truthful to show omits it
   *  rather than displaying a placeholder. */
  signal?: AgentSignal;

  cta: {
    primaryLabel: string;
    /** Where the primary action goes. Contact routes carry the agent slug so
     *  an enquiry arrives already attributed to the offer that generated it. */
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };

  /** Drives ordering and which agents surface on the homepage. */
  featured: boolean;
  order: number;
}

/**
 * One definition per status, used by every status-coloured surface.
 *
 * `rule` is the heavier left-border used on the status callout. It exists here
 * rather than being chosen at the call site because the callout previously
 * picked its colour from a binary "is this available" test, which rendered a
 * GREEN rule beside an AMBER "Private pilot" badge — two different answers to
 * the same question, six inches apart. Deriving both from this map makes that
 * class of mismatch impossible.
 */
export const STATUS_PRESENTATION: Record<
  AgentStatus,
  { label: string; dot: string; text: string; border: string; rule: string }
> = {
  LIVE: {
    label: 'Live',
    dot: 'bg-status-live',
    text: 'text-status-live',
    border: 'border-status-live/40',
    rule: 'border-status-live/70',
  },
  PILOT: {
    label: 'Private pilot',
    dot: 'bg-status-building',
    text: 'text-status-building',
    border: 'border-status-building/40',
    rule: 'border-status-building/70',
  },
  IN_DEVELOPMENT: {
    label: 'In development',
    dot: 'bg-status-building',
    text: 'text-status-building',
    border: 'border-status-building/40',
    rule: 'border-status-building/70',
  },
  COMING_SOON: {
    label: 'Coming soon',
    dot: 'bg-status-planned',
    text: 'text-status-planned',
    border: 'border-status-planned/40',
    rule: 'border-status-planned/70',
  },
};

export const FEATURE_STATE_LABEL: Record<FeatureState, string> = {
  LIVE: 'Live',
  IN_DEVELOPMENT: 'In development',
  PLANNED: 'Planned',
};

export const agents: Agent[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'restaurant-rescue-agent',
    name: 'Restaurant Rescue Agent',
    tagline: 'Find the revenue your restaurant is losing before a customer ever calls.',
    status: 'LIVE',
    statusLabel: 'Live — running real audits today',
    statusNote:
      'This system is built, tested and in service. It analyses a real restaurant website and produces a real audit.',
    description:
      'A revenue intelligence system that examines a restaurant the way a first-time customer does — the website, the menu, the ordering path, the booking path, the phone — and reports exactly where that journey breaks. Every finding is tied to a specific page it was found on, so the report is evidence, not opinion.',
    problem: {
      headline: 'Most restaurants lose money in places nobody is watching.',
      body:
        'The revenue leaks that hurt most are invisible from inside the business. A menu that only opens as a PDF. An ordering button that goes to a dead page. A phone number that is not tappable on a phone. No single one looks like an emergency, and together they quietly turn interested customers into people who ate somewhere else.',
      symptoms: [
        'Online orders are lower than foot traffic suggests they should be',
        'Customers phone to ask questions the website already answers',
        'The menu is a PDF that is hard to read on a phone',
        'Nobody knows which link on the site is broken today',
        'Reservations or orders route through a platform nobody has checked in a year',
      ],
    },
    features: [
      {
        title: 'Evidence-backed findings',
        description:
          'Every claim in the report is stored with the page it came from, the supporting context, and a confidence score. Nothing is asserted without a source.',
        state: 'LIVE',
      },
      {
        title: 'Customer journey analysis',
        description:
          'Traces the path from landing on the site to placing an order or booking a table, and identifies where that path breaks down.',
        state: 'LIVE',
      },
      {
        title: 'Revenue leak detection and ranking',
        description:
          'Identifies the leaks, then ranks them so the owner knows what to fix first rather than receiving a list of forty equal problems.',
        state: 'LIVE',
      },
      {
        title: 'Ordering and reservation path testing',
        description:
          'Follows the ordering and booking links and reports when a destination fails, redirects unexpectedly, or does not exist.',
        state: 'LIVE',
      },
      {
        title: 'Rescue Score',
        description:
          'A single score summarising the health of the restaurant’s digital customer journey, with the components that produced it shown openly.',
        state: 'LIVE',
      },
      {
        title: 'Executive PDF report',
        description:
          'The findings as a professional document an owner can read, share with staff, or hand to whoever maintains their website.',
        state: 'LIVE',
      },
      {
        title: 'Honest failure reporting',
        description:
          'When a site cannot be fully analysed, the audit says so and explains why. It never fills the gap with an assumption.',
        state: 'LIVE',
      },
      {
        title: 'Review platform intelligence',
        description:
          'Pulling reputation signals from review platforms into the audit alongside the website findings.',
        state: 'IN_DEVELOPMENT',
      },
    ],
    workflow: [
      {
        title: 'You give us the website address',
        description:
          'That is the only thing required. Restaurant name, city and a specific concern are optional and help focus the analysis.',
      },
      {
        title: 'The agent collects public evidence',
        description:
          'It reads the publicly available pages — homepage, menu, ordering, reservations, contact — and records what it finds with the source of each fact.',
      },
      {
        title: 'It traces the customer journey',
        description:
          'It follows the same route a hungry customer would, and notes every point where that route becomes harder than it should be.',
      },
      {
        title: 'It ranks the revenue leaks',
        description:
          'Findings are scored and ordered by how much they stand between a customer and a completed order or booking.',
      },
      {
        title: 'You receive the audit',
        description:
          'A clear report showing what was found, where it was found, what it costs the business in missed opportunity, and what to fix first.',
      },
    ],
    outcomes: [
      'See exactly where interested customers drop out of the ordering journey',
      'Know which fix to make first, and why that one',
      'Get findings tied to real pages, so the work can be handed to anyone',
      'Identify broken ordering and reservation paths before customers hit them',
      'Understand the digital customer experience without needing technical knowledge',
    ],
    faqs: [
      {
        question: 'What do you need from me to run an audit?',
        answer:
          'Your website address. Nothing else is required. You can optionally add your restaurant name and a specific concern if you want the analysis focused on something in particular.',
      },
      {
        question: 'Do you need access to my website or any passwords?',
        answer:
          'No. The audit only reads what is already public — the same pages any customer can see. We never ask for logins, admin access, or credentials of any kind.',
      },
      {
        question: 'Will the report include revenue figures?',
        answer:
          'No, and that is deliberate. Any dollar figure would be a guess dressed up as data. The audit describes exposure — where customers are being lost — and shows the evidence, so you can judge the value against numbers you actually have.',
      },
      {
        question: 'What happens if my site cannot be fully analysed?',
        answer:
          'The audit tells you so, explains what blocked it, and reports on what it did reach. It never fills a gap with an assumption to make the report look more complete.',
      },
      {
        question: 'How long does an audit take?',
        answer:
          'Typically a few minutes. Larger sites take longer. You can watch the analysis progress through each stage as it runs.',
      },
    ],
    caseStudies: [],
    signal: {
      caption: 'Detects',
      rows: ['Broken ordering paths', 'Menu access friction', 'Reservation drop-off', 'Untappable phone numbers'],
      weights: [38, 27, 21, 14],
    },
    cta: {
      primaryLabel: 'Request a Restaurant Audit',
      primaryHref: '/contact?interest=restaurant-rescue-agent',
      secondaryLabel: 'See how it works',
      secondaryHref: '/solutions/restaurant-rescue-agent#how-it-works',
    },
    featured: true,
    order: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'ai-front-desk',
    name: 'AI Front Desk',
    tagline: 'Every missed call answered. Every question handled. Nothing falls through.',
    status: 'PILOT',
    statusLabel: 'Private pilot — onboarding a limited number of businesses',
    statusNote:
      'The system is built and running with pilot businesses. We are deliberately onboarding a small number at a time so each one is set up properly. Some capabilities listed below are still in development and are marked as such.',
    description:
      'An AI front desk that picks up what your staff cannot. When a call is missed, it texts the customer back within seconds. It answers the questions it can answer, captures the details of the ones it cannot, and escalates to a real person when something needs one.',
    problem: {
      headline: 'The call you did not answer was a customer you did not keep.',
      body:
        'During a rush, the phone rings and nobody can reach it. That caller does not leave a voicemail and does not try again — they call the next place on the list. The same happens after closing, on a day off, and during every stretch when the people who could answer are busy doing the thing customers came for.',
      symptoms: [
        'The phone rings during service and nobody can get to it',
        'Callers after hours reach nothing and never come back',
        'Staff answer the same five questions all day',
        'Enquiries arrive by text, voicemail and email with no single place to see them',
        'Nobody knows how many customers were lost to an unanswered phone',
      ],
    },
    features: [
      {
        title: 'Missed-call text-back',
        description:
          'When a call goes unanswered, the customer receives a text within seconds — while they are still deciding where to go.',
        state: 'LIVE',
      },
      {
        title: 'Answers real customer questions',
        description:
          'Hours, location, parking, menu access and the other questions that consume staff time, answered from information you control.',
        state: 'LIVE',
      },
      {
        title: 'Lead capture',
        description:
          'When the agent cannot resolve something, it captures the customer’s details and what they wanted, so the enquiry survives instead of evaporating.',
        state: 'LIVE',
      },
      {
        title: 'Escalation to a real person',
        description:
          'Anything sensitive, unusual, or beyond the agent’s remit is handed to a named member of staff, with the message recorded and delivery tracked.',
        state: 'LIVE',
      },
      {
        title: 'Ordering handoff',
        description:
          'Customers who want to order are routed to the ordering channel you actually use, rather than being told something generic.',
        state: 'LIVE',
      },
      {
        title: 'Review requests',
        description:
          'Eligible customers are invited to leave a review at the right moment, with rules about who is asked and how often.',
        state: 'LIVE',
      },
      {
        title: 'Safety guardrails',
        description:
          'The agent refuses to answer outside what it actually knows, and never invents an answer about allergens, pricing or availability.',
        state: 'LIVE',
      },
      {
        title: 'Email as a second alert channel',
        description:
          'Staff alerts by email alongside text, so a notification has a backup route. Built, awaiting a configured email provider.',
        state: 'IN_DEVELOPMENT',
      },
      {
        title: 'Direct reservation booking',
        description:
          'Taking a booking end-to-end inside the conversation. The integration layer exists; live provider connections are in progress.',
        state: 'IN_DEVELOPMENT',
      },
      {
        title: 'Voice answering',
        description:
          'Handling the call itself in a spoken conversation, rather than responding by text after the call is missed.',
        state: 'PLANNED',
      },
    ],
    workflow: [
      {
        title: 'We configure what your business knows',
        description:
          'Hours, location, ordering channel, booking path, and the answers you want given. The agent only speaks from this.',
      },
      {
        title: 'We connect your phone number',
        description:
          'Calls still ring at your business exactly as they do now. Nothing changes for a call your team answers.',
      },
      {
        title: 'A missed call triggers a text',
        description:
          'Within seconds of a call going unanswered, the customer gets a message asking what they need.',
      },
      {
        title: 'The agent handles what it can',
        description:
          'It answers the question, routes an order, or captures the detail of a request it cannot complete.',
      },
      {
        title: 'A person is alerted when needed',
        description:
          'Escalations go to a named member of staff. You see every conversation and every captured lead in one place.',
      },
    ],
    outcomes: [
      'Missed calls get a response instead of a silence',
      'Common questions stop interrupting staff during service',
      'Enquiries are captured in one place rather than scattered across channels',
      'After-hours interest is answered instead of lost',
      'You can see what customers are actually asking for',
    ],
    faqs: [
      {
        question: 'Does this replace my staff?',
        answer:
          'No. It covers the moments your staff cannot — a phone ringing mid-rush, an enquiry at 11pm. Anything that needs a person is escalated to one.',
      },
      {
        question: 'What stops it from making something up?',
        answer:
          'It answers only from the information you configure. When it does not know something, it says so and captures the question rather than guessing. That behaviour is enforced in the system, not left to chance.',
      },
      {
        question: 'Do I need to change my phone number?',
        answer:
          'No. Calls continue to ring at your business as they do today. The agent responds to calls that go unanswered.',
      },
      {
        question: 'Why is this a private pilot rather than generally available?',
        answer:
          'Because setting it up properly matters more than setting it up quickly. The agent is only as good as the information behind it, so we onboard a small number of businesses at a time and configure each one carefully.',
      },
      {
        question: 'Can it take a reservation?',
        answer:
          'Not end-to-end yet — that is in development and honestly labelled as such. Today it captures the booking request and routes the customer to your existing booking path or to a member of staff.',
      },
    ],
    caseStudies: [],
    signal: {
      caption: 'Handles',
      rows: ['Missed-call text-back', 'Hours & location questions', 'Lead capture', 'Escalation to staff'],
      weights: [41, 24, 20, 15],
    },
    cta: {
      primaryLabel: 'Apply for the Pilot',
      primaryHref: '/contact?interest=ai-front-desk',
      secondaryLabel: 'See how it works',
      secondaryHref: '/solutions/ai-front-desk#how-it-works',
    },
    featured: true,
    order: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'ai-sales-agent',
    name: 'AI Sales Agent',
    tagline: 'Follow up with every lead, every time, without adding headcount.',
    status: 'COMING_SOON',
    statusLabel: 'Coming soon — in design',
    statusNote:
      'This agent is being designed and is not yet available. Nothing on this page describes a system you can buy today. If it addresses a problem you have, tell us — early conversations shape what gets built first.',
    description:
      'An outbound agent that works the follow-up nobody has time for: leads that went quiet, customers who have not returned, enquiries that were never called back. Designed to extend the same evidence and safety discipline as the rest of the ecosystem to outbound contact.',
    problem: {
      headline: 'Most leads are not lost. They are never followed up.',
      body:
        'A lead comes in, someone means to call back, and the day happens. Follow-up is the first thing dropped when a business is busy, and it is invisible when it fails — there is no alert for the customer who was interested three weeks ago and never heard from anyone.',
      symptoms: [
        'Leads sit in an inbox with nobody assigned to them',
        'Follow-up depends on whoever remembers',
        'Past customers are never contacted again',
        'No record of who was called, when, or what was said',
      ],
    },
    features: [
      {
        title: 'Automated lead follow-up',
        description: 'Contacts new leads promptly and persistently, without the follow-up depending on someone remembering.',
        state: 'PLANNED',
      },
      {
        title: 'Customer reactivation',
        description: 'Reaches customers who have not returned, with rules about frequency and who is contacted.',
        state: 'PLANNED',
      },
      {
        title: 'Qualification and routing',
        description: 'Establishes what a lead actually wants before it reaches a person, so the human conversation starts further along.',
        state: 'PLANNED',
      },
      {
        title: 'Full conversation record',
        description: 'Every contact logged and auditable, consistent with how the rest of the ecosystem treats evidence.',
        state: 'PLANNED',
      },
    ],
    workflow: [
      { title: 'In design', description: 'The workflow for this agent is being defined with input from the businesses that will use it. It is not documented here yet because it is not settled, and publishing a diagram of something undecided would be misleading.' },
    ],
    outcomes: [],
    faqs: [
      {
        question: 'Can I use this now?',
        answer:
          'No. It is in design and there is no product to sell yet. We would rather say that plainly than take a deposit against something unbuilt.',
      },
      {
        question: 'When will it be available?',
        answer:
          'No date has been committed. Announcing one before the work is scoped would be a guess. Ask to be told when it moves to pilot and you will hear when there is something real.',
      },
      {
        question: 'Can I influence what it does?',
        answer:
          'Yes — that is the most useful thing you can do right now. The agents that ship first are the ones solving problems real businesses describe to us.',
      },
    ],
    caseStudies: [],
    cta: {
      primaryLabel: 'Register Interest',
      primaryHref: '/contact?interest=ai-sales-agent',
    },
    featured: false,
    order: 3,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'gigi',
    name: 'Gigi',
    tagline: 'The next-generation AI system at the centre of the Winners Bookmark ecosystem.',
    status: 'COMING_SOON',
    statusLabel: 'Coming soon — next-generation system in development',
    statusNote:
      'Gigi is the long-term direction of the Winners Bookmark AI ecosystem and is not yet available. This page describes intent, not a shipped product. We are publishing it because the direction matters to how the other agents are built — not to sell something that does not exist.',
    description:
      'Where the other agents each solve one problem, Gigi is being designed to work across them — holding the context of an entire business rather than a single conversation, and coordinating the specialised agents underneath it.',
    problem: {
      headline: 'Individual AI tools do not add up to an intelligent business.',
      body:
        'A business ends up with one tool answering the phone, another watching the website, another chasing leads — and none of them aware of each other. The result is a collection of automations, not a system. Gigi is the answer to that: one layer that understands the business as a whole and directs the specialists underneath.',
      symptoms: [
        'Separate tools that each hold one fragment of the picture',
        'No single place that understands the whole business',
        'Insight trapped in whichever system happened to record it',
        'Every new tool adds another thing to check',
      ],
    },
    features: [
      {
        title: 'Cross-agent coordination',
        description: 'Directing the specialised WBI agents rather than duplicating them.',
        state: 'PLANNED',
      },
      {
        title: 'Whole-business context',
        description: 'Holding an understanding of the business that persists across conversations and systems.',
        state: 'PLANNED',
      },
      {
        title: 'Operational intelligence',
        description: 'Surfacing what is actually happening in the business, drawn from what the agents observe.',
        state: 'PLANNED',
      },
    ],
    workflow: [
      { title: 'In development', description: 'Gigi’s architecture is being developed alongside the agents she will coordinate. There is no workflow to publish yet, and inventing one would misrepresent how far along this is.' },
    ],
    outcomes: [],
    faqs: [
      {
        question: 'Is Gigi available?',
        answer: 'No. Gigi is in development. Nothing on this page is available to buy.',
      },
      {
        question: 'Why publish a page for something that does not exist yet?',
        answer:
          'Because it explains where the other agents are heading. Every agent we ship is built to be coordinated later rather than to stand alone, and that shapes decisions a customer can see today.',
      },
      {
        question: 'Will the other agents still work on their own?',
        answer:
          'Yes. Each agent is designed to be useful by itself. Gigi is an addition, not a dependency.',
      },
    ],
    caseStudies: [],
    cta: {
      primaryLabel: 'Follow Gigi’s Development',
      primaryHref: '/contact?interest=gigi',
    },
    featured: false,
    order: 4,
  },
];

/* ── Derived accessors. Pages use these rather than filtering inline, so the
      ordering and featuring rules live in exactly one place. ─────────────── */

export const agentsByOrder = [...agents].sort((a, b) => a.order - b.order);

export const featuredAgents = agentsByOrder.filter((a) => a.featured);

export function getAgent(slug: string): Agent | undefined {
  return agents.find((a) => a.slug === slug);
}

export function agentSlugs(): string[] {
  return agents.map((a) => a.slug);
}

/** Agents a customer can actually engage with today. Used to keep the homepage
 *  and the consulting page honest about what is purchasable now. */
export const availableAgents = agentsByOrder.filter(
  (a) => a.status === 'LIVE' || a.status === 'PILOT',
);
