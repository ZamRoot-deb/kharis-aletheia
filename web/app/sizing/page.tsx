import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { SizeTabs } from './SizeTabs';

/* ../sizing.html — size charts for tees/sweatshirts/hoodies. `.page-hero.plain`
   (no photo), tab pills + tables ported into SizeTabs.tsx (state, not DOM toggling). */

const TITLE = 'SIZING';
const DESCRIPTION =
  'Size charts for Kharis & Aletheia tees, sweatshirts and hoodies. All garments cut to order.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/sizing' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/sizing' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function SizingPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Sizing"
        title="SIZE CHARTS"
        lede="All measurements in inches. Garments are cut and sewn to order — between sizes, size up for a relaxed drape."
        minHeight="38vh"
      />

      <section style={{ padding: '4rem 0 8rem' }}>
        <div className="wrap">
          <SizeTabs />

          <p className="lede" style={{ marginTop: '2rem' }}>
            Not sure?{' '}
            <Link href="/contact" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
              Talk to us
            </Link>{' '}
            — every piece is made to order, so small fit adjustments are always possible.
          </p>
        </div>
      </section>
    </div>
  );
}
