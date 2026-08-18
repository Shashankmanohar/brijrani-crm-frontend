import { redirect } from 'next/navigation';

export default function ProcurementInvoicesRedirect() {
  redirect('/finance/ledger');
}
