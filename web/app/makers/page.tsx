import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Button } from '@/components/Button';
import { MakerSections } from './MakerSections';

/* KHARIS & ALETHEIA — /makers, ported from ../makers.html. Layout's title template
   ('%s — KHARIS & ALETHEIA') reproduces the old <title> exactly. */
export const metadata: Metadata = {
  title: 'MAKERS',
  description:
    "Meet the independent print designers behind Kharis & Aletheia's maker series — their story, their prints, their pieces.",
  openGraph: {
    title: 'MAKERS — KHARIS & ALETHEIA',
    description:
      "Meet the independent print designers behind Kharis & Aletheia's maker series — their story, their prints, their pieces.",
  },
  twitter: {
    title: 'MAKERS — KHARIS & ALETHEIA',
    description:
      "Meet the independent print designers behind Kharis & Aletheia's maker series — their story, their prints, their pieces.",
  },
};

export default function MakersPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Collaborations"
        title="THE MAKERS BEHIND THE PRINTS"
        lede="Independent print designers, each running their own series — cut and sewn to order alongside the house line."
        image={{
          src: '/assets/img/about-atelier.webp',
          alt: 'A maker at work, cutting wax-print cloth',
          width: 1536,
          height: 1024,
        }}
      />

      <div id="makersRoot">
        <MakerSections />
      </div>

      <section className="cta-final">
        <div className="scanlines" style={{ opacity: 0.25 }} />
        <h2 className="h-display">
          <span className="glitch glitch-anim" data-text="MAKE SOMETHING">
            MAKE SOMETHING
          </span>
          <br />
          <span className="glitch glitch-anim" data-text="WITH US">
            WITH US
          </span>
        </h2>
        <p>Got a print, a story or a series of your own? We want to hear it.</p>
        <Button variant="berry" href="/contact">
          Work with us →
        </Button>
      </section>
    </div>
  );
}
