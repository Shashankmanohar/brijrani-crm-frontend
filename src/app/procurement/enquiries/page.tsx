import { redirect } from 'next/navigation';

export default function ProcurementEnquiriesRedirect() {
  redirect('/procurement/orders');
}
