import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { Accordion } from '@/components/Accordion';
import { StudioBuilder } from './StudioBuilder';

/* KHARIS & ALETHEIA — /studio (Tee Studio). Ported from ../studio.html.
   Static shell (hero, "how it works", FAQ) here; the heavy stateful builder
   lives in StudioBuilder.tsx per CONTRACT-NEXT.md's studio/lab ownership note. */

export const metadata: Metadata = {
  title: 'TEE STUDIO',
  description:
    'Pick a print, place it your way, scale it, rotate it. Design your own Kharis & Aletheia tee, long-sleeve, crewneck or hoodie — cut and sewn to your exact layout.',
};

export default function StudioPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Custom · made to order"
        title="TEE STUDIO"
        lede="Pick a print, place it your way, scale it, rotate it. We cut and sew your exact layout — nothing leaves the floor until it matches what you see here."
        minHeight="40vh"
      />

      <StudioBuilder />

      {/* ===== how the studio works ===== */}
      <section className="hiw-strip">
        <div className="wrap">
          <Reveal as="div" className="sec-head center">
            <p className="micro">How the studio works</p>
            <h2 className="h-display h-lg">FOUR STEPS TO A ONE-OF-ONE</h2>
          </Reveal>
          <div className="step-grid">
            <Reveal as="div" className="step-card">
              <div className="step-num">01</div>
              <h3>Pick your canvas</h3>
              <p>Choose the garment, the colour and a print with a real story — kente, ankara or adinkra.</p>
            </Reveal>
            <Reveal as="div" className="step-card" delay={1}>
              <div className="step-num">02</div>
              <h3>Place it your way</h3>
              <p>Drag the print onto the garment, scale it, rotate it, choose front or back. The preview updates live.</p>
            </Reveal>
            <Reveal as="div" className="step-card" delay={2}>
              <div className="step-num">03</div>
              <h3>Lock your size</h3>
              <p>Pick a size, set the quantity, and read back the exact spec sheet the workshop will cut from.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="faq-section">
        <div className="wrap">
          <Reveal as="div" className="sec-head center">
            <p className="micro">Before you order</p>
            <h2 className="h-display h-lg">STUDIO FAQ</h2>
          </Reveal>
          <Reveal as="div" className="faq-list">
            <Accordion className="faq-item" bodyClassName="faq-body" summary="Can I upload my own pattern or artwork?">
              Not yet — the Tee Studio only works with prints built in our{' '}
              <Link href="/lab" style={{ color: 'var(--gold)' }}>
                Print Lab
              </Link>{' '}
              or saved from it. If you have your own artwork you&apos;d like printed,{' '}
              <Link href="/contact" style={{ color: 'var(--gold)' }}>
                get in touch
              </Link>{' '}
              and we&apos;ll see what we can do.
            </Accordion>
            <Accordion className="faq-item" bodyClassName="faq-body" summary="How long does a custom piece take?">
              Every custom order is cut and sewn after you buy — allow 7–10 working days before it ships. There&apos;s
              no warehouse stock to speed this up; that&apos;s what makes it yours alone.
            </Accordion>
            <Accordion className="faq-item" bodyClassName="faq-body" summary="Can I change my design after ordering?">
              Once an order is placed, cutting starts quickly, so changes can&apos;t be guaranteed. If you need to
              adjust something,{' '}
              <Link href="/contact" style={{ color: 'var(--gold)' }}>
                contact us
              </Link>{' '}
              as soon as possible and we&apos;ll do what we can.
            </Accordion>
            <Accordion className="faq-item" bodyClassName="faq-body" summary="Ordering more than a few pieces?">
              For team or event orders, the{' '}
              <Link href="/bulk" style={{ color: 'var(--gold)' }}>
                Crew &amp; Bulk
              </Link>{' '}
              page has volume pricing and a quote calculator built for exactly that.
            </Accordion>
            <Accordion className="faq-item" bodyClassName="faq-body" summary="What if the placement I want isn't listed?">
              The Studio covers chest, diagonal sweep, side stripe, pocket, both sleeves and all-over. If you need
              something outside that list,{' '}
              <Link href="/contact" style={{ color: 'var(--gold)' }}>
                message us
              </Link>{' '}
              — we take on custom placements case by case.
            </Accordion>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
