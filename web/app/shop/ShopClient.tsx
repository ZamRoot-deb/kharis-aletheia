'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWishlist } from '@/app/providers';
import { KA_CAT_LABEL, KA_COLLECTIONS, KA_MAKERS, KA_PRODUCTS } from '@/lib/products';
import type { Product } from '@/lib/types';
import { Button } from '@/components/Button';
import { PageHero } from '@/components/PageHero';
import { ShopGridCard } from './_components/ShopGridCard';

/* KHARIS & ALETHEIA — /shop. Ported from ../shop.html + ../shop.js: search, sort,
   category pills (#tees-style hash AND ?cat=), collection filter (?collection=),
   price range, show-sold toggle, ?wish=1 view, live aria-live count, empty state,
   clear filters, wishlist hearts, quick-add size picker, gift/studio promo tiles.

   State is derived straight from the URL (useSearchParams) rather than kept in a
   parallel useState, so it can never drift from what's in the address bar and picks
   up in-app navigations (Nav's wishlist/collection links) for free. The one piece
   the URL can't give us on the server is the `#tees`-style HASH (never sent in an
   HTTP request), so that's read client-side only, after mount / on hashchange, per
   the HYDRATION rule — see hashCatOverride below. */

const CATS = ['tees', 'sweatshirts', 'accessories'] as const;
type Cat = (typeof CATS)[number] | 'all';
const SORTS = ['price-asc', 'price-desc', 'name'] as const;
type Sort = (typeof SORTS)[number] | 'featured';

interface ShopState {
  cat: Cat;
  collection: string;
  q: string;
  sort: Sort;
  min: number | null;
  max: number | null;
  sold: boolean;
  wish: boolean;
}

function parseState(sp: URLSearchParams): ShopState {
  const catRaw = sp.get('cat');
  const cat: Cat = catRaw && (CATS as readonly string[]).includes(catRaw) ? (catRaw as Cat) : 'all';
  const colRaw = sp.get('collection');
  const collection = colRaw && KA_COLLECTIONS.some((c) => c.slug === colRaw) ? colRaw : '';
  const q = (sp.get('q') || '').slice(0, 120);
  const sortRaw = sp.get('sort');
  const sort: Sort = sortRaw && (SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as Sort) : 'featured';
  const minP = parseFloat(sp.get('min') || '');
  const maxP = parseFloat(sp.get('max') || '');
  const min = Number.isFinite(minP) && minP >= 0 ? minP : null;
  const max = Number.isFinite(maxP) && maxP >= 0 ? maxP : null;
  const sold = sp.get('sold') === '1';
  const wish = sp.get('wish') === '1';
  return { cat, collection, q, sort, min, max, sold, wish };
}

function matchesSearch(p: Product, needle: string): boolean {
  const col = KA_COLLECTIONS.find((c) => c.slug === p.collection);
  const maker = KA_MAKERS.find((m) => m.slug === p.maker);
  const hay = [
    p.name,
    p.blurb,
    p.colour,
    (p.tags || []).join(' '),
    col ? col.name : '',
    col ? col.slug : '',
    maker ? maker.name : '',
    maker ? maker.slug : '',
    KA_CAT_LABEL[p.cat] || p.cat,
  ]
    .join(' ')
    .toLowerCase();
  return hay.indexOf(needle) !== -1;
}

/* Sold pieces stay hidden on the unfiltered "All pieces" view, but a user who has
   navigated into a collection (which may be entirely archived) or their wishlist
   (which may hold a sold one-of-one) should still see them. */
function showsSold(state: ShopState): boolean {
  return state.sold || state.wish || !!state.collection;
}

function filterSort(state: ShopState, wishHas: (id: string) => boolean): Product[] {
  let list = KA_PRODUCTS.slice();
  if (state.cat !== 'all') list = list.filter((p) => p.cat === state.cat);
  if (state.collection) list = list.filter((p) => p.collection === state.collection);
  if (!showsSold(state)) list = list.filter((p) => !p.sold);
  if (state.wish) list = list.filter((p) => wishHas(p.id));
  if (state.min !== null) list = list.filter((p) => p.price >= (state.min as number));
  if (state.max !== null) list = list.filter((p) => p.price <= (state.max as number));
  if (state.q) {
    const needle = state.q.toLowerCase();
    list = list.filter((p) => matchesSearch(p, needle));
  }
  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function emptyMessage(state: ShopState): string {
  if (state.wish) return 'Your wishlist is empty — tap the heart on any piece to save it here.';
  if (state.collection) {
    const colProducts = KA_PRODUCTS.filter((p) => p.collection === state.collection);
    if (colProducts.length && colProducts.every((p) => p.sold)) {
      return 'Every piece in this collection is sold — you’re looking at the archive.';
    }
  }
  if (state.q) return `No pieces match "${state.q}".`;
  return 'No pieces match those filters.';
}

const CAT_PILLS: { value: Cat; label: string }[] = [
  { value: 'all', label: 'All pieces' },
  { value: 'tees', label: 'Tees' },
  { value: 'sweatshirts', label: 'Sweatshirts' },
  { value: 'accessories', label: 'Accessories' },
];

export function ShopClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '/shop';
  const { has: wishHas } = useWishlist();

  /* one-time (then hashchange-tracked) correction for the `#tees`-style hash the
     server can never see — cleared the instant the user makes an explicit category
     choice (including "All pieces" again) so it never fights a real URL update */
  const [hashCatOverride, setHashCatOverride] = useState<Cat | null>(null);

  useEffect(() => {
    function syncFromHash() {
      if (searchParams.get('cat')) return;
      const hash = window.location.hash.replace('#', '');
      if ((CATS as readonly string[]).includes(hash)) setHashCatOverride(hash as Cat);
    }
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [searchParams]);

  const state = useMemo<ShopState>(() => {
    const parsed = parseState(searchParams);
    if (parsed.cat === 'all' && !searchParams.get('cat') && hashCatOverride) {
      return { ...parsed, cat: hashCatOverride };
    }
    return parsed;
  }, [searchParams, hashCatOverride]);

  /* always-current snapshot for debounced handlers below, so a fast keystroke
     never clobbers a filter change that landed while its timer was pending */
  const stateRef = useRef(state);
  stateRef.current = state;

  function writeUrl(next: ShopState) {
    const qp = new URLSearchParams();
    if (next.cat !== 'all') qp.set('cat', next.cat);
    if (next.collection) qp.set('collection', next.collection);
    if (next.q) qp.set('q', next.q);
    if (next.sort !== 'featured') qp.set('sort', next.sort);
    if (next.min !== null) qp.set('min', String(next.min));
    if (next.max !== null) qp.set('max', String(next.max));
    if (next.sold) qp.set('sold', '1');
    if (next.wish) qp.set('wish', '1');
    const qs = qp.toString();
    router.replace(pathname + (qs ? '?' + qs : ''), { scroll: false });
  }

  const list = useMemo(() => filterSort(state, wishHas), [state, wishHas]);
  const totalInScope = useMemo(
    () => KA_PRODUCTS.filter((p) => (showsSold(state) ? true : !p.sold)).length,
    [state]
  );
  const collection = useMemo(() => KA_COLLECTIONS.find((c) => c.slug === state.collection), [state.collection]);

  /* ---------- toolbar: debounced search + price, immediate everything else ---------- */

  const [searchInput, setSearchInput] = useState(state.q);
  const [minInput, setMinInput] = useState(state.min === null ? '' : String(state.min));
  const [maxInput, setMaxInput] = useState(state.max === null ? '' : String(state.max));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* keep the (uncontrolled-feeling) text fields in sync when the committed state
     changes from elsewhere — a Nav link, browser back/forward, clear filters */
  useEffect(() => setSearchInput(state.q), [state.q]);
  useEffect(() => setMinInput(state.min === null ? '' : String(state.min)), [state.min]);
  useEffect(() => setMaxInput(state.max === null ? '' : String(state.max)), [state.max]);

  function onSearchChange(v: string) {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      writeUrl({ ...stateRef.current, q: v.trim().slice(0, 120) });
    }, 220);
  }

  function onMinChange(v: string) {
    setMinInput(v);
    if (minTimer.current) clearTimeout(minTimer.current);
    minTimer.current = setTimeout(() => {
      const n = parseFloat(v);
      writeUrl({ ...stateRef.current, min: Number.isFinite(n) && n >= 0 ? n : null });
    }, 250);
  }

  function onMaxChange(v: string) {
    setMaxInput(v);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    maxTimer.current = setTimeout(() => {
      const n = parseFloat(v);
      writeUrl({ ...stateRef.current, max: Number.isFinite(n) && n >= 0 ? n : null });
    }, 250);
  }

  function onCatClick(cat: Cat) {
    setHashCatOverride(null);
    writeUrl({ ...state, cat });
  }

  function onSortChange(sort: Sort) {
    writeUrl({ ...state, sort });
  }

  function onSoldToggle(sold: boolean) {
    writeUrl({ ...state, sold });
  }

  function onWishToggle(wish: boolean) {
    writeUrl({ ...state, wish });
  }

  function clearCollection() {
    writeUrl({ ...state, collection: '' });
  }

  function clearFilters() {
    setHashCatOverride(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (minTimer.current) clearTimeout(minTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    writeUrl({ cat: 'all', collection: '', q: '', sort: 'featured', min: null, max: null, sold: false, wish: false });
    searchInputRef.current?.focus();
  }

  return (
    <div className="page">
      <PageHero
        eyebrow="Shop the print"
        title="THE COLLECTION"
        lede="Every piece is cut and sewn to order — pick your print, pick your size, and it's made for you. Nothing sits in a warehouse."
        image={{ src: '/assets/img/banner-tees.webp', alt: 'Rack of African print tees', width: 1600, height: 900 }}
      />

      <section className="shop-section">
        <div className="wrap">
          {collection && (
            <div className="collection-banner" id="collectionBanner">
              {collection.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  decoding="async"
                  loading="lazy"
                  id="collectionBannerImg"
                  src={`/${collection.img}`}
                  alt={collection.name}
                  className="collection-banner-img"
                />
              ) : null}
              <div className="collection-banner-copy">
                <p className="micro">{collection.tag || 'Collection'}</p>
                <h2 className="h-display h-md">{collection.name}</h2>
                <p>{collection.blurb || ''}</p>
                <button type="button" className="pill" onClick={clearCollection}>
                  Clear collection ✕
                </button>
              </div>
            </div>
          )}

          <div className="shop-toolbar">
            <div className="tb-field tb-search">
              <label htmlFor="shopSearch">Search</label>
              <input
                ref={searchInputRef}
                type="search"
                id="shopSearch"
                placeholder="Name, colour, print, maker…"
                autoComplete="off"
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <div className="tb-field tb-sort">
              <label htmlFor="shopSort">Sort</label>
              <select id="shopSort" value={state.sort} onChange={(e) => onSortChange(e.target.value as Sort)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            <fieldset className="tb-field tb-price">
              <legend>Price (£)</legend>
              <div className="tb-price-inputs">
                <label htmlFor="priceMin" className="visually-hidden">
                  Minimum price
                </label>
                <input
                  type="number"
                  id="priceMin"
                  min={0}
                  step={1}
                  placeholder="Min"
                  inputMode="numeric"
                  value={minInput}
                  onChange={(e) => onMinChange(e.target.value)}
                />
                <span aria-hidden="true" className="tb-price-sep">
                  –
                </span>
                <label htmlFor="priceMax" className="visually-hidden">
                  Maximum price
                </label>
                <input
                  type="number"
                  id="priceMax"
                  min={0}
                  step={1}
                  placeholder="Max"
                  inputMode="numeric"
                  value={maxInput}
                  onChange={(e) => onMaxChange(e.target.value)}
                />
              </div>
            </fieldset>
          </div>

          <div className="pill-row" id="shopPills">
            {CAT_PILLS.map((c) => (
              <button
                key={c.value}
                className={state.cat === c.value ? 'pill on' : 'pill'}
                type="button"
                aria-pressed={state.cat === c.value}
                onClick={() => onCatClick(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="pill-row" id="collections" aria-label="Browse by collection">
            {KA_COLLECTIONS.map((c) => (
              <Link key={c.slug} className="pill" href={`/shop?collection=${encodeURIComponent(c.slug)}#collections`}>
                {c.name}
              </Link>
            ))}
          </div>

          <div className="shop-controls-row">
            <label className="shop-toggle">
              <input type="checkbox" checked={state.sold} onChange={(e) => onSoldToggle(e.target.checked)} />
              <span>Show sold archive</span>
            </label>
            <label className="shop-toggle">
              <input type="checkbox" checked={state.wish} onChange={(e) => onWishToggle(e.target.checked)} />
              <span>Wishlist only</span>
            </label>
            <button type="button" className="tb-clear" onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <p className="shop-count" id="shopCount" role="status" aria-live="polite">
            Showing <b>{list.length}</b> of {totalInScope} piece{totalInScope === 1 ? '' : 's'}
            {state.q ? <> for “{state.q}”</> : null}
          </p>

          <div className="shop-grid" id="shopGrid">
            {list.map((p) => (
              <ShopGridCard key={p.id} product={p} />
            ))}
            <div className="shop-card promo-tile">
              <div className="promo-tile-inner">
                <p className="micro">Custom</p>
                <h3>Tee Studio</h3>
                <p>Pick a print, place it your way, choose your cut — cut to order.</p>
                <Button variant="gold" href="/studio">
                  Enter the studio →
                </Button>
              </div>
            </div>
            <div className="shop-card promo-tile">
              <div className="promo-tile-inner">
                <p className="micro">Gift</p>
                <h3>Gift cards</h3>
                <p>Give grace &amp; truth. Digital gift cards from £25.</p>
                <Button variant="gold" href="/gift">
                  Send a gift card →
                </Button>
              </div>
            </div>
          </div>

          {list.length === 0 && (
            <div className="shop-empty" id="shopEmpty">
              <p id="shopEmptyMsg">{emptyMessage(state)}</p>
              <Button variant="gold" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
