'use client';

/* KHARIS & ALETHEIA — Crew & Bulk quote calculator + enquiry form.
   Ported from ../bulk.js (garment/qty/approach/size-breakdown live estimate via
   KA_CORE.bulkQuote, tier-table highlighting, split-evenly, enquiry via
   useForms.submit('bulk')). Controlled-React state replaces the original's direct
   DOM reads/writes; the maths and validation rules are unchanged. */

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { KA_CONFIG } from '@/lib/config';
import { KA_CORE } from '@/lib/core';
import { useForms, useToast } from '@/app/providers';
import { Field, Input, Select, Textarea } from '@/components/FormControls';
import { Reveal } from '@/components/Reveal';
import { Button } from '@/components/Button';

type Approach = 'house' | 'placement' | 'artwork';

interface BulkPayload {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  eventDate: string;
  garment: string;
  garmentName: string;
  quantity: number;
  approach: Approach;
  sizeBreakdown: Record<string, number>;
  message: string;
  estimate: { unit: number; total: number; saving: number };
}

const GARMENTS = KA_CONFIG.studio.garments;
const TIERS = KA_CONFIG.bulkTiers;
const SIZES = KA_CONFIG.studio.sizes;
const QTY_MIN = 10;
const QTY_MAX = 500;
const DEFAULT_QTY = 25;

function clampQty(v: number): number {
  if (!Number.isFinite(v)) v = QTY_MIN;
  return Math.max(QTY_MIN, Math.min(QTY_MAX, Math.round(v)));
}

function tierRangeLabel(i: number): string {
  const t = TIERS[i];
  const next = TIERS[i + 1];
  return next ? `${t.min}–${next.min - 1} pieces` : `${t.min}+ pieces`;
}

/* mirrors ../bulk.js's splitEvenly(qty): distribute remainder outward from the
   middle size so a run reads as a natural bell curve, not front-loaded on XS. */
function splitEvenly(qty: number): number[] {
  const n = SIZES.length;
  const mid = Math.floor(n / 2);
  const order: number[] = [mid];
  for (let step = 1; order.length < n; step++) {
    if (mid - step >= 0) order.push(mid - step);
    if (order.length < n && mid + step < n) order.push(mid + step);
  }
  const base = Math.floor(qty / n);
  const rem = qty - base * n;
  const alloc = SIZES.map(() => base);
  for (let k = 0; k < rem; k++) alloc[order[k % order.length]]++;
  return alloc;
}

function channelNote(via: string): string {
  if (via === 'endpoint') return 'Sent straight to our team — no further action needed from you.';
  if (via === 'mailto')
    return "Your email app should have opened with this enquiry pre-filled. Please hit send there to complete it — if nothing opened, use the direct email link below.";
  return "We've saved this enquiry on this device. If you don't hear back within two working days, please email us directly so we don't miss it.";
}

function buildMailtoFallback(subject: string, lines: string[]): string {
  return `mailto:${KA_CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

function summaryLines(payload: BulkPayload): string[] {
  const sb = Object.keys(payload.sizeBreakdown)
    .map((s) => `${s}: ${payload.sizeBreakdown[s]}`)
    .join(', ');
  return [
    `Name: ${payload.name}`,
    `Organisation: ${payload.organisation || '—'}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || '—'}`,
    `Event date: ${payload.eventDate || '—'}`,
    `Garment: ${payload.garmentName}`,
    `Quantity: ${payload.quantity}`,
    `Print approach: ${payload.approach}`,
    `Size breakdown: ${sb}`,
    `Estimated unit / total: ${KA_CORE.money(payload.estimate.unit)} / ${KA_CORE.money(payload.estimate.total)}`,
    `Message: ${payload.message || '—'}`,
  ];
}

export function BulkCalculator() {
  const forms = useForms();
  const { toast } = useToast();

  const [garmentId, setGarmentId] = useState(GARMENTS[0]?.id ?? '');
  const [qtyRaw, setQtyRaw] = useState(String(DEFAULT_QTY));
  const [approach, setApproach] = useState<Approach>('house');
  const [sizeCounts, setSizeCounts] = useState<number[]>(() => splitEvenly(DEFAULT_QTY));

  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');

  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [sbError, setSbError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ ok: boolean; via: string; payload: BulkPayload } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const firstSizeRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const garment = GARMENTS.find((g) => g.id === garmentId) ?? GARMENTS[0];
  const base = garment ? garment.base : 0;
  const qty = clampQty(parseInt(qtyRaw, 10));
  const quote = KA_CORE.bulkQuote(base, qty);
  const sbSum = sizeCounts.reduce((s, n) => s + n, 0);
  const sbOk = sbSum === qty;

  function onQtyRawChange(e: ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value;
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v > QTY_MAX) raw = String(QTY_MAX);
    setQtyRaw(raw);
  }
  function onQtyBlur() {
    setQtyRaw(String(clampQty(parseInt(qtyRaw, 10))));
  }
  function onQtyRangeChange(e: ChangeEvent<HTMLInputElement>) {
    setQtyRaw(String(clampQty(parseInt(e.target.value, 10))));
  }
  function stepQty(delta: number) {
    setQtyRaw(String(clampQty(qty + delta)));
  }
  function onSizeChange(idx: number, value: string) {
    const v = parseInt(value, 10);
    setSizeCounts((prev) => prev.map((n, i) => (i === idx ? (isNaN(v) ? 0 : v) : n)));
  }
  function onSplitEven() {
    setSizeCounts(splitEvenly(qty));
    toast('Split evenly across sizes', 'ok');
  }

  function validate(): { errs: typeof errors; sbBad: boolean } {
    const errs: typeof errors = {};
    if (!KA_CORE.validate.required(name)) errs.name = 'Tell us your name.';
    if (!KA_CORE.validate.email(email)) errs.email = 'Enter a valid email address.';
    if (phone && !KA_CORE.validate.phone(phone)) errs.phone = "That phone number doesn't look right.";
    const sbBad = !sbOk;
    setErrors(errs);
    setSbError(sbBad ? `Sizes must add up to your quantity (${qty}).` : '');
    return { errs, sbBad };
  }

  function focusFirstError(errs: typeof errors, sbBad: boolean) {
    if (errs.name) return nameRef.current?.focus();
    if (errs.email) return emailRef.current?.focus();
    if (errs.phone) return phoneRef.current?.focus();
    if (sbBad) firstSizeRef.current?.focus();
  }

  function resetForm() {
    setGarmentId(GARMENTS[0]?.id ?? '');
    setQtyRaw(String(DEFAULT_QTY));
    setApproach('house');
    setSizeCounts(SIZES.map(() => 0)); // matches ../bulk.js's form.reset() (sb inputs default to 0)
    setName('');
    setOrganisation('');
    setEmail('');
    setPhone('');
    setEventDate('');
    setMessage('');
    setHp('');
  }

  async function submitForm() {
    setResult(null);
    const { errs, sbBad } = validate();
    if (Object.keys(errs).length || sbBad) {
      setStatus('Please fix the highlighted fields.');
      focusFirstError(errs, sbBad);
      return;
    }

    const sizeBreakdown: Record<string, number> = {};
    SIZES.forEach((s, i) => {
      sizeBreakdown[s] = sizeCounts[i];
    });
    const payload: BulkPayload = {
      name: name.trim(),
      organisation: organisation.trim(),
      email: email.trim(),
      phone: phone.trim(),
      eventDate,
      garment: garmentId,
      garmentName: garment ? garment.name : '',
      quantity: qty,
      approach,
      sizeBreakdown,
      message: message.trim(),
      estimate: { unit: quote.unit, total: quote.total, saving: quote.saving },
    };

    if (hp) {
      // honeypot tripped: pretend success without ever submitting
      setResult({ ok: true, via: 'local', payload });
      resetForm();
      return;
    }

    setBusy(true);
    setStatus('Sending your enquiry…');
    try {
      const res = await forms.submit('bulk', payload);
      setBusy(false);
      setStatus('');
      if (res && res.ok) {
        setResult({ ok: true, via: res.via, payload });
        resetForm();
      } else {
        setResult({ ok: false, via: (res && res.via) || 'local', payload });
      }
    } catch {
      setBusy(false);
      setStatus('');
      setResult({ ok: false, via: 'local', payload });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submitForm();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Reveal className="calc-shell">
        {/* ---------- controls ---------- */}
        <div className="calc-card">
          <Field id="bkGarment" label="Garment">
            <Select value={garmentId} onChange={(e) => setGarmentId(e.target.value)}>
              {GARMENTS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — from {KA_CORE.money(g.base)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="pd-field">
            <label htmlFor="bkQtyInput">Quantity</label>
            <div className="qty-control">
              <div className="stepper">
                <button type="button" aria-label="Decrease quantity by one" onClick={() => stepQty(-1)}>
                  −
                </button>
                <input
                  type="number"
                  id="bkQtyInput"
                  min={QTY_MIN}
                  max={QTY_MAX}
                  step={1}
                  inputMode="numeric"
                  value={qtyRaw}
                  onChange={onQtyRawChange}
                  onBlur={onQtyBlur}
                />
                <button type="button" aria-label="Increase quantity by one" onClick={() => stepQty(1)}>
                  +
                </button>
              </div>
              <input
                type="range"
                className="qty-slider"
                min={QTY_MIN}
                max={QTY_MAX}
                step={1}
                value={qty}
                onChange={onQtyRangeChange}
                aria-label="Quantity, from 10 to 500 pieces"
              />
            </div>
          </div>

          <fieldset className="pd-field wide">
            <legend className="field-legend">Print approach</legend>
            <div className="choice-row">
              <div className="choice-card">
                <input
                  type="radio"
                  name="approach"
                  id="apHouse"
                  value="house"
                  checked={approach === 'house'}
                  onChange={() => setApproach('house')}
                />
                <label htmlFor="apHouse">
                  <span className="cc-name">House print</span>
                  <span className="cc-note">Pick from our kente, ankara &amp; adinkra prints. Fastest turnaround.</span>
                </label>
              </div>
              <div className="choice-card">
                <input
                  type="radio"
                  name="approach"
                  id="apPlacement"
                  value="placement"
                  checked={approach === 'placement'}
                  onChange={() => setApproach('placement')}
                />
                <label htmlFor="apPlacement">
                  <span className="cc-name">Custom placement</span>
                  <span className="cc-note">Your chosen print, positioned to spec. Small setup, confirmed in your quote.</span>
                </label>
              </div>
              <div className="choice-card">
                <input
                  type="radio"
                  name="approach"
                  id="apArtwork"
                  value="artwork"
                  checked={approach === 'artwork'}
                  onChange={() => setApproach('artwork')}
                />
                <label htmlFor="apArtwork">
                  <span className="cc-name">Your artwork</span>
                  <span className="cc-note">Send your own logo or design — we confirm feasibility before we cut.</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="pd-field wide" style={{ marginBottom: 0 }}>
            <legend className="field-legend">
              Size breakdown <span className="field-hint">must add up to your quantity</span>
            </legend>
            <div className="size-breakdown">
              {SIZES.map((s, i) => (
                <div className="sb-field" key={s}>
                  <label htmlFor={`sb-${s}`}>{s}</label>
                  <input
                    ref={i === 0 ? firstSizeRef : undefined}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    id={`sb-${s}`}
                    value={sizeCounts[i]}
                    onChange={(e) => onSizeChange(i, e.target.value)}
                    aria-label={`${s} quantity`}
                  />
                </div>
              ))}
            </div>
            <div className={cn('sb-total', !sbOk && 'err')}>
              <span>
                Allocated <b className="sb-count">{sbSum}</b> / <b id="bkSbTarget">{qty}</b>
              </span>
              <button type="button" className="link-arrow" onClick={onSplitEven}>
                Split evenly →
              </button>
            </div>
            <p className="field-err" role="alert">
              {sbError}
            </p>
          </fieldset>
        </div>

        {/* ---------- live summary ---------- */}
        <div className="calc-summary">
          <div className="calc-card">
            <p className="estimate-tag">Estimate · confirmed in your quote</p>
            <div className="size-table tier-table">
              <table>
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((t, i) => (
                    <tr key={t.min} className={quote.off === t.off ? 'on' : undefined}>
                      <th>{tierRangeLabel(i)}</th>
                      <td>{Math.round(t.off * 100)}% off</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="price-summary" role="status" aria-live="polite">
              <div className="price-row">
                <span>Unit price</span>
                <b>{KA_CORE.money(quote.unit)}</b>
              </div>
              <div className="price-row">
                <span>You save</span>
                <b>{quote.saving > 0 ? KA_CORE.money(quote.saving) : '—'}</b>
              </div>
              <div className="price-row total">
                <span>Estimated total</span>
                <b>{KA_CORE.money(quote.total)}</b>
              </div>
            </div>
            <p className="leadtime-note">
              Ships in <span>{KA_CONFIG.leadTime}</span> from confirmed order. Larger runs can take a little longer — we&rsquo;ll always agree timing with you before production starts.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---------- enquiry details ---------- */}
      <Reveal className="calc-card mt-8">
        <h3 className="h-display h-md" style={{ marginBottom: '1.6rem' }}>
          YOUR DETAILS
        </h3>
        <div className="form-grid">
          <Field id="bkName" label="Name" error={errors.name} className="min-w-0">
            <Input ref={nameRef} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field id="bkOrg" label="Organisation" hint="(optional)" className="min-w-0">
            <Input type="text" autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
          </Field>
          <Field id="bkEmail" label="Email" error={errors.email} className="min-w-0">
            <Input ref={emailRef} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field id="bkPhone" label="Phone" error={errors.phone} hint="(optional)" className="min-w-0">
            <Input ref={phoneRef} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field id="bkDate" label="Event date" hint="(optional)" className="min-w-0">
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </Field>
        </div>
        <Field id="bkMessage" label="Message" hint="(optional)">
          <Textarea
            rows={4}
            placeholder="Tell us about your crew, event or brand — colours, deadlines, anything that helps us quote accurately."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>

        <div className="hp-field" aria-hidden="true">
          <label htmlFor="bkHp">Leave this field empty</label>
          <input type="text" id="bkHp" name="company" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </div>

        <Button type="submit" variant="solid" style={{ maxWidth: '320px' }} disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send enquiry'
          )}
        </Button>
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>

        {result && (
          <div
            ref={resultRef}
            className={cn('result-panel', result.ok ? 'ok' : 'err')}
            role={result.ok ? 'status' : 'alert'}
            tabIndex={-1}
          >
            {result.ok ? (
              <>
                <h3>Enquiry sent</h3>
                <dl>
                  <dt>Name</dt>
                  <dd>{result.payload.name}</dd>
                  {result.payload.organisation && (
                    <>
                      <dt>Organisation</dt>
                      <dd>{result.payload.organisation}</dd>
                    </>
                  )}
                  <dt>Email</dt>
                  <dd>{result.payload.email}</dd>
                  {result.payload.phone && (
                    <>
                      <dt>Phone</dt>
                      <dd>{result.payload.phone}</dd>
                    </>
                  )}
                  {result.payload.eventDate && (
                    <>
                      <dt>Event date</dt>
                      <dd>{result.payload.eventDate}</dd>
                    </>
                  )}
                  <dt>Garment</dt>
                  <dd>{result.payload.garmentName}</dd>
                  <dt>Quantity</dt>
                  <dd>{result.payload.quantity}</dd>
                  <dt>Approach</dt>
                  <dd>{result.payload.approach}</dd>
                  <dt>Sizes</dt>
                  <dd>
                    {Object.keys(result.payload.sizeBreakdown)
                      .filter((s) => result.payload.sizeBreakdown[s] > 0)
                      .map((s) => `${s} × ${result.payload.sizeBreakdown[s]}`)
                      .join(', ')}
                  </dd>
                  <dt>Estimate</dt>
                  <dd>
                    {KA_CORE.money(result.payload.estimate.unit)} / unit · {KA_CORE.money(result.payload.estimate.total)} total
                  </dd>
                  {result.payload.message && (
                    <>
                      <dt>Message</dt>
                      <dd>{result.payload.message}</dd>
                    </>
                  )}
                </dl>
                <p className="via-note">
                  {channelNote(result.via)} Prefer email?{' '}
                  <a href={buildMailtoFallback('Crew & Bulk enquiry', summaryLines(result.payload))}>Write to us directly</a>.
                </p>
              </>
            ) : (
              <>
                <h3>Couldn&rsquo;t send that just now</h3>
                <p>Your enquiry is saved on this device, but sending it failed. Try again, or email us directly with the details below — your email app will open with everything pre-filled.</p>
                <div className="retry-row">
                  <Button type="button" variant="gold" onClick={() => void submitForm()}>
                    Try again
                  </Button>
                  <Button href={buildMailtoFallback('Crew & Bulk enquiry', summaryLines(result.payload))} variant="berry">
                    Email us directly
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Reveal>
    </form>
  );
}
