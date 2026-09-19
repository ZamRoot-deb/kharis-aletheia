import type { Metadata } from 'next';
import Link from 'next/link';
import { KA_CONFIG } from '@/lib/config';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { Accordion } from '@/components/Accordion';
import { BulkCalculator } from './BulkCalculator';

/* ../bulk.html — Crew & Bulk: who-it's-for, live quote calculator + enquiry
   (BulkCalculator.tsx), process steps, FAQ. */

const TITLE = 'CREW & BULK';
const DESCRIPTION =
  "Matching made-to-order prints for crews, events, brands, choirs and weddings. Live quote calculator, tiered pricing from 10 pieces.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/bulk' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/bulk' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function BulkPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Teams, events & brands"
        title="CREW & BULK"
        lede="Matching prints for the whole group — cut and sewn to order, priced by the piece. Get a live estimate below, then send us the brief."
        minHeight="40vh"
      />

      {/* ============ WHO IT'S FOR ============ */}
      <section style={{ padding: '5rem 0 2rem' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">Who this is for</p>
            <h2 className="h-display h-lg">ONE PRINT, WHOLE GROUP</h2>
            <p className="lede">If more than one person needs to show up in the same cloth, this is the route.</p>
          </Reveal>
          <div className="who-grid">
            <Reveal className="who-card">
              <h3>Crews &amp; teams</h3>
              <p>Sports teams, work crews and staff kits — one print, everyone matching, sizes handled per person.</p>
            </Reveal>
            <Reveal className="who-card" delay={1}>
              <h3>Events &amp; reunions</h3>
              <p>Conferences, retreats, family reunions and anniversaries — a run made for one date, worn long after.</p>
            </Reveal>
            <Reveal className="who-card" delay={2}>
              <h3>Brands &amp; businesses</h3>
              <p>Retail drops, collabs and staff merch on real heavyweight cotton — not a print-shop shortcut.</p>
            </Reveal>
            <Reveal className="who-card">
              <h3>Choirs &amp; churches</h3>
              <p>Choir robeswear, anniversary cloth and ministry tees — colour and print matched across the group.</p>
            </Reveal>
            <Reveal className="who-card" delay={1}>
              <h3>Weddings</h3>
              <p>Aso-ebi coordination, bridal party sets and after-party tees — cut for the whole wedding party.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ CALCULATOR + ENQUIRY ============ */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">Get a quote</p>
            <h2 className="h-display h-lg">CALCULATE YOUR RUN</h2>
            <p className="lede">This is a live estimate, not an invoice — your exact price is confirmed once we&rsquo;ve seen your brief.</p>
          </Reveal>

          <Reveal as="div" className="note-strip">
            <b>Minimum order is 10 pieces</b> per enquiry, mixed sizes welcome — that&rsquo;s the smallest run we can cut and price as bulk. Need fewer than that? Head to the{' '}
            <Link href="/shop">shop</Link> or build one in the <Link href="/studio">Tee Studio</Link> instead.
          </Reveal>

          <BulkCalculator />
        </div>
      </section>

      {/* ============ PROCESS ============ */}
      <section style={{ padding: '3rem 0' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">How it works</p>
            <h2 className="h-display h-lg">FOUR STEPS</h2>
          </Reveal>
          <div className="step-grid">
            <Reveal className="step-card">
              <p className="step-num">01</p>
              <h3>Send your brief</h3>
              <p>Play with the calculator above, then send headcount, sizes and dates with the enquiry form.</p>
            </Reveal>
            <Reveal className="step-card" delay={1}>
              <p className="step-num">02</p>
              <h3>We quote &amp; confirm</h3>
              <p>A real quote back within two working days. Artwork, sizes and price locked in before we cut anything.</p>
            </Reveal>
            <Reveal className="step-card" delay={2}>
              <p className="step-num">03</p>
              <h3>Cut &amp; sewn to order</h3>
              <p>Your run is cut, printed and sewn as one batch — nothing pulled from a warehouse shelf.</p>
            </Reveal>
            <Reveal className="step-card" delay={3}>
              <p className="step-num">04</p>
              <h3>Delivered</h3>
              <p>Ships in {KA_CONFIG.leadTime} once confirmed. Larger runs: timing agreed upfront.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section style={{ padding: '2rem 0 7rem' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">Questions</p>
            <h2 className="h-display h-lg">CREW &amp; BULK FAQ</h2>
          </Reveal>
          <Reveal as="div" className="form-faq-list">
            <Accordion summary="What's the minimum order?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>10 pieces per enquiry. Mixed sizes are completely fine — the size breakdown in the calculator just needs to add up to your total quantity.</p>
            </Accordion>
            <Accordion summary="How is bulk pricing worked out?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Discount tiers off the base garment price: 10+ pieces save 10%, 25+ save 15%, 50+ save 20%, 100+ save 25%. The calculator above shows your live estimate — your exact total is confirmed in the quote we send back.</p>
            </Accordion>
            <Accordion summary="How long does a bulk order take?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Standard runs ship in {KA_CONFIG.leadTime} from confirmed order. Larger runs or custom artwork can take longer — we&rsquo;ll always agree a realistic date with you before production starts.</p>
            </Accordion>
            <Accordion summary="Can I use my own artwork or logo?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Yes — choose &ldquo;Your artwork&rdquo; in the calculator and describe or attach it when you email us back. We&rsquo;ll confirm print feasibility and any setup before production begins.</p>
            </Accordion>
            <Accordion summary="What's the difference between the print approaches?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>House print uses one of our existing kente, ankara or adinkra designs as-is — fastest option. Custom placement takes a house print but repositions it to your spec. Your artwork means you supply the design entirely. All three are cut and sewn to order.</p>
            </Accordion>
            <Accordion summary="What if my headcount changes after I enquire?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Let us know as early as possible. Once your quote is confirmed and production has started, changes get harder — but before that, we&rsquo;ll always try to adjust the quantity and requote.</p>
            </Accordion>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
