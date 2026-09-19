import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/PageHero';
import { OrderConfirmation } from './OrderConfirmation';

/* KHARIS & ALETHEIA — /order?ref=KA-XXXXXX. Ported from ../order.html. Server shell
   (hero) around the client OrderConfirmation, which reads `ref` via useSearchParams
   and so must be wrapped in <Suspense> per CONTRACT-NEXT.md's HYDRATION rule. Owns:
   app/checkout/** app/order/** — see CONTRACT-NEXT.md "commerce" row. */

export const metadata: Metadata = {
  title: 'Order confirmed',
  description: 'Your Kharis & Aletheia order confirmation — reference, status and what happens next.',
  robots: { index: false, follow: false },
};

function OrderFallback() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Thank you"
        title="ORDER RECEIVED"
        lede="Here's everything about your order, and what happens between now and delivery."
        minHeight="22vh"
      />

      <section className="co-section-wrap">
        <div className="wrap">
          <Suspense fallback={<OrderFallback />}>
            <OrderConfirmation />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
