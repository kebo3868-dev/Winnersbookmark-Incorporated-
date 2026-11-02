import { prisma } from '@/lib/db';
import { assertOperator, type OperatorAuthorization } from '@/lib/operatorAuth';
import { presentOrderingText } from '@/lib/audit/orderingChannel';
import { presentSalesField } from './salesWording';

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
  const brief = await prisma.salesIntelligence.findUnique({
    where: { auditId },
    include: { audit: { include: { restaurant: true } } },
  });
  if (!brief) return brief;
  // A brief stored before a wording correction is shown in the current
  // wording; the stored record is not rewritten:
  // - the ordering button "places a phone call" (orderingChannel.ts);
  // - an automation recommended to the rep without its conditions — demand in
  //   the restaurant's own records, readiness and safety validation, owner
  //   approval, a limited, monitored pilot — is made conditional or withheld
  //   (salesWording.ts).
  const present = (key: string, text: string) => presentSalesField(key, presentOrderingText(text));
  const shown = Object.fromEntries(
    Object.entries(brief).map(([key, value]) => [
      key,
      typeof value === 'string' ? present(key, value) : Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? present(key, v) : v)) : value,
    ]),
  );
  return shown as typeof brief;
}
