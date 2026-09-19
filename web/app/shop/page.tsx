import type { Metadata } from 'next';
import { Suspense } from 'react';
import Loading from '@/app/loading';
import { KA_CONFIG } from '@/lib/config';
import { ShopClient } from './ShopClient';

/* KHARIS & ALETHEIA — /shop route. Ported from ../shop.html's <head>. ShopClient
   uses useSearchParams(), so it must be a client component wrapped in <Suspense>
   per CONTRACT-NEXT.md's HYDRATION rule. */

const TITLE = 'SHOP';
const DESCRIPTION =
  'The full Kharis & Aletheia collection — African-print tees, sweatshirts and accessories, cut to order. Search, filter by collection or price.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/shop' },
  openGraph: {
    siteName: KA_CONFIG.brand,
    type: 'website',
    title: `${TITLE} — ${KA_CONFIG.brand}`,
    description: DESCRIPTION,
    url: '/shop',
    images: ['/assets/og-cover.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} — ${KA_CONFIG.brand}`,
    description: DESCRIPTION,
    images: ['/assets/og-cover.jpg'],
  },
};

export default function ShopPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ShopClient />
    </Suspense>
  );
}
