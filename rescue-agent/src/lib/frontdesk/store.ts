import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseTenantConfig, type TenantConfig } from './config/schema';
import type { ConversationTurn } from './engine';
import {
  DEMO_TENANT_B_SLUG,
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG,
  demoTenantBConfig,
  demoTenantConfig,
} from './demo/tenant';
import type { Channel, Intent, LeadCategory, LeadPriority, TurnResult } from './types';

/**
 * TENANT-SCOPED DATA ACCESS (§XIX)
 *
 * The isolation rule this file enforces: a caller cannot read or write front
 * desk data without naming a tenant. Every exported function takes `tenantId`
 * as its first argument and puts it in the WHERE clause — including on lookups
 * by primary key, where it is redundant for correctness but not for safety. A
 * lead id guessed or leaked from one restaurant will not resolve against
 * another restaurant's id.
 *
 * That is why authorisation lives here rather than in the UI: hiding a nav
 * link is not access control (§XIX).
 */

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  demoMode: boolean;
  config: TenantConfig;
}

export interface TenantLoadFailure {
  id: string;
  slug: string;
  name: string;
  error: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Load one tenant by its public slug. Returns null when it does not exist. */
export async function getTenantBySlug(slug: string, db: Db = prisma): Promise<TenantRecord | null> {
  const row = await db.fdTenant.findUnique({ where: { slug } });
  if (!row) return null;
  const parsed = parseTenantConfig(row.config);
  if (!parsed.ok) {
    // The tenant exists but its stored config no longer validates — an invalid
    // timezone, say. Callers surface this as a 404, which to an operator looks
    // identical to a typo in the slug, so the real reason is logged. The
    // tenant list page shows these load failures explicitly.
    console.error('[frontdesk] tenant config rejected', { slug, error: parsed.error });
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    demoMode: row.demoMode,
    config: parsed.config,
  };
}

/**
 * Load every tenant. A tenant whose stored config no longer parses is returned
 * separately rather than thrown away silently — an operator needs to see that
 * a restaurant is misconfigured, and one bad row must not blank the dashboard.
 */
export async function listTenants(
  db: Db = prisma,
): Promise<{ tenants: TenantRecord[]; failures: TenantLoadFailure[] }> {
  const rows = await db.fdTenant.findMany({ orderBy: [{ demoMode: 'asc' }, { name: 'asc' }] });
  const tenants: TenantRecord[] = [];
  const failures: TenantLoadFailure[] = [];
  for (const row of rows) {
    const parsed = parseTenantConfig(row.config);
    if (parsed.ok) {
      tenants.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        demoMode: row.demoMode,
        config: parsed.config,
      });
    } else {
      failures.push({ id: row.id, slug: row.slug, name: row.name, error: parsed.error });
    }
  }
  return { tenants, failures };
}

/**
 * Find or create the conversation for an inbound message.
 *
 * `externalRef` is the provider's own identifier (a call SID, an SMS thread).
 * Reusing it makes redelivered webhooks land on the existing conversation
 * instead of creating a duplicate — telephony providers retry aggressively.
 */
export async function openConversation(
  tenantId: string,
  options: { channel: Channel; externalRef?: string | null; demoMode: boolean; customerPhone?: string | null },
  db: Db = prisma,
): Promise<{ id: string }> {
  const { channel, externalRef = null, demoMode, customerPhone = null } = options;

  if (externalRef) {
    const existing = await db.fdConversation.findUnique({
      where: { tenantId_channel_externalRef: { tenantId, channel, externalRef } },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return db.fdConversation.create({
    data: { tenantId, channel, externalRef, demoMode, customerPhone },
    select: { id: true },
  });
}

/** Prior turns for a conversation, oldest first, scoped to the tenant. */
export async function getConversationHistory(
  tenantId: string,
  conversationId: string,
  db: Db = prisma,
): Promise<ConversationTurn[]> {
  const rows = await db.fdMessage.findMany({
    where: { tenantId, conversationId },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { role: true, body: true, intent: true },
  });
  return rows
    .filter((r): r is typeof r & { role: 'CUSTOMER' | 'ASSISTANT' } => r.role !== 'SYSTEM')
    .map((r) => ({ role: r.role, body: r.body, intent: (r.intent as Intent | null) ?? null }));
}

export interface RecordedTurn {
  leadIds: string[];
  escalationIds: string[];
  /** The stored assistant message, so the transcript can be corrected if the reply is. */
  assistantMessageId: string;
}

/**
 * Persist one exchange: the customer message, the reply, and any lead or
 * escalation the engine produced.
 *
 * Written as a single transaction so a conversation can never end up recorded
 * without the escalation it triggered. A half-written escalation is a customer
 * whose complaint nobody sees (§XVI: never silently fail).
 */
export async function recordTurn(
  tenantId: string,
  conversationId: string,
  customerMessage: string,
  turn: TurnResult,
  options: { demoMode: boolean; source: string },
  db: PrismaClient = prisma,
): Promise<RecordedTurn> {
  return db.$transaction(async (tx) => {
    await tx.fdMessage.create({
      data: { tenantId, conversationId, role: 'CUSTOMER', body: customerMessage, intent: turn.intent },
    });
    const assistantMessage = await tx.fdMessage.create({
      data: {
        tenantId,
        conversationId,
        role: 'ASSISTANT',
        body: turn.reply,
        intent: turn.intent,
        answerSource: turn.answerSource,
      },
      select: { id: true },
    });

    const leadIds: string[] = [];
    const escalationIds: string[] = [];

    for (const action of turn.actions) {
      if (action.type === 'CAPTURE_LEAD') {
        const lead = await tx.fdLead.create({
          data: {
            tenantId,
            conversationId,
            source: options.source,
            customerName: action.lead.customerName,
            phone: action.lead.phone,
            email: action.lead.email,
            category: action.lead.category as LeadCategory,
            intent: action.lead.intent,
            priority: action.lead.priority as LeadPriority,
            partySize: action.lead.partySize,
            requestedDate: action.lead.requestedDate,
            requestedTime: action.lead.requestedTime,
            notes: action.lead.notes,
            estimatedValueCents: action.lead.estimatedValueCents,
            demoMode: options.demoMode,
          },
          select: { id: true },
        });
        leadIds.push(lead.id);
      }

      if (action.type === 'ESCALATE') {
        const escalation = await tx.fdEscalation.create({
          data: {
            tenantId,
            conversationId,
            reason: action.escalation.reason,
            severity: action.escalation.severity,
            summary: action.escalation.summary,
            customerName: action.escalation.customerName,
            contact: action.escalation.contact,
            routeTo: action.escalation.routeTo,
            demoMode: options.demoMode,
          },
          select: { id: true },
        });
        escalationIds.push(escalation.id);
      }
    }

    // updateMany rather than update: it lets the tenant into the WHERE clause.
    // `update({ where: { id } })` would be correct here (the id was already
    // resolved under this tenant) but it would also be the one write in this
    // file that could touch another tenant's row if that ever stopped holding.
    await tx.fdConversation.updateMany({
      where: { id: conversationId, tenantId },
      data: {
        lastMessageAt: new Date(),
        escalated: turn.needsHuman ? true : undefined,
        customerName: turn.slots.customerName ?? undefined,
        customerPhone: turn.slots.phone ?? undefined,
      },
    });

    return { leadIds, escalationIds, assistantMessageId: assistantMessage.id };
  });
}

// --- Dashboard queries -----------------------------------------------------

export interface TodaySummary {
  conversations: number;
  escalatedConversations: number;
  messagesHandled: number;
  aiResolved: number;
  deferred: number;
  newLeads: number;
  reservations: number;
  cateringLeads: number;
  privateEventLeads: number;
  highPriority: number;
  openEscalations: number;
  /** ESTIMATED only. Never labelled as revenue in any surface. */
  estimatedOpportunityCents: number;
  bookedLeads: number;
  wonLeads: number;
  lostLeads: number;
}

/** Aggregate the TODAY screen (§XIV) for one tenant over one window. */
/**
 * Correct a stored reply so the transcript matches what the customer was sent.
 *
 * Used only when a reply is retracted after dispatch (see retractAlertClaim).
 * The transcript is the auditable record of the conversation (§XXX), so it
 * must never show a sentence the customer never received — an owner reviewing
 * a food-safety incident has to be reading the real exchange.
 *
 * `updateMany` rather than `update` so the tenant id sits in the WHERE clause:
 * a message id alone must never be enough to write across a tenant boundary.
 */
export async function amendAssistantReply(
  tenantId: string,
  messageId: string,
  body: string,
  db: Db = prisma,
): Promise<void> {
  await db.fdMessage.updateMany({
    where: { id: messageId, tenantId, role: 'ASSISTANT' },
    data: { body },
  });
}

export async function getTodaySummary(
  tenantId: string,
  since: Date,
  db: Db = prisma,
): Promise<TodaySummary> {
  const [conversations, escalatedConversations, messages, leads, openEscalations] = await Promise.all([
    db.fdConversation.count({ where: { tenantId, startedAt: { gte: since } } }),
    db.fdConversation.count({ where: { tenantId, startedAt: { gte: since }, escalated: true } }),
    db.fdMessage.findMany({
      where: { tenantId, role: 'ASSISTANT', createdAt: { gte: since } },
      select: { answerSource: true },
    }),
    db.fdLead.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { category: true, priority: true, estimatedValueCents: true, status: true },
    }),
    db.fdEscalation.count({ where: { tenantId, status: 'OPEN' } }),
  ]);

  const VERIFIED = ['VERIFIED_CONFIG', 'VERIFIED_FAQ', 'VERIFIED_PATHWAY'];

  return {
    conversations,
    escalatedConversations,
    messagesHandled: messages.length,
    aiResolved: messages.filter((m) => m.answerSource && VERIFIED.includes(m.answerSource)).length,
    deferred: messages.filter((m) => m.answerSource === 'UNVERIFIED_DEFERRED').length,
    newLeads: leads.length,
    reservations: leads.filter((l) => l.category === 'RESERVATION' || l.category === 'LARGE_PARTY').length,
    cateringLeads: leads.filter((l) => l.category === 'CATERING').length,
    privateEventLeads: leads.filter((l) => l.category === 'PRIVATE_EVENT').length,
    highPriority: leads.filter((l) => l.priority === 'HIGH' || l.priority === 'URGENT').length,
    openEscalations,
    estimatedOpportunityCents: leads.reduce((sum, l) => sum + (l.estimatedValueCents ?? 0), 0),
    bookedLeads: leads.filter((l) => l.status === 'BOOKED').length,
    wonLeads: leads.filter((l) => l.status === 'WON').length,
    lostLeads: leads.filter((l) => l.status === 'LOST').length,
  };
}

export async function listLeadsForTenant(
  tenantId: string,
  options: { since?: Date; status?: string; category?: string; take?: number } = {},
  db: Db = prisma,
) {
  return db.fdLead.findMany({
    where: {
      tenantId,
      ...(options.since ? { createdAt: { gte: options.since } } : {}),
      ...(options.status ? { status: options.status as never } : {}),
      ...(options.category ? { category: options.category as never } : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: options.take ?? 100,
  });
}

export async function listEscalationsForTenant(tenantId: string, take = 50, db: Db = prisma) {
  return db.fdEscalation.findMany({
    where: { tenantId, status: { not: 'RESOLVED' } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/**
 * Update a lead's status. Scoped by tenant deliberately: `updateMany` with a
 * tenant filter cannot touch another restaurant's row even if the id is
 * correct, which `update({ where: { id } })` could.
 */
export async function updateLeadStatus(
  tenantId: string,
  leadId: string,
  data: { status?: string; assignedTo?: string | null; resolution?: string | null },
  db: Db = prisma,
): Promise<boolean> {
  const result = await db.fdLead.updateMany({
    where: { id: leadId, tenantId },
    data: {
      ...(data.status ? { status: data.status as never, lastContactAt: new Date() } : {}),
      ...(data.assignedTo !== undefined ? { assignedTo: data.assignedTo } : {}),
      ...(data.resolution !== undefined ? { resolution: data.resolution } : {}),
    },
  });
  return result.count > 0;
}

// --- Demo mode -------------------------------------------------------------

/** Create (or refresh) the demo tenants. Idempotent. */
export async function seedDemoTenants(db: Db = prisma): Promise<{ slugs: string[] }> {
  const seeds = [
    { slug: DEMO_TENANT_SLUG, name: DEMO_TENANT_NAME, config: demoTenantConfig },
    { slug: DEMO_TENANT_B_SLUG, name: 'The Corner Café (DEMO)', config: demoTenantBConfig },
  ];

  for (const seed of seeds) {
    await db.fdTenant.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        name: seed.name,
        status: 'ACTIVE',
        demoMode: true,
        config: seed.config as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: seed.name,
        status: 'ACTIVE',
        demoMode: true,
        config: seed.config as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return { slugs: seeds.map((s) => s.slug) };
}

export interface FrontDeskPurgeResult {
  tenantsDeleted: number;
  conversationsDeleted: number;
  leadsDeleted: number;
  escalationsDeleted: number;
}

/**
 * REMOVE DEMO DATA (§XXI).
 *
 * Every delete is scoped by `demoMode: true`. Conversations, messages, leads
 * and escalations cascade from the tenant, but demo rows are also removed
 * explicitly first so that a demo conversation recorded against a *real*
 * tenant (possible if someone runs the simulator against a live restaurant)
 * is cleaned up too, without touching that tenant's genuine data.
 */
export async function purgeFrontDeskDemoData(db: PrismaClient = prisma): Promise<FrontDeskPurgeResult> {
  return db.$transaction(async (tx) => {
    const escalations = await tx.fdEscalation.deleteMany({ where: { demoMode: true } });
    const leads = await tx.fdLead.deleteMany({ where: { demoMode: true } });
    const conversations = await tx.fdConversation.deleteMany({ where: { demoMode: true } });
    const tenants = await tx.fdTenant.deleteMany({ where: { demoMode: true } });
    return {
      tenantsDeleted: tenants.count,
      conversationsDeleted: conversations.count,
      leadsDeleted: leads.count,
      escalationsDeleted: escalations.count,
    };
  });
}

/**
 * RETENTION (§XX). Deletes conversations older than the retention window;
 * leads and escalations cascade to null rather than being destroyed, because
 * an owner's pipeline history outlives the transcript that produced it.
 */
export async function applyRetention(
  tenantId: string,
  retentionDays: number,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ conversationsDeleted: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const result = await db.fdConversation.deleteMany({
    where: { tenantId, lastMessageAt: { lt: cutoff } },
  });
  return { conversationsDeleted: result.count };
}
