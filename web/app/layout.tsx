import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers, ModalHost, ToastHost } from './providers';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { KA_CONFIG } from '@/lib/config';

/* KHARIS & ALETHEIA — root layout (CONTRACT-NEXT.md "Providers + shared
   components"). <html lang="en">, <head> fonts + inline theme-bootstrap script +
   favicon/meta, <Providers> wrapping skip-link + <Nav/> + <main id="main"> +
   <Footer/> + <CartDrawer/> + <ToastHost/> + <ModalHost/>. Per-page metadata is
   layered on top via each route's own `metadata`/`generateMetadata` export. */

const SITE_NAME = 'KHARIS & ALETHEIA';
const DEFAULT_TITLE = 'KHARIS & ALETHEIA — African Print Tees, Made to Order';
const DEFAULT_DESCRIPTION =
  'Kharis & Aletheia — African-print tees and accessories, cut to order. Pick a print, place it your way, and we sew it, just for you.';

export const metadata: Metadata = {
  metadataBase: new URL(KA_CONFIG.siteUrl),
  title: { default: DEFAULT_TITLE, template: '%s — ' + SITE_NAME },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/site.webmanifest',
  icons: {
    icon: '/assets/icon.png',
    apple: '/assets/icon-192.png',
  },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ['/assets/og-cover.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ['/assets/og-cover.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070308' },
    { media: '(prefers-color-scheme: light)', color: '#f6efe2' },
  ],
};

/* Sets `data-theme` on <html> BEFORE hydration, mirroring the old bootstrap inline
   script exactly (../*.html's `<script>document.documentElement.setAttribute(...)
   </script>`) — this is what prevents a flash of the wrong theme. It runs as a
   plain, build-time-static script tag, not React render code, so it is exempt from
   (and is in fact *how the site satisfies*) the "no localStorage during render"
   HYDRATION rule: app/providers.tsx's ThemeProvider only ever reads the attribute
   this script already set, inside a useEffect, after mount. */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('ka_theme');document.documentElement.setAttribute('data-theme',(t==='light'||t==='dark')?t:'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tiny5&family=Orbitron:wght@500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <Providers>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
          <ToastHost />
          <ModalHost />
        </Providers>
      </body>
    </html>
  );
}
