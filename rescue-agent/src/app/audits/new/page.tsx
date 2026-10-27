import { requireOperatorPage } from '@/lib/operatorAuth';
import NewAuditForm from './NewAuditForm';

/**
 * A server page around the client form, so the operator check runs on the
 * server before anything is sent. The form itself is unchanged; the API it
 * posts to checks the credential again on every request.
 */
export default async function NewAuditPage() {
  await requireOperatorPage();
  return <NewAuditForm />;
}
