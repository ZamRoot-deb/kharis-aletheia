import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { GlitchHeading } from '@/components/GlitchHeading';
import { Reveal } from '@/components/Reveal';
import { LookbookGrid } from './LookbookGrid';

/* KHARIS & ALETHEIA — /lookbook, ported from ../lookbook.html. Layout's title
   template ('%s — KHARIS & ALETHEIA') reproduces the old <title> exactly. */
export const metadata: Metadata = {
  title: 'LOOKBOOK',
  description:
    'Eight looks and three street shots from Kharis & Aletheia — every piece shoppable, every print cut to order.',
  openGraph: {
    title: 'LOOKBOOK — KHARIS & ALETHEIA',
    description:
      'Eight looks and three street shots from Kharis & Aletheia — every piece shoppable, every print cut to order.',
  },
  twitter: {
    title: 'LOOKBOOK — KHARIS & ALETHEIA',
    description:
      'Eight looks and three street shots from Kharis & Aletheia — every piece shoppable, every print cut to order.',
  },
};

export default function LookbookPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="The lookbook"
        title="OUT IN THE WILD"
        lede="Eight looks and three street shots — worn in Accra, cut to order everywhere. Click a photo to shop it."
        image={{
          src: '/assets/img/drop-ankara.webp',
          alt: 'Editorial detail shot from the Kharis & Aletheia lookbook',
          width: 1200,
          height: 1200,
        }}
      />

      <section className="lb-section">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">FW2026</p>
            <GlitchHeading as="h2" text="EVERY LOOK, SHOPPABLE" animate={false} className="h-lg" />
            <p className="lede">
              Tap any photo for a full-size view. Each look&rsquo;s panel lists exactly what it&rsquo;s wearing —
              size, price and a straight line to your cart.
            </p>
          </Reveal>

          <LookbookGrid />
        </div>
      </section>
    </div>
  );
}
