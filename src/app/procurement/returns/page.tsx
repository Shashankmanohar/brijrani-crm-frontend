import { redirect } from 'next/navigation';

export default function ProcurementReturnsRedirect() {
  redirect('/procurement/orders');
}
