import { prisma } from '@/lib/db';
import { assertOperator, type OperatorAuthorization } from '@/lib/operatorAuth';

/**
 * The internal Sales Brief, for the operator only.
 *
 * The one reader of the SalesIntelligence table (the orchestrator and the demo
 * seeder write it; the Command Center reads only the priority badge). It takes
 * an OperatorAuthorization, so no page or route can show a brief without
 * having passed the operator check — enforced by the type here, at runtime by
 * `assertOperator`, and by tests/operator-surface-structure.test.ts, which
 * fails if any other module touches the table.
 */
export async function loadSalesBrief(operator: OperatorAuthorization, auditId: string) {
  assertOperator(operator);
  return prisma.salesIntelligence.findUnique({
    where: { auditId },
    include: { audit: { include: { restaurant: true } } },
  });
}
