import Link from 'next/link';
import { Button } from '@/components/Button';
import { GlitchHeading } from '@/components/GlitchHeading';
import { Reveal } from '@/components/Reveal';
import { KA_CONFIG } from '@/lib/config';
import { SignatureGrid, CustomPrintsGrid } from '@/app/_home/ProductGrids';
import { MakersTeaser } from '@/app/_home/MakersTeaser';
import { LookbookCarousel } from '@/app/_home/LookbookCarousel';
import { NewsletterForm } from '@/app/_home/NewsletterForm';
import { ScrollPill } from '@/app/_home/ScrollPill';

/* KHARIS & ALETHEIA — homepage, ported from ../index.html + ../home.js. The root
   layout's default metadata (app/layout.tsx) already matches this page's old
   <title>/<meta description> verbatim, so no per-page `metadata` export is needed
   here — only the two JSON-LD blocks index.html carried (Organization + WebSite),
   which nothing else on the site emits. */

const JSON_LD_ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KHARIS & ALETHEIA',
  url: KA_CONFIG.siteUrl,
  logo: `${KA_CONFIG.siteUrl}/assets/icon-512.png`,
  email: KA_CONFIG.contactEmail,
};

const JSON_LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'KHARIS & ALETHEIA',
  url: KA_CONFIG.siteUrl,
};

const DROP_CARDS = [
  {
    href: '/shop#tees',
    img: '/assets/mockup-tee-crimson.webp',
    width: 1600,
    height: 1117,
    alt: 'Signature kente stripe tee, front and back',
    label: 'Signature cut',
    title: 'KENTE STRIPE',
    copy: 'Our signature white tee, banded with hand-picked kente cloth. Cut to order.',
    cta: 'Shop the drop →',
    variant: 'berry' as const,
  },
  {
    href: '/shop#sweatshirts',
    img: '/assets/img/banner-sweatshirts.webp',
    width: 1600,
    height: 900,
    alt: 'The sweatshirt line',
    label: 'New — heavy fleece',
    title: 'THE SWEATSHIRT LINE',
    copy: 'Crewnecks and hoodies carrying gold-trimmed adinkra and kente. Cut to order.',
    cta: 'Shop sweatshirts →',
    variant: 'gold' as const,
  },
  {
    href: '/shop?collection=ankara-after-dark',
    img: '/assets/img/drop-ankara.webp',
    width: 1200,
    height: 1200,
    alt: 'Ankara After Dark capsule print',
    label: 'Limited run',
    title: 'ANKARA AFTER DARK',
    copy: 'Bold ankara blocks, re-cut for the night. Numbered, small-batch pieces.',
    cta: 'Shop the capsule →',
    variant: 'gold' as const,
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Pick your print',
    copy: 'Start from our kente, ankara and adinkra library — or bring a pattern of your own.',
    cta: { href: '/lab', label: 'Browse the Print Lab →' },
  },
  {
    num: '02',
    title: 'Make it yours',
    copy: 'Place the print, scale it, rotate it. Every placement cuts a different piece.',
    cta: { href: '/studio', label: 'Open the Tee Studio →' },
  },
  {
    num: '03',
    title: 'Made to order',
    copy: 'We cut and sew your exact layout to order. No warehouse, no two alike. 7–10 day delivery.',
    cta: null,
  },
];

const STUDIOS = [
  { href: '/studio', tag: 'Custom', title: 'Tee Studio', copy: 'Pick a print, place it your way, choose your cut. The full custom flow.' },
  { href: '/lab', tag: 'Design', title: 'Print Lab', copy: 'Remix kente and ankara blocks live. Watch the layout update as you play.' },
  { href: '/shop?collection=kente-codes', tag: 'Collection', title: 'Kente Codes', copy: 'Our signature stripe series, cut to order in three colorways.' },
  { href: '/shop?collection=adinkra-series', tag: 'Collection', title: 'Adinkra Series', copy: 'Symbols of the Akan, block-printed on heavyweight cotton.' },
  { href: '/shop?collection=ankara-after-dark', tag: 'Capsule', title: 'Ankara After Dark', copy: "The night-time capsule. Numbered, small batch, gone when it's gone." },
  { href: '/shop?collection=wraps-caps', tag: 'Accessories', title: 'Wraps & Caps', copy: 'Headwraps, caps and totes in matching prints to finish the fit.' },
  { href: '/bulk', tag: 'Teams', title: 'Crew & Bulk', copy: 'Matching prints for crews, events and brands. Bulk, made to order.' },
  { href: '/gift', tag: 'Gift', title: 'Gift Cards', copy: 'Give grace & truth. Digital gift cards from £25.' },
];

const WILD_SHOTS = [
  { img: '/assets/img/street-1.webp', alt: 'Kente stripe tee, city dusk', caption: 'Accra — dusk' },
  { img: '/assets/img/street-2.webp', alt: 'Ankara chest panel, close detail', caption: 'Ankara panel — detail' },
  { img: '/assets/img/street-3.webp', alt: 'Friends in matching prints at night', caption: 'Night shift — two of a kind' },
];

const VALUES = [
  { title: 'ON DEMAND', copy: 'Cut only after you order. Nothing sits in a warehouse.' },
  { title: 'ONE OF ONE', copy: 'Every print placement is a single, unrepeatable cut.' },
  { title: 'REAL COTTON', copy: 'Heavyweight 220gsm cotton, printed and sewn to last.' },
];

export default function Home() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/next-script-for-ga -- static JSON-LD, not analytics */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_ORG) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }} />

      {/* ============ HERO ============ */}
      <header className="hero" id="top">
        <div className="hero-bg" />
        <div className="hero-slice s1" />
        <div className="hero-slice s2" />
        <div className="hero-veil" />
        <div className="scanlines" />

        <div className="hero-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-mark" src="/assets/icon.png" width={512} height={512} alt="Kharis & Aletheia mark" decoding="async" />
          <p className="micro">African print tees · Made to order</p>
          <h1 className="h-display hero-title">
            <span className="glitch glitch-anim" data-text="GRACE">
              GRACE
            </span>
            <br />
            <span className="glitch glitch-anim amp" data-text="& TRUTH">
              &amp; TRUTH
            </span>
          </h1>
          <p className="hero-sub">
            Kharis &amp; Aletheia — African-print tees and accessories, cut to order. Pick a print, place it your way,
            and we sew it. Just for you.
          </p>
          <div className="hero-cta">
            <Button variant="berry" href="/shop">
              Shop the drop →
            </Button>
            <Button variant="gold" href="/lab">
              Explore the prints
            </Button>
          </div>
        </div>
        <a className="scroll-hint" href="#drop" aria-label="Scroll down">
          ▼
        </a>
      </header>

      {/* ============ THIS SEASON'S DROP ============ */}
      <section id="drop">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">FW2026</p>
            <GlitchHeading as="h2" text="THE LATEST DROP" animate={false} className="h-xl" />
          </Reveal>
          <div className="drop-grid">
            {DROP_CARDS.map((card, i) => (
              <Reveal key={card.title} delay={((i % 3) + 1) as 1 | 2 | 3}>
                <Link className="drop-card" href={card.href}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="card-img" src={card.img} width={card.width} height={card.height} alt={card.alt} loading="lazy" decoding="async" />
                  <div className="card-shade" />
                  <div className="card-body">
                    <p className="card-label">{card.label}</p>
                    <h3 className="card-title glitch" data-text={card.title}>
                      {card.title}
                    </h3>
                    <p className="card-copy">{card.copy}</p>
                    <span className={`btn btn-${card.variant}`}>{card.cta}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LOOKBOOK ============ */}
      <section id="lookbook">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">Lookbook</p>
            <GlitchHeading as="h2" text="OUT IN THE WILD" animate={false} className="h-xl" />
          </Reveal>
          <LookbookCarousel />
          <Reveal as="p" className="lookbook-cta">
            <Link className="link-arrow" href="/lookbook">
              View the lookbook →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ============ MAKERS ============ */}
      <section id="makers">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">Collaborations</p>
            <GlitchHeading as="h2" text="THE MAKERS BEHIND THE PRINTS" animate={false} className="h-xl" />
          </Reveal>
          <MakersTeaser />
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">How it works</p>
            <GlitchHeading as="h2" text="THREE STEPS FROM PRINT TO PERSON" animate={false} className="h-xl" />
          </Reveal>
          <div className="step-grid">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} className="step-card" delay={((i % 3) + 1) as 1 | 2 | 3}>
                <div className="step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                {step.cta && (
                  <Link className="link-arrow" href={step.cta.href}>
                    {step.cta.label}
                  </Link>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STUDIOS ============ */}
      <section id="studios">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">Pick your canvas</p>
            <GlitchHeading as="h2" text="CHOOSE A STUDIO" animate={false} className="h-xl" />
          </Reveal>
          <div className="studio-grid">
            {STUDIOS.map((s, i) => (
              <Reveal key={s.title} delay={((i % 3) + 1) as 1 | 2 | 3}>
                <Link className="studio-card" href={s.href}>
                  <span className="tag">{s.tag}</span>
                  <h3>{s.title}</h3>
                  <p>{s.copy}</p>
                  <span className="link-arrow">Enter →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SHOP ============ */}
      <section id="shop">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">Shop the print</p>
            <GlitchHeading as="h2" text="FRESH OFF THE PRESS" animate={false} className="h-xl" />
          </Reveal>
          <SignatureGrid />
          <CustomPrintsGrid />
        </div>
      </section>

      {/* ============ ON THE STREETS ============ */}
      <section id="wild">
        <div className="wrap">
          <Reveal className="sec-head">
            <p className="micro">In the wild</p>
            <GlitchHeading as="h2" text="ON THE STREETS" animate={false} className="h-xl" />
          </Reveal>
          <div className="wild-grid">
            {WILD_SHOTS.map((shot, i) => (
              <Reveal key={shot.img} className="wild-card" delay={((i % 3) + 1) as 1 | 2 | 3}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.img} alt={shot.alt} loading="lazy" decoding="async" width={1536} height={1024} />
                <span>{shot.caption}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ VALUES ============ */}
      <section id="values" style={{ paddingTop: '2rem' }}>
        <div className="wrap">
          <Reveal className="values">
            {VALUES.map((v) => (
              <div key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.copy}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="cta-final">
        <div className="scanlines" style={{ opacity: 0.25 }} />
        <h2 className="h-display">
          <span className="glitch glitch-anim" data-text="WEAR YOUR">
            WEAR YOUR
          </span>
          <br />
          <span className="glitch glitch-anim" data-text="STORY">
            STORY
          </span>
        </h2>
        <p>No two prints fall the same. Neither does your tee.</p>
        <Button variant="berry" href="/shop">
          Shop the drop →
        </Button>
      </section>

      {/* ============ NEWSLETTER ============ */}
      <section id="newsletter">
        <div className="wrap">
          <Reveal className="newsletter">
            <div className="nl-copy">
              <p className="micro">Stay in the loop</p>
              <h2 className="h-display h-md">FIRST LOOK AT NEW DROPS</h2>
              <p>New prints, new capsules, no spam — straight to your inbox.</p>
            </div>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>

      <ScrollPill />
    </>
  );
}
