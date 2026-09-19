import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { GiftForm } from './GiftForm';

/* ../gift.html — gift cards: amount + live preview + recipient/sender/message/
   send-date (GiftForm.tsx, add-to-cart), how-it-works, terms. No FAQ section on
   the old page. */

const TITLE = 'GIFT CARDS';
const DESCRIPTION =
  'Digital Kharis & Aletheia gift cards from £10 to £500 — personalise a message, pick a send date, put towards any made-to-order piece.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/gift' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/gift' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function GiftPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Give grace & truth"
        title="GIFT CARDS"
        lede="A digital gift card, personalised and sent on the day you choose. They pick the piece — cut and sewn to order, same as everything else."
        minHeight="40vh"
      />

      <section style={{ padding: '4rem 0 2rem' }}>
        <div className="wrap">
          <GiftForm />
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section style={{ padding: '3rem 0' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">How it works</p>
            <h2 className="h-display h-lg">SIMPLE, DIGITAL, PERSONAL</h2>
          </Reveal>
          <div className="step-grid">
            <Reveal className="step-card">
              <p className="step-num">01</p>
              <h3>Choose an amount</h3>
              <p>Pick a preset or set your own, from £10 to £500.</p>
            </Reveal>
            <Reveal className="step-card" delay={1}>
              <p className="step-num">02</p>
              <h3>Personalise it</h3>
              <p>Add a recipient, a message and the day it should land.</p>
            </Reveal>
            <Reveal className="step-card" delay={2}>
              <p className="step-num">03</p>
              <h3>We deliver on the day</h3>
              <p>Sent by email on the send date you chose — the confirmation is the card.</p>
            </Reveal>
            <Reveal className="step-card" delay={3}>
              <p className="step-num">04</p>
              <h3>They spend it their way</h3>
              <p>Email us the confirmation when they&rsquo;re ready and we&rsquo;ll apply it to their order by hand.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ TERMS ============ */}
      <section style={{ padding: '2rem 0 7rem' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">The fine print</p>
            <h2 className="h-display h-lg">GIFT CARD TERMS</h2>
          </Reveal>
          <Reveal as="div" className="terms-block">
            <p>Gift cards are delivered digitally by email on the send date you choose — no physical card is posted. Validity and any other terms are set at the time of issue and confirmed in the email your recipient receives.</p>
            <p>Gift cards are applied by hand against any made-to-order Kharis &amp; Aletheia piece — forward your gift card confirmation email when placing an order and we&rsquo;ll credit the balance, combining it with another payment method to cover any remainder. They cannot be exchanged for cash and cannot be used to purchase further gift cards.</p>
            <p>
              Made a mistake with a recipient&rsquo;s details?{' '}
              <Link href="/contact" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                Contact us
              </Link>{' '}
              before the send date and we&rsquo;ll help put it right.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
