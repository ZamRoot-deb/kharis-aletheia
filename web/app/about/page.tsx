import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { Button } from '@/components/Button';

/* ../about.html — the house's name meaning + values. Photo+veil `.page-hero`
   variant (image passed to PageHero). Note: ../styles.css defines a `.press-strip`
   component class, but no ../*.html ever fills it with quotes — porting real copy
   only (CONTRACT-NEXT.md "no fake data"), so no press strip is rendered here; the
   class remains available (ported into app/styles/base.css by foundation) if the
   owner supplies real press copy later. */

const TITLE = 'ABOUT';
const DESCRIPTION =
  'Kharis & Aletheia — grace and truth, woven into African-print tees and accessories, cut to order.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/about' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function AboutPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Our story"
        title="GRACE & TRUTH, WOVEN IN"
        lede="African-print tees and accessories, cut to order. No warehouse. No two alike."
        image={{
          src: '/assets/img/about-atelier.webp',
          alt: 'Inside the atelier — cutting wax print cloth',
          width: 1536,
          height: 1024,
        }}
      />

      <section>
        <div className="wrap">
          <div className="about-grid">
            <Reveal className="about-copy">
              <p className="micro">The name</p>
              <p>
                At its core, each Kharis &amp; Aletheia piece is more than clothing; it is a canvas for
                self-expression. The house takes its name from two Greek words that carry everything we
                believe a garment should hold:
              </p>
              <div className="name-meaning">
                <div className="nm-card">
                  <h4>KHARIS · χάρις</h4>
                  <span>Grace — the unearned gift. The drape, the softness, the way a tee falls on your shoulders.</span>
                </div>
                <div className="nm-card">
                  <h4>ALETHEIA · ἀλήθεια</h4>
                  <span>Truth — what is revealed, not concealed. Prints with a real lineage: kente, ankara, adinkra.</span>
                </div>
              </div>
              <p>
                We work with <b>kente, ankara and adinkra</b> — patterns that were never just decoration.
                Every symbol has a meaning, every stripe a proverb. When you place a print on one of our
                tees, you&apos;re choosing what to carry.
              </p>
              <p>
                Every order is <b>cut and sewn to order</b> — made for you after you buy, never before. It
                means slower fashion, zero dead stock, and pieces that genuinely belong to one person.
                That&apos;s the whole point.
              </p>
            </Reveal>
            <Reveal delay={2}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                decoding="async"
                loading="lazy"
                src="/assets/img/about-atelier.webp"
                width={1536}
                height={1024}
                alt="Cutting wax print cloth in the atelier"
              />
            </Reveal>
          </div>

          <div style={{ marginBottom: '5rem' }}>
            <Reveal className="values">
              <div>
                <h3>MADE TO ORDER</h3>
                <p>Cut only after you order. Nothing sits in a warehouse.</p>
              </div>
              <div>
                <h3>ONE OF ONE</h3>
                <p>Every print placement is a single, unrepeatable cut.</p>
              </div>
              <div>
                <h3>REAL COTTON</h3>
                <p>Heavyweight 220gsm cotton, printed and sewn to last.</p>
              </div>
            </Reveal>
          </div>

          <div style={{ textAlign: 'center', padding: '2rem 0 3rem' }}>
            <Reveal>
              <Button variant="berry" href="/shop">
                Shop the collection →
              </Button>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
