'use client';

/* KHARIS & ALETHEIA — checkout form. Ported from ../checkout.js (cart review with
   editable qty/remove, contact, delivery hidden for gift-only carts, shipping
   options recomputed on country/cart/promo, promo apply/remove, totals, inline
   validation + first-error focus + aria-invalid/aria-describedby, made-to-order
   ack checkbox, draft to sessionStorage, empty-cart state, request/paystack payment
   adapters). Owns: app/checkout/** app/order/** — see CONTRACT-NEXT.md "commerce"
   row. Declarative React controlled-form instead of the original's imperative DOM
   rebuild — same fields, same validation rules, same behaviour. */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart, useForms, useToast } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import { Button } from '@/components/Button';
import { Money } from '@/components/Money';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/FormControls';
import { cn } from '@/lib/cn';
import { COUNTRIES } from './countries';
import { persistOrder, type StoredOrder } from './orderStorage';

export const DRAFT_KEY = 'ka_checkout_draft';

/* ---------- form field config (DOM order = focus order on submit) ---------- */
type FieldId = 'coEmail' | 'coPhone' | 'coName' | 'coAddr1' | 'coCity' | 'coPostcode' | 'coAck';

interface FieldCfg {
  id: FieldId;
  group?: 'delivery';
  required: boolean;
  type?: 'checkbox';
  validate?: (v: string, country: string) => boolean;
  msg: string;
}

const FIELDS: FieldCfg[] = [
  { id: 'coEmail', required: true, validate: (v) => KA_CORE.validate.email(v), msg: 'Enter a valid email address.' },
  { id: 'coPhone', required: false, validate: (v) => KA_CORE.validate.phone(v), msg: 'Enter a valid phone number, or leave it blank.' },
  { id: 'coName', group: 'delivery', required: true, msg: 'Enter the full name for delivery.' },
  { id: 'coAddr1', group: 'delivery', required: true, msg: 'Enter your street address.' },
  { id: 'coCity', group: 'delivery', required: true, msg: 'Enter your city or town.' },
  {
    id: 'coPostcode',
    group: 'delivery',
    required: true,
    validate: (v, country) => KA_CORE.validate.postcode(v, country),
    msg: 'Enter a valid postcode for the selected country.',
  },
  { id: 'coAck', required: true, type: 'checkbox', msg: 'Please confirm you understand pieces are made to order.' },
];
const FIELDS_BY_ID: Record<FieldId, FieldCfg> = FIELDS.reduce((acc, f) => {
  acc[f.id] = f;
  return acc;
}, {} as Record<FieldId, FieldCfg>);

interface FormState {
  email: string;
  phone: string;
  marketing: boolean;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  notes: string;
  giftNote: string;
  ack: boolean;
}

const DEFAULT_FORM: FormState = {
  email: '',
  phone: '',
  marketing: false,
  fullName: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postcode: '',
  country: 'GB',
  notes: '',
  giftNote: '',
  ack: false,
};

const FIELD_KEY: Partial<Record<FieldId, keyof FormState>> = {
  coEmail: 'email',
  coPhone: 'phone',
  coName: 'fullName',
  coAddr1: 'address1',
  coCity: 'city',
  coPostcode: 'postcode',
};

function fieldRawValue(id: FieldId, form: FormState): string {
  const key = FIELD_KEY[id];
  return key ? String(form[key] ?? '') : '';
}

function fieldOk(cfg: FieldCfg, form: FormState, country: string): boolean {
  if (cfg.type === 'checkbox') return !cfg.required || form.ack === true;
  const value = fieldRawValue(cfg.id, form).trim();
  let ok = true;
  if (cfg.required) ok = KA_CORE.validate.required(value);
  if (ok && value && cfg.validate) ok = cfg.validate(value, country);
  return ok;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isGiftOnly(items: any[]): boolean {
  return items.length > 0 && items.every((i) => i.kind === 'gift');
}

function labelFor(list: any[] | undefined, id: string | undefined): string {
  if (!id) return '';
  const found = Array.isArray(list) ? list.find((x) => x.id === id) : null;
  if (found && found.name) return found.name;
  return String(id)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Ported verbatim from ../app.js's safeImgSrc (also duplicated in CartDrawer.tsx) —
 *  a custom item's `thumb` is an untrusted SVG data-URI round-tripped through
 *  localStorage; validate it as a resource reference, never escape-as-text. */
function safeImgSrc(src: any, fallback: string): string {
  if (typeof src !== 'string' || !src) return fallback;
  if (/["'<>]/.test(src)) return fallback;
  if (/^data:image\//.test(src) || /^(assets\/|\/assets\/|https:\/\/|\.\/|\.\.\/)/.test(src)) return src;
  return fallback;
}

const GIFT_SVG = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="9" width="18" height="11" />
    <path d="M3 9h18" />
    <path d="M12 9v11" />
    <path d="M12 9c-1.4-4-6-5-6-2 0 2 2.4 2 6 2Z" />
    <path d="M12 9c1.4-4 6-5 6-2 0 2-2.4 2-6 2Z" />
  </svg>
);
const CHEV_SVG = (
  <svg className="co-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/* -------- Paystack Inline JS v2 adapter (module-level so the loaded-script promise
   is shared/cached across mounts, matching ../checkout.js's loadPaystackScript) --------
   const pop = new PaystackPop(); pop.newTransaction({ key, email, amount (minor
   units), currency, reference, metadata, onSuccess(transaction), onCancel(),
   onError({message}) }). Script: https://js.paystack.co/v2/inline.js */
let paystackScriptPromise: Promise<void> | null = null;
function loadPaystackScript(): Promise<void> {
  if ((window as any).PaystackPop) return Promise.resolve();
  if (paystackScriptPromise) return paystackScriptPromise;
  paystackScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v2/inline.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the Paystack script.'));
    document.head.appendChild(s);
  });
  return paystackScriptPromise;
}

function resolvedProvider(): 'paystack' | 'request' {
  const pay = KA_CONFIG.payment || ({} as any);
  if (pay.provider === 'paystack' && pay.paystackPublicKey) return 'paystack';
  return 'request';
}

export function CheckoutForm() {
  const cart = useCart();
  const { items, update, remove, clear: clearCart } = cart;
  const { submit: formsSubmit } = useForms();
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldId, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [liveMsg, setLiveMsg] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(true);

  const fieldRefs = useRef<Partial<Record<FieldId, HTMLElement | null>>>({});
  const skipFirstPersist = useRef(true);

  const provider = useMemo(() => resolvedProvider(), []);
  const giftOnly = useMemo(() => isGiftOnly(items as any[]), [items]);

  /* ---------- load draft (sessionStorage — never card data) after mount ---------- */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) : {};
      setForm((prev) => ({
        ...prev,
        email: draft.email || '',
        phone: draft.phone || '',
        marketing: !!draft.marketing,
        fullName: draft.fullName || '',
        address1: draft.address1 || '',
        address2: draft.address2 || '',
        city: draft.city || '',
        region: draft.region || '',
        postcode: draft.postcode || '',
        country: draft.country || 'GB',
        notes: draft.notes || '',
        giftNote: draft.giftNote || '',
      }));
      if (draft.shippingMethodId) setShippingMethodId(draft.shippingMethodId);
      if (draft.promoCode) setPromoCode(draft.promoCode);
    } catch {
      /* ignore — draft simply won't load */
    }
  }, []);

  /* ---------- persist draft on change (skip the initial mount render) ---------- */
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    const draft = {
      email: form.email,
      phone: form.phone,
      marketing: form.marketing,
      fullName: form.fullName,
      address1: form.address1,
      address2: form.address2,
      city: form.city,
      region: form.region,
      postcode: form.postcode,
      country: form.country,
      shippingMethodId,
      promoCode,
      notes: form.notes,
      giftNote: form.giftNote,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable — draft simply won't persist */
    }
  }, [form, shippingMethodId, promoCode]);

  /* ---------- shipping/promo math — mirrors ../checkout.js's shippingBasis()/
     merchSubtotal(): KA_CORE.totals() prices promos and the free-shipping threshold
     against the merchandise-only subtotal, gift cards never discount/ship physically ---------- */
  const merchSubtotal = useMemo(
    () => KA_CORE.subtotal((items as any[]).filter((i) => (i.kind || 'product') !== 'gift')),
    [items]
  );
  const shippingBasis = useMemo(() => {
    if (!promoCode) return merchSubtotal;
    const res = KA_CORE.applyPromo(promoCode, merchSubtotal);
    const discount = res && res.ok ? Math.min(res.discount, merchSubtotal) : 0;
    return Math.max(0, merchSubtotal - discount);
  }, [promoCode, merchSubtotal]);
  const shippingOptions = useMemo(
    () => KA_CORE.shippingOptions(form.country, shippingBasis, giftOnly) || [],
    [form.country, shippingBasis, giftOnly]
  );

  /* keep the selected shipping method valid as the option list changes */
  useEffect(() => {
    const stillValid = shippingOptions.some((o: any) => o.id === shippingMethodId);
    if (!stillValid) setShippingMethodId(shippingOptions.length ? shippingOptions[0].id : null);
  }, [shippingOptions, shippingMethodId]);

  const totals = useMemo(
    () =>
      KA_CORE.totals(items, {
        country: form.country,
        methodId: shippingMethodId || undefined,
        promoCode: promoCode || undefined,
      }),
    [items, form.country, shippingMethodId, promoCode]
  );

  /* a stale/removed promo code (e.g. carried over in a draft from before a config
     change) fails silently here rather than blocking checkout */
  useEffect(() => {
    if (promoCode && totals.promo && totals.promo.ok === false) {
      setPromoCode(null);
      setPromoError(totals.promo.error || 'That code no longer applies to this order.');
    }
  }, [totals.promo, promoCode]);

  const freeShipHint = useMemo(() => {
    if (giftOnly) return null;
    const zone = KA_CORE.zoneFor(form.country);
    const ukZone = (KA_CONFIG.shipping && KA_CONFIG.shipping.zones && KA_CONFIG.shipping.zones.UK) || null;
    if (zone !== 'UK' || !ukZone || !ukZone.freeOver) return null;
    const remaining = ukZone.freeOver - shippingBasis;
    return remaining > 0 ? (
      <>
        Add <b><Money value={remaining} /></b> more for free UK shipping.
      </>
    ) : (
      'You’ve unlocked free UK shipping.'
    );
  }, [giftOnly, form.country, shippingBasis]);

  /* ---------- mobile summary toggle: collapsed by default below the desktop
     breakpoint so the form isn't pushed down; stays collapsed across a resize
     that crosses the breakpoint without fighting a manual toggle within it ---------- */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 901) setSummaryOpen(false);
    let wasDesktop = window.innerWidth >= 901;
    const onResize = () => {
      const isDesktop = window.innerWidth >= 901;
      if (isDesktop === wasDesktop) return;
      wasDesktop = isDesktop;
      if (!isDesktop) setSummaryOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------- validation ---------- */
  const validateWithForm = useCallback(
    (id: FieldId, formSnapshot: FormState) => {
      const cfg = FIELDS_BY_ID[id];
      if (cfg.group === 'delivery' && giftOnly) {
        setErrors((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      const ok = fieldOk(cfg, formSnapshot, formSnapshot.country);
      setErrors((prev) => {
        const next = { ...prev };
        if (ok) delete next[id];
        else next[id] = cfg.msg;
        return next;
      });
    },
    [giftOnly]
  );

  const validateAll = useCallback((): FieldId | null => {
    let firstInvalid: FieldId | null = null;
    const nextErrors: Partial<Record<FieldId, string>> = {};
    for (const cfg of FIELDS) {
      if (cfg.group === 'delivery' && giftOnly) continue;
      const ok = fieldOk(cfg, form, form.country);
      if (!ok) {
        nextErrors[cfg.id] = cfg.msg;
        if (!firstInvalid) firstInvalid = cfg.id;
      }
    }
    setErrors(nextErrors);
    return firstInvalid;
  }, [form, giftOnly]);

  function makeTextFieldProps(id: FieldId, key: keyof FormState) {
    return {
      value: form[key] as string,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const next = { ...form, [key]: e.target.value } as FormState;
        setForm(next);
        if (errors[id]) validateWithForm(id, next);
      },
      onBlur: () => validateWithForm(id, form),
    };
  }

  function onCountryChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = { ...form, country: e.target.value };
    setForm(next);
    if (next.postcode.trim()) validateWithForm('coPostcode', next);
  }

  function onAckChange(e: ChangeEvent<HTMLInputElement>) {
    const next = { ...form, ack: e.target.checked };
    setForm(next);
    if (errors.coAck) validateWithForm('coAck', next);
  }

  /* ---------- promo apply/remove ---------- */
  function onPromoClick() {
    if (promoCode) {
      setPromoCode(null);
      setPromoInput('');
      setPromoError('');
      return;
    }
    const code = promoInput.trim();
    if (!code) {
      setPromoError('Enter a code to apply.');
      return;
    }
    const res = KA_CORE.applyPromo(code, merchSubtotal);
    if (res && res.ok) {
      setPromoCode(res.code || code);
      setPromoError('');
    } else {
      setPromoError((res && res.error) || 'That code isn’t valid.');
    }
  }

  /* ---------- order build/submit ---------- */
  function snapshotItem(item: any) {
    const kind = item.kind || 'product';
    const base = { kind, qty: item.qty, unitPrice: KA_CORE.unitPrice(item), lineTotal: KA_CORE.lineTotal(item) };
    if (kind === 'gift') {
      return { ...base, name: 'Digital gift card', amount: item.amount, to: item.to, from: item.from, email: item.email, message: item.message, sendOn: item.sendOn };
    }
    if (kind === 'custom') {
      return { ...base, name: item.name, garment: item.garment, colour: item.colour, size: item.size };
    }
    const p = KA_CORE.findProduct(item.id) || ({} as any);
    return { ...base, id: item.id, name: p.name, size: item.size };
  }

  function currentShippingOption(country: string, basis: number, methodId: string | null) {
    const options = KA_CORE.shippingOptions(country, basis, giftOnly) || [];
    return options.find((o: any) => o.id === methodId) || options[0] || null;
  }

  function buildOrder(): StoredOrder {
    const country = form.country;
    const totalsRes = KA_CORE.totals(items, { country, methodId: shippingMethodId || undefined, promoCode: promoCode || undefined });
    return {
      ref: KA_CORE.orderRef(),
      createdAt: new Date().toISOString(),
      items: (items as any[]).map(snapshotItem),
      contact: { email: form.email.trim(), phone: form.phone.trim(), marketing: form.marketing },
      address: giftOnly
        ? null
        : {
            fullName: form.fullName.trim(),
            address1: form.address1.trim(),
            address2: form.address2.trim(),
            city: form.city.trim(),
            region: form.region.trim(),
            postcode: form.postcode.trim(),
            country,
          },
      shipping: currentShippingOption(country, shippingBasis, shippingMethodId),
      promo: totalsRes.promo || null,
      totals: { subtotal: totalsRes.subtotal, discount: totalsRes.discount, shipping: totalsRes.shipping, total: totalsRes.total },
      notes: { order: form.notes.trim(), gift: form.giftNote.trim() },
      status: 'requested',
    };
  }

  function finishOrder(ref: string) {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    clearCart();
    router.push('/order?ref=' + encodeURIComponent(ref));
  }

  function runRequestFlow(order: StoredOrder) {
    order.status = 'requested';
    persistOrder(order);
    Promise.resolve()
      .then(() => formsSubmit('order', order))
      .catch((err) => {
        console.error('kaForms.submit failed', err);
        return { ok: false, via: 'local' as const };
      })
      .then((res) => {
        order.deliveryVia = (res && res.via) || 'local';
        persistOrder(order);
        setLiveMsg('Order request placed.');
        finishOrder(order.ref);
      });
  }

  function runPaystack(order: StoredOrder) {
    const pay = KA_CONFIG.payment;
    const amountMinor = Math.round(order.totals.total * 100); // GBP → pence
    loadPaystackScript()
      .then(() => {
        const pop = new (window as any).PaystackPop();
        pop.newTransaction({
          key: pay.paystackPublicKey,
          email: order.contact.email,
          amount: amountMinor,
          currency: KA_CONFIG.currency || 'GBP',
          reference: order.ref,
          metadata: { order_ref: order.ref, item_count: KA_CORE.itemCount(items) },
          onSuccess: (transaction: any) => {
            order.status = 'paid';
            order.paystackReference = (transaction && transaction.reference) || order.ref;
            persistOrder(order);
            Promise.resolve()
              .then(() => formsSubmit('order', order))
              .catch((err) => {
                console.error('kaForms.submit failed', err);
                return { ok: false, via: 'local' as const };
              })
              .then((res) => {
                order.deliveryVia = (res && res.via) || 'local';
                persistOrder(order);
                setLiveMsg('Payment received.');
                finishOrder(order.ref);
              });
          },
          onCancel: () => {
            setSubmitting(false);
            setLiveMsg('Payment cancelled.');
            toast('Payment cancelled — your cart is still here.', 'err');
          },
          onError: (err: any) => {
            setSubmitting(false);
            const msg = (err && err.message) || 'please try again.';
            setLiveMsg('Payment error.');
            toast('Payment error: ' + msg, 'err');
          },
        });
      })
      .catch(() => {
        setSubmitting(false);
        toast('Could not load the payment popup. Please try again.', 'err');
      });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!items.length) return;
    const firstInvalid = validateAll();
    if (firstInvalid) {
      const el = fieldRefs.current[firstInvalid];
      el?.focus();
      try {
        el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      } catch {
        /* older browsers */
      }
      return;
    }
    setSubmitting(true);
    setLiveMsg('Placing your order, please wait.');
    const order = buildOrder();
    if (provider === 'paystack') runPaystack(order);
    else runRequestFlow(order);
  }

  /* ---------- empty cart ---------- */
  if (!items.length) {
    return (
      <div className="co-empty panel reveal in">
        <div className="empty-state">
          <p className="es-title">Your cart is empty</p>
          <p className="es-copy">Every piece is cut and sewn to order — find something worth the wait.</p>
          <Button variant="solid" href="/shop">
            Continue shopping →
          </Button>
        </div>
      </div>
    );
  }

  const idleLabel = provider === 'paystack' ? 'Pay & place order' : 'Place order request';

  return (
    <>
      <form id="checkoutForm" className="co-layout" noValidate onSubmit={onSubmit}>
        <div className="co-form">
          <div className="co-block">
            <h2 className="co-h2">
              <span className="co-step-n">01</span> Contact
            </h2>
            <Field id="coEmail" label="Email" error={errors.coEmail}>
              <Input
                ref={(el) => {
                  fieldRefs.current.coEmail = el;
                }}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                {...makeTextFieldProps('coEmail', 'email')}
              />
            </Field>
            <Field id="coPhone" label="Phone (optional)" error={errors.coPhone}>
              <Input
                ref={(el) => {
                  fieldRefs.current.coPhone = el;
                }}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                {...makeTextFieldProps('coPhone', 'phone')}
              />
            </Field>
            <Checkbox
              name="marketing"
              checked={form.marketing}
              onChange={(e) => setForm((f) => ({ ...f, marketing: e.target.checked }))}
              label="Email me about new drops and restocks. No spam, unsubscribe any time."
            />
          </div>

          {!giftOnly && (
            <div className="co-block" id="coDeliverySection">
              <h2 className="co-h2">
                <span className="co-step-n">02</span> Delivery
              </h2>
              <Field id="coName" label="Full name" error={errors.coName}>
                <Input
                  ref={(el) => {
                    fieldRefs.current.coName = el;
                  }}
                  name="fullName"
                  type="text"
                  autoComplete="shipping name"
                  required
                  {...makeTextFieldProps('coName', 'fullName')}
                />
              </Field>
              <Field id="coAddr1" label="Address line 1" error={errors.coAddr1}>
                <Input
                  ref={(el) => {
                    fieldRefs.current.coAddr1 = el;
                  }}
                  name="address1"
                  type="text"
                  autoComplete="shipping address-line1"
                  required
                  {...makeTextFieldProps('coAddr1', 'address1')}
                />
              </Field>
              <Field id="coAddr2" label="Address line 2 (optional)">
                <Input
                  name="address2"
                  type="text"
                  autoComplete="shipping address-line2"
                  value={form.address2}
                  onChange={(e) => setForm((f) => ({ ...f, address2: e.target.value }))}
                />
              </Field>
              <div className="field-row">
                <Field id="coCity" label="City / town" error={errors.coCity}>
                  <Input
                    ref={(el) => {
                      fieldRefs.current.coCity = el;
                    }}
                    name="city"
                    type="text"
                    autoComplete="shipping address-level2"
                    required
                    {...makeTextFieldProps('coCity', 'city')}
                  />
                </Field>
                <Field id="coRegion" label="County / region (optional)">
                  <Input
                    name="region"
                    type="text"
                    autoComplete="shipping address-level1"
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field id="coPostcode" label="Postcode" error={errors.coPostcode}>
                  <Input
                    ref={(el) => {
                      fieldRefs.current.coPostcode = el;
                    }}
                    name="postcode"
                    type="text"
                    autoComplete="shipping postal-code"
                    required
                    {...makeTextFieldProps('coPostcode', 'postcode')}
                  />
                </Field>
                <Field id="coCountry" label="Country">
                  <Select name="country" autoComplete="shipping country" value={form.country} onChange={onCountryChange}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          <div className="co-block">
            <h2 className="co-h2">
              <span className="co-step-n">03</span> Shipping method
            </h2>
            {freeShipHint && <p id="coFreeShipHint">{freeShipHint}</p>}
            <div id="coShippingOptions" role="radiogroup" aria-label="Shipping method">
              {!shippingOptions.length ? (
                <p className="co-empty-note">No shipping options are available for this destination yet — contact us and we’ll sort it out.</p>
              ) : (
                shippingOptions.map((o: any) => (
                  <label className="co-ship-opt" key={o.id}>
                    <input
                      type="radio"
                      name="coShipMethod"
                      value={o.id}
                      checked={o.id === shippingMethodId}
                      onChange={() => setShippingMethodId(o.id)}
                    />
                    <span className="co-ship-info">
                      <span className="co-ship-label">{o.label}</span>
                      {o.days && <span className="co-ship-days">{o.days} working days</span>}
                    </span>
                    <span className="co-ship-price">{o.price === 0 ? 'FREE' : <Money value={o.price} />}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="co-block">
            <h2 className="co-h2">
              <span className="co-step-n">04</span> Notes
            </h2>
            <Field id="coNotes" label="Order notes (optional)">
              <Textarea
                name="notes"
                placeholder="Delivery instructions, or anything we should know"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
            <Field id="coGiftNote" label="Gift note (optional)">
              <Textarea
                name="giftNote"
                placeholder="Add a note if this order is a gift"
                value={form.giftNote}
                onChange={(e) => setForm((f) => ({ ...f, giftNote: e.target.value }))}
              />
            </Field>
          </div>

          <div className="co-block">
            <h2 className="co-h2">
              <span className="co-step-n">05</span> Payment
            </h2>
            {provider === 'paystack' ? (
              <div className="panel co-payment-info">
                <p>
                  <strong>Pay securely now with Paystack.</strong> Card details are entered in Paystack&rsquo;s own secure popup and never touch our server.
                </p>
                <p>Once payment clears we&rsquo;ll confirm your order and your cloth is cut within 24 hours.</p>
              </div>
            ) : (
              <div className="panel co-payment-info">
                <p>
                  <strong>No payment is taken today.</strong> We&rsquo;ll email a secure payment link once we&rsquo;ve reviewed your order.
                </p>
                <p>Nothing is charged, and your cloth isn&rsquo;t cut, until that payment link is settled.</p>
              </div>
            )}
            <Checkbox
              ref={(el) => {
                fieldRefs.current.coAck = el;
              }}
              name="ack"
              checked={form.ack}
              onChange={onAckChange}
              className={cn(errors.coAck && 'is-invalid')}
              aria-invalid={errors.coAck ? true : undefined}
              aria-describedby={errors.coAck ? 'coAck-error' : undefined}
              label={
                <>
                  I understand every piece is cut and sewn after I order, per the{' '}
                  <Link href="/policies" target="_blank" rel="noopener">
                    Refund Policy &amp; Terms
                  </Link>
                  .
                </>
              }
            />
            <p className="field-error" id="coAck-error" role="alert">
              {errors.coAck || ''}
            </p>
            <div className="co-submit-row">
              <Button variant="solid" type="submit" disabled={submitting}>
                {submitting ? 'Placing your order…' : idleLabel}
              </Button>
            </div>
          </div>
        </div>

        <aside className={cn('co-summary', summaryOpen && 'open')} id="coSummary" aria-label="Order summary">
          <button
            type="button"
            className="co-summary-toggle"
            id="coSummaryToggle"
            aria-expanded={summaryOpen}
            aria-controls="coSummaryBody"
            onClick={() => setSummaryOpen((v) => !v)}
          >
            <span>Order summary</span>
            <span className="co-summary-toggle-total">
              <Money value={totals.total} />
            </span>
            {CHEV_SVG}
          </button>
          <div className="co-summary-body" id="coSummaryBody">
            <div id="coItems">
              {(items as any[]).map((item, idx) => (
                <ItemRow key={idx} item={item} idx={idx} onInc={() => update(idx, (item.qty || 1) + 1)} onDec={() => (item.qty <= 1 ? remove(idx) : update(idx, item.qty - 1))} onRemove={() => remove(idx)} />
              ))}
            </div>

            <div className="co-promo">
              <label htmlFor="coPromoCode">Promo code</label>
              <div className="co-promo-row">
                <Input
                  id="coPromoCode"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Enter code"
                  value={promoInput}
                  disabled={!!promoCode}
                  onChange={(e) => setPromoInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter here should apply the code, not submit the whole order —
                    // both share one <form>, which would otherwise submit it.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onPromoClick();
                    }
                  }}
                />
                <Button variant="gold" type="button" onClick={onPromoClick}>
                  {promoCode ? 'Remove' : 'Apply'}
                </Button>
              </div>
              <p className="field-error" id="coPromoError" role="alert">
                {promoError}
              </p>
              {promoCode && (
                <p className="co-promo-applied" id="coPromoApplied">
                  ✓ <b>{(totals.promo && totals.promo.label) || promoCode}</b> applied — save <Money value={totals.discount} />
                </p>
              )}
            </div>

            <div className="totals" id="coTotals">
              <div className="price-row">
                <span>Subtotal</span>
                <b>
                  <Money value={totals.subtotal} />
                </b>
              </div>
              {totals.discount > 0 && (
                <div className="price-row" id="coDiscountRow">
                  <span>Discount</span>
                  <b>
                    −<Money value={totals.discount} />
                  </b>
                </div>
              )}
              <div className="price-row">
                <span>Shipping</span>
                <b>{totals.shipping === 0 ? 'FREE' : <Money value={totals.shipping} />}</b>
              </div>
              <div className="price-row grand">
                <span>Total</span>
                <b>
                  <Money value={totals.total} />
                </b>
              </div>
            </div>
            <p className="cart-note">Made to order · ships in {KA_CONFIG.leadTime || '7–10 days'}</p>
          </div>
        </aside>
      </form>
      <div className="sr-only" id="coStatusLive" role="status" aria-live="polite">
        {liveMsg}
      </div>
    </>
  );
}

/* ---------- one cart line in the order summary ---------- */
function ItemRow({ item, idx, onInc, onDec, onRemove }: { item: any; idx: number; onInc: () => void; onDec: () => void; onRemove: () => void }) {
  const kind = item.kind || 'product';
  let name: ReactNode;
  let meta: ReactNode;
  let thumb: ReactNode;

  if (kind === 'gift') {
    const parts: string[] = [];
    if (item.to) parts.push('To ' + item.to);
    if (item.from) parts.push('From ' + item.from);
    if (item.sendOn) parts.push('Sent ' + item.sendOn);
    name = 'Digital gift card';
    meta = parts.join(' · ');
    thumb = <span className="ci-thumb-gift">{GIFT_SVG}</span>;
  } else if (kind === 'custom') {
    const cfgStudio = KA_CONFIG.studio || ({} as any);
    const garment = labelFor(cfgStudio.garments, item.garment);
    const colour = labelFor(cfgStudio.colours, item.colour);
    name = item.name || 'Custom piece';
    meta = [garment, colour, item.size ? 'Size ' + item.size : ''].filter(Boolean).join(' · ');
    const src = safeImgSrc(item.thumb, '');
    thumb = src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img decoding="async" src={src} alt="" loading="lazy" />
    ) : (
      <span className="ci-thumb-gift">{GIFT_SVG}</span>
    );
  } else {
    const p = KA_CORE.findProduct(item.id) || ({} as any);
    name = p.name || 'Item';
    meta = item.size ? 'Size ' + item.size : '';
    // eslint-disable-next-line @next/next/no-img-element
    thumb = <img decoding="async" src={p.img ? `/${p.img}` : ''} alt="" loading="lazy" />;
  }

  const qty = item.qty || 1;
  const unit = KA_CORE.unitPrice(item);
  const line = KA_CORE.lineTotal(item);

  return (
    <div className="cart-item" data-idx={idx}>
      {thumb}
      <div className="ci-info">
        <p className="ci-name">{name}</p>
        {meta && <p className="ci-meta">{meta}</p>}
        <p className="ci-price">
          <Money value={unit} /> × {qty} = <Money value={line} />
        </p>
        <div className="ci-qty">
          <button type="button" className="ci-dec" aria-label="Decrease quantity" onClick={onDec}>
            −
          </button>
          <span>{qty}</span>
          <button type="button" className="ci-inc" aria-label="Increase quantity" onClick={onInc}>
            +
          </button>
        </div>
        <button className="ci-remove" type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
