import { redirect } from 'next/navigation';

export default function SalesReturnsRedirect() {
  redirect('/sales/orders');
}
