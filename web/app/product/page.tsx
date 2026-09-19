import type { Metadata } from 'next';
import { Suspense } from 'react';
import Loading from '@/app/loading';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import type { Product } from '@/lib/types';
import { ProductClient } from './ProductClient';

/* KHARIS & ALETHEIA — /product?id= route. Ported from ../product.html + the
   title/meta/OG/JSON-LD portions of ../product.js's renderProduct()/renderNotFound()/
   setSocialMeta()/injectJsonLd() — done server-side here via generateMetadata() + an
   inline JSON-LD <script>, since Next's Metadata API replaces the old runtime
   document.title/meta mutation entirely. ProductClient (the interactive detail view)
   still reads `id` itself via useSearchParams(), wrapped in <Suspense>, per
   CONTRACT-NEXT.md's HYDRATION rule. */

type SearchParams = { id?: string | string[] };

function idFrom(sp: SearchParams): string | undefined {
  const raw = sp.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const product = KA_CORE.findProduct(idFrom(sp));

  if (!product) {
    const title = 'Piece not found';
    const description = 'That piece could not be found. Browse the full Kharis & Aletheia collection instead.';
    return {
      title,
      description,
      openGraph: {
        siteName: KA_CONFIG.brand,
        type: 'website',
        title: `${title} — ${KA_CONFIG.brand}`,
        description,
        images: ['/assets/og-cover.jpg'],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} — ${KA_CONFIG.brand}`,
        description,
        images: ['/assets/og-cover.jpg'],
      },
    };
  }

  const title = product.name;
  const description = (product.blurb || '').slice(0, 155);
  const url = `/product?id=${encodeURIComponent(product.id)}`;
  const image = `/${product.img}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      siteName: KA_CONFIG.brand,
      type: 'website',
      title: `${title} — ${KA_CONFIG.brand}`,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — ${KA_CONFIG.brand}`,
      description,
      images: [image],
    },
  };
}

function jsonLdFor(product: Product) {
  const siteUrl = (KA_CONFIG.siteUrl || '').replace(/\/$/, '');
  const imgPath = String(product.img || '').replace(/^\.?\//, '');
  const sold = !!product.sold;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: siteUrl ? [siteUrl + '/' + imgPath] : [`/${product.img}`],
    description: product.blurb,
    sku: product.id,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'GBP',
      price: String(product.price),
      availability: sold ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: siteUrl
        ? `${siteUrl}/product?id=${encodeURIComponent(product.id)}`
        : `/product?id=${encodeURIComponent(product.id)}`,
    },
  };
}

export default async function ProductPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const product = KA_CORE.findProduct(idFrom(sp));

  return (
    <div className="page" id="productRoot">
      {product && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFor(product)).replace(/</g, '\\u003c') }}
        />
      )}
      <Suspense fallback={<Loading />}>
        <ProductClient />
      </Suspense>
    </div>
  );
}
