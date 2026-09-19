import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';

/* ../policies.html — made-to-order / refunds / sizing / shipping / contact. Plain
   `.page-hero.plain` gradient variant, no photo. */

const TITLE = 'REFUND POLICY & TERMS';
const DESCRIPTION = 'Refund policy and terms of service for Kharis & Aletheia made-to-order pieces.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/policies' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/policies' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function PoliciesPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="The fine print"
        title="REFUND POLICY & TERMS"
        lede="Made-to-order has its own rules. Here's the honest version."
        minHeight="32vh"
      />

      <section style={{ padding: '2rem 0 6rem' }}>
        <div className="wrap">
          <div className="policy-block">
            <h2>Made to order</h2>
            <p>
              Every Kharis &amp; Aletheia piece is cut and sewn after you order. Production begins within
              24 hours of purchase, and pieces ship in 7–10 working days.
            </p>

            <h2>Refunds &amp; returns</h2>
            <p>
              Because each piece is made for you alone, we can&apos;t accept change-of-mind returns once
              production has started. If your piece arrives faulty, damaged, or not as ordered, contact us
              within 14 days of delivery and we&apos;ll remake it or refund it in full — your choice.
            </p>
            <p>Orders can be cancelled for a full refund within 24 hours of purchase, before the cloth is cut.</p>

            <h2>Sizing</h2>
            <p>
              Check the size charts before ordering. Between sizes, we recommend sizing up. If a
              made-to-order piece doesn&apos;t fit, get in touch — we&apos;ll always try to make it right
              with an exchange where stock cloth allows.
            </p>

            <h2>Shipping</h2>
            <p>
              We ship worldwide. UK delivery is free over £75; international rates are calculated at
              checkout. Custom pieces may take a little longer at drop time.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about an order?{' '}
              <Link href="/contact">Get in touch</Link> with your order number and we&apos;ll reply within
              two working days.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
