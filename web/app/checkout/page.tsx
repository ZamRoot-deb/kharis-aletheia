import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CheckoutForm } from './CheckoutForm';

/* KHARIS & ALETHEIA — /checkout. Ported from ../checkout.html. Server shell (hero +
   noscript fallback) around the client CheckoutForm, which owns all cart/form state.
   Owns: app/checkout/** app/order/** — see CONTRACT-NEXT.md "commerce" row. */

export const metadata: Metadata = {
  title: 'Checkout',
  description: "Checkout — review your made-to-order pieces, add delivery details and place your order.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="page">
      <noscript>
        <div className="wrap" style={{ padding: '2rem 0 0' }}>
          <p className="micro">JavaScript required</p>
          <p className="lede">
            Checkout needs JavaScript enabled to review your cart and place an order. Please enable it, or{' '}
            <Link href="/contact">contact us</Link> to order another way.
          </p>
        </div>
      </noscript>

      <PageHero
        eyebrow="Almost there"
        title="CHECKOUT"
        lede="Made to order, cut for you alone. Review your pieces and tell us where they're going."
        minHeight="24vh"
      />

      <section className="co-section-wrap">
        <div className="wrap">
          <CheckoutForm />
        </div>
      </section>
    </div>
  );
}
