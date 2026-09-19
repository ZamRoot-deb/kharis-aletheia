import type { Metadata } from 'next';
import Link from 'next/link';
import { KA_CONFIG } from '@/lib/config';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { Accordion } from '@/components/Accordion';
import { ContactForm } from './ContactForm';

/* ../contact.html — contact form (ContactForm.tsx) + direct-email/before-you-write
   sidebar + FAQ (kept consistent with ../policies.html and ../sizing.html links). */

const TITLE = 'CONTACT';
const DESCRIPTION =
  'Get in touch with Kharis & Aletheia about an order, sizing, a custom print, bulk enquiries or press. We reply within two working days.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION, url: '/contact' },
  twitter: { title: `${TITLE} — KHARIS & ALETHEIA`, description: DESCRIPTION },
};

export default function ContactPage() {
  return (
    <div className="page">
      <PageHero
        eyebrow="Talk to us"
        title="CONTACT"
        lede="Order question, sizing help, a custom idea, a bulk brief or press — tell us what's up. We reply within two working days."
        minHeight="36vh"
      />

      <section style={{ padding: '4rem 0 2rem' }}>
        <div className="wrap">
          <div className="contact-shell">
            <ContactForm />

            <Reveal as="aside" className="contact-side" delay={1}>
              <div className="side-card">
                <h3>Write to us directly</h3>
                <p>Prefer email? Reach us here — we reply within two working days.</p>
                <a className="direct-email link-arrow" href={`mailto:${KA_CONFIG.contactEmail}`}>
                  {KA_CONFIG.contactEmail}
                </a>
              </div>
              <div className="side-card">
                <h3>Before you write</h3>
                <p>
                  Sizing question? Check the{' '}
                  <Link href="/sizing" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                    size charts
                  </Link>{' '}
                  first.
                </p>
                <p>
                  Order question? Have your reference (e.g. <code>KA-482913</code>) to hand — it&rsquo;s optional, but it speeds things up.
                </p>
                <p>
                  Return or refund? Read the{' '}
                  <Link href="/policies" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                    Refund Policy &amp; Terms
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section style={{ padding: '2rem 0 7rem' }}>
        <div className="wrap">
          <Reveal as="div" className="sec-head">
            <p className="micro">Before you ask</p>
            <h2 className="h-display h-lg">FREQUENTLY ASKED</h2>
          </Reveal>
          <Reveal as="div" className="form-faq-list">
            <Accordion summary="Is everything really made to order?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Yes. Every piece is cut and sewn after you place your order — nothing sits pre-made in a warehouse. Production begins within 24 hours of purchase.</p>
            </Accordion>
            <Accordion summary="How long will my order take?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>Standard pieces ship in {KA_CONFIG.leadTime}. Custom Tee Studio and Print Lab pieces follow the same window once your design is confirmed.</p>
            </Accordion>
            <Accordion summary="What's your returns policy?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>
                Because each piece is made for you, we can&rsquo;t accept change-of-mind returns once production has started — but you can cancel for a full refund within 24 hours of ordering. If something arrives faulty, damaged or wrong, tell us within 14 days of delivery and we&rsquo;ll remake it or refund it in full, your choice. Full details on the{' '}
                <Link href="/policies">Refund Policy &amp; Terms</Link> page.
              </p>
            </Accordion>
            <Accordion summary="How do I know what size to order?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>
                Check our <Link href="/sizing">size charts</Link> before you order — measurements are in inches for tees, sweatshirts and hoodies. Between sizes, we recommend sizing up for a relaxed drape.
              </p>
            </Accordion>
            <Accordion summary="Do you ship internationally?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>We ship worldwide. UK delivery is free over £75; international rates are calculated at checkout based on your country.</p>
            </Accordion>
            <Accordion summary="Can I get a custom print or design?" className="form-faq-item" bodyClassName="form-faq-a">
              <p>
                Yes — build one with the <Link href="/studio">Tee Studio</Link>, or design a print from scratch in the <Link href="/lab">Print Lab</Link>. Ordering for a team or event of 10 or more? Use <Link href="/bulk">Crew &amp; Bulk</Link> instead.
              </p>
            </Accordion>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
