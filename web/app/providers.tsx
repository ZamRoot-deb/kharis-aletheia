'use client';

/* KHARIS & ALETHEIA — client providers (CONTRACT-NEXT.md "Providers + shared
   components"). One 'use client' boundary wrapping <html><body> in app/layout.tsx,
   exposing useCart / useWishlist / useTheme / useToast / useModal / useForms plus
   the <ToastHost>/<ModalHost> presentational hosts each context needs.

   HYDRATION: every piece of state that reads localStorage starts at a value that is
   IDENTICAL on the server and the first client render (empty cart, empty wishlist,
   theme = the inline <head> script's own fallback), then corrects itself from
   localStorage/the DOM inside a mount-only useEffect. Every persist-to-localStorage
   effect skips its own first (mount) run via a ref, so hydrating from storage never
   races with — and briefly overwrites — the just-read value with "[]". See
   CONTRACT-NEXT.md's HYDRATION rule and README notes on this file for callers. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import type { CartItem } from '@/lib/types';
import { lockScroll, trapTabKey, unlockScroll } from '@/components/dom-utils';

/* ============================================================
   CART — key `ka_cart`, ported from ../app.js's kaCart closure.
   ============================================================ */

const CART_KEY = 'ka_cart';

function kindOf(item: any): string {
  return item && item.kind ? item.kind : 'product';
}
function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface CartContextValue {
  items: CartItem[];
  add: (id: string, size?: string, qty?: number) => void;
  addItem: (item: Partial<CartItem> & { kind?: string; id?: string }) => void;
  update: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const skipFirstPersist = useRef(true);

  /* hydrate from localStorage after mount — never during render (HYDRATION rule) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      /* ignore — keep the empty cart */
    }
  }, []);

  /* persist on every change, but never on the initial mount render (that would
     stomp the value we're about to read above with "[]" before it lands) */
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable — cart still works for this tab session */
    }
  }, [items]);

  const addItem = useCallback((item: Partial<CartItem> & { kind?: string; id?: string }) => {
    const kind = item.kind || 'product';
    setItems((prev) => {
      const next = prev.slice();
      if (kind === 'product') {
        if (!item.id) return prev; // nothing to add without a product id
        const size = (item as any).size || 'M';
        const qtyToAdd = Math.max(1, parseInt(String((item as any).qty), 10) || 1);
        const existingIdx = next.findIndex(
          (i) => kindOf(i) === 'product' && (i as any).id === item.id && ((i as any).size || 'M') === size
        );
        if (existingIdx > -1) {
          const existing = next[existingIdx] as any;
          next[existingIdx] = { ...existing, qty: (Number(existing.qty) || 0) + qtyToAdd };
        } else {
          next.push({ kind: 'product', id: item.id, size, qty: qtyToAdd } as CartItem);
        }
      } else if (kind === 'gift') {
        next.push({ ...(item as any), kind: 'gift', uid: (item as any).uid || uid('g'), qty: 1 } as CartItem);
      } else if (kind === 'custom') {
        next.push({
          ...(item as any),
          kind: 'custom',
          uid: (item as any).uid || uid('c'),
          qty: Math.max(1, parseInt(String((item as any).qty), 10) || 1),
        } as CartItem);
      } else {
        next.push({ ...(item as any), qty: Math.max(1, parseInt(String((item as any).qty), 10) || 1) });
      }
      return next;
    });
    setIsOpen(true);
  }, []);

  const add = useCallback(
    (id: string, size = 'M', qty = 1) => {
      addItem({ kind: 'product', id, size, qty } as any);
    },
    [addItem]
  );

  const update = useCallback((index: number, qty: number) => {
    setItems((prev) => {
      const it = prev[index];
      if (!it) return prev;
      let q = Math.max(0, Math.floor(Number(qty)) || 0);
      if (kindOf(it) === 'gift') q = q > 0 ? 1 : 0;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      const next = prev.slice();
      next[index] = { ...(it as any), qty: q };
      return next;
    });
  }, []);

  const remove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const count = useMemo(() => KA_CORE.itemCount(items), [items]);
  const subtotal = useMemo(() => KA_CORE.subtotal(items), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, add, addItem, update, remove, clear, count, subtotal, open, close, isOpen }),
    [items, add, addItem, update, remove, clear, count, subtotal, open, close, isOpen]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart() must be used inside <Providers>');
  return ctx;
}

/* ============================================================
   WISHLIST — key `ka_wish`, ported from ../app.js's kaWishlist closure.
   ============================================================ */

const WISH_KEY = 'ka_wish';

interface WishlistContextValue {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const skipFirstPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISH_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) setIds(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(WISH_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids]);

  const toggle = useCallback((id: string) => {
    if (!id) return;
    setIds((prev) => (prev.indexOf(id) > -1 ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const has = useCallback((id: string) => ids.indexOf(id) > -1, [ids]);
  const count = ids.length;

  const value = useMemo<WishlistContextValue>(() => ({ ids, has, toggle, count }), [ids, has, toggle, count]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist() must be used inside <Providers>');
  return ctx;
}

/* ============================================================
   THEME — key `ka_theme`. The DOM attribute is set by an inline <head> script
   BEFORE hydration (app/layout.tsx) so there is no flash of the wrong theme; this
   provider only mirrors that attribute into React state, read in an effect (never
   during render), for components that need to know/toggle it (the nav's LIGHT/DARK
   label).
   ============================================================ */

const THEME_KEY = 'ka_theme';
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  /* Matches the inline head script's own fallback ('dark') so server render and the
     first client render agree; corrected from the real DOM attribute in the effect
     below right after mount. */
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') setTheme(attr);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() must be used inside <Providers>');
  return ctx;
}

/* ============================================================
   TOAST — ported from ../app.js's kaToast(msg, type).
   ============================================================ */

type ToastType = 'ok' | 'err';
interface ToastRecord {
  id: number;
  msg: string;
  type: ToastType;
  show: boolean;
}

interface ToastContextValue {
  toast: (msg: string, type?: ToastType) => void;
  toasts: ToastRecord[];
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let toastSeq = 0;

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: false } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 260);
  }, []);

  const toast = useCallback(
    (msg: string, type: ToastType = 'ok') => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, msg: String(msg == null ? '' : msg), type, show: false }]);
      /* one frame later, per the original's requestAnimationFrame, so the CSS
         opacity/transform transition actually runs instead of snapping in */
      requestAnimationFrame(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: true } : t)));
      });
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ toast, toasts, dismiss }), [toast, toasts, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): { toast: (msg: string, type?: ToastType) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <Providers>');
  return { toast: ctx.toast };
}

/** Internal — consumed by <ToastHost/> only. */
function useToastHostState() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('<ToastHost/> must be rendered inside <Providers>');
  return ctx;
}

/* ============================================================
   MODAL — ported from ../app.js's kaModal.open(node, {label}) / kaModal.close().
   ============================================================ */

interface ModalState {
  node: ReactNode;
  label?: string;
}

interface ModalContextValue {
  open: (node: ReactNode, opts?: { label?: string }) => void;
  close: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);
/** Internal — <ModalHost/> needs the current node too, so it gets its own context
 *  value instead of re-exporting the public one (which only exposes open/close). */
const ModalStateContext = createContext<ModalState | null>(null);

function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);

  const close = useCallback(() => setState(null), []);
  const open = useCallback((node: ReactNode, opts?: { label?: string }) => {
    setState({ node, label: opts?.label });
  }, []);

  const value = useMemo<ModalContextValue>(() => ({ open, close }), [open, close]);

  return (
    <ModalContext.Provider value={value}>
      <ModalStateContext.Provider value={state}>{children}</ModalStateContext.Provider>
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal() must be used inside <Providers>');
  return ctx;
}

function useModalHostState() {
  const state = useContext(ModalStateContext);
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('<ModalHost/> must be rendered inside <Providers>');
  return { state, close: ctx.close };
}

/* ============================================================
   FORMS — ported from ../app.js's kaForms.submit(kind, payload). Stateless (no
   shared context needed), always appends to localStorage `ka_submissions`, then
   POSTs to KA_CONFIG.formEndpoint if it's set and https, else falls back to a
   mailto: link — exactly like the original.
   ============================================================ */

function mailtoFallback(kind: string, payload: Record<string, any>): { ok: true; via: 'mailto' | 'local' } {
  const to = KA_CONFIG.contactEmail || '';
  if (!to) return { ok: true, via: 'local' };
  const subject = 'Kharis & Aletheia — ' + (kind || 'enquiry');
  const lines = Object.keys(payload || {}).map((k) => `${k}: ${payload[k]}`);
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  try {
    window.location.href = url;
  } catch {
    /* ignore */
  }
  return { ok: true, via: 'mailto' };
}

export function useForms(): { submit: (kind: string, payload: Record<string, any>) => Promise<{ ok: boolean; via: 'endpoint' | 'mailto' | 'local' }> } {
  const submit = useCallback(async (kind: string, payload: Record<string, any>) => {
    const record = { kind: kind || 'form', payload, ts: new Date().toISOString() };
    try {
      const key = 'ka_submissions';
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : null;
      const arr = Array.isArray(list) ? list : [];
      arr.push(record);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch {
      /* ignore */
    }

    const endpoint = KA_CONFIG.formEndpoint || '';
    if (endpoint && !/^https:\/\//i.test(endpoint)) return mailtoFallback(kind, payload);
    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
        return { ok: !!(res && res.ok), via: 'endpoint' as const };
      } catch {
        return mailtoFallback(kind, payload);
      }
    }
    return mailtoFallback(kind, payload);
  }, []);

  return { submit };
}

/* ============================================================
   HOSTS — presentational, consumed directly by app/layout.tsx.
   ============================================================ */

export function ToastHost() {
  const { toasts, dismiss } = useToastHostState();
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast${t.type === 'err' ? ' toast-err' : ''}${t.show ? ' show' : ''}`}
          onClick={() => dismiss(t.id)}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export function ModalHost() {
  const { state, close } = useModalHostState();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!state) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    lockScroll();
    const panel = panelRef.current;
    panel?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab' && panel) trapTabKey(panel, e);
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
      unlockScroll();
      if (lastFocused.current && typeof lastFocused.current.focus === 'function') {
        lastFocused.current.focus();
      }
    };
  }, [state, close]);

  if (!state) return null;

  return (
    <div className="modal-root">
      <div className="modal-overlay" onClick={close} />
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={state.label}
        tabIndex={-1}
      >
        <button type="button" className="modal-close" aria-label="Close dialog" onClick={close}>
          ×
        </button>
        <div className="modal-body">{state.node}</div>
      </div>
    </div>
  );
}

/* ============================================================
   PROVIDERS — the single client boundary app/layout.tsx wraps <body>'s contents in.
   ============================================================ */

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ModalProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
        </ModalProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
