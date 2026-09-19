import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Button } from '@/components/Button';

/* ../404.html — on-brand not-found page. Rendered by the App Router inside the
   existing root layout (Nav/Footer/CartDrawer stay mounted), both for genuinely
   unmatched routes and anywhere a route calls next/navigation's `notFound()`. */

export const metadata: Metadata = {
  title: 'PAGE NOT FOUND',
  description: "That page doesn't exist. Find your way back to Kharis & Aletheia's shop, Tee Studio or homepage.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="page">
      <PageHero
        eyebrow="404"
        title="NOT CUT YET"
        lede="That page doesn't exist — maybe the link's stale, maybe it never was. Here's where you actually want to be."
        minHeight="60vh"
        align="center"
      >
        <div className="flex gap-4 justify-center flex-wrap mt-8">
          <Button variant="gold" href="/">
            Back home
          </Button>
          <Button variant="berry" href="/shop">
            Shop the collection
          </Button>
          <Button href="/studio">Tee Studio</Button>
        </div>
      </PageHero>
    </div>
  );
}
