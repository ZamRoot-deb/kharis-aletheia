'use client';

/* KHARIS & ALETHEIA — gift card builder (amount picker + live SVG preview +
   recipient/sender/message/send-date + add-to-cart). Ported from ../gift.js;
   the live preview is real JSX/SVG instead of an innerHTML string, and the send
   date defaults/min are set in a mount-only effect (never during render/initial
   state) per CONTRACT-NEXT.md's HYDRATION rule — ../gift.js could read
   `new Date()` synchronously because it never had to match a server render. */

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/cn';
import { KA_CONFIG } from '@/lib/config';
import { KA_CORE } from '@/lib/core';
import { useCart, useToast } from '@/app/providers';
import { Field, Input, Textarea } from '@/components/FormControls';
import { Reveal } from '@/components/Reveal';
import { Button } from '@/components/Button';

const AMOUNTS = KA_CONFIG.giftAmounts;
const MIN_AMT = 10;
const MAX_AMT = 500;
const MAXMSG = 200;
const DEFAULT_AMOUNT = AMOUNTS[Math.floor(AMOUNTS.length / 2)] ?? AMOUNTS[0] ?? MIN_AMT;

interface GiftItem {
  kind: 'gift';
  amount: number;
  to: string;
  from: string;
  email: string;
  message: string;
  sendOn: string;
}

function localIso(d?: Date): string {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function GiftCardPreview({ amount, to, from }: { amount: number; to: string; from: string }) {
  const amountText = amount > 0 ? KA_CORE.money(amount) : '£—';
  const toText = truncate(to.trim() || 'Someone special', 22);
  const fromText = truncate(from.trim() || 'A friend', 22);
  return (
    <svg
      className="gift-card-svg"
      viewBox="0 0 640 400"
      role="img"
      aria-label={`Gift card preview: ${amountText}, to ${toText}, from ${fromText}`}
    >
      <rect x={1} y={1} width={638} height={398} fill="var(--surface)" stroke="var(--gold)" strokeWidth={2} />
      <rect x={1} y={1} width={638} height={6} fill="var(--berry)" />
      <text x={40} y={66} fontFamily="JetBrains Mono, monospace" fontSize={13} letterSpacing={5} fill="var(--gold)">
        KHARIS &amp; ALETHEIA
      </text>
      <text x={40} y={90} fontFamily="JetBrains Mono, monospace" fontSize={10} letterSpacing={4} fill="var(--muted)">
        GIFT CARD
      </text>
      <text x={40} y={218} fontFamily="Orbitron, sans-serif" fontWeight={900} fontSize={62} fill="var(--fg)">
        {amountText}
      </text>
      <line x1={40} y1={266} x2={600} y2={266} stroke="var(--border-strong)" strokeWidth={1} />
      <text x={40} y={304} fontFamily="JetBrains Mono, monospace" fontSize={11} letterSpacing={3} fill="var(--muted)">
        TO
      </text>
      <text x={92} y={304} fontFamily="JetBrains Mono, monospace" fontSize={14} fill="var(--fg)">
        {toText}
      </text>
      <text x={40} y={334} fontFamily="JetBrains Mono, monospace" fontSize={11} letterSpacing={3} fill="var(--muted)">
        FROM
      </text>
      <text x={92} y={334} fontFamily="JetBrains Mono, monospace" fontSize={14} fill="var(--fg)">
        {fromText}
      </text>
      <text x={600} y={378} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing={2} fill="var(--muted)">
        EMAIL US TO REDEEM · APPLIED BY HAND
      </text>
    </svg>
  );
}

export function GiftForm() {
  const cart = useCart();
  const { toast } = useToast();

  const [selectedAmount, setSelectedAmount] = useState(DEFAULT_AMOUNT);
  const [customAmount, setCustomAmount] = useState('');
  const [to, setTo] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [from, setFrom] = useState('');
  const [message, setMessage] = useState('');
  const [minDate, setMinDate] = useState('');
  const [sendOn, setSendOn] = useState('');
  const [hp, setHp] = useState('');

  const [amountErr, setAmountErr] = useState('');
  const [errors, setErrors] = useState<{ to?: string; toEmail?: string; from?: string; sendOn?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ ok: boolean; item: GiftItem } | null>(null);

  const customAmountRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const toEmailRef = useRef<HTMLInputElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  /* send date defaults to today, floor is today — both read from Date only after
     mount (HYDRATION rule), never during render/initial state. */
  useEffect(() => {
    const iso = localIso();
    setMinDate(iso);
    setSendOn(iso);
  }, []);

  useEffect(() => {
    // matches ../gift.js: success never steals focus back from the cart drawer's
    // own focus trap; failure does.
    if (result && !result.ok) resultRef.current?.focus();
  }, [result]);

  function selectPreset(a: number) {
    setSelectedAmount(a);
    setCustomAmount('');
  }
  function onCustomChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setCustomAmount(raw);
    const v = parseFloat(raw);
    setSelectedAmount(isNaN(v) ? 0 : v);
  }

  function resetForm() {
    setSelectedAmount(DEFAULT_AMOUNT);
    setCustomAmount('');
    setTo('');
    setToEmail('');
    setFrom('');
    setMessage('');
    setHp('');
    const iso = localIso();
    setMinDate(iso);
    setSendOn(iso);
  }

  function validate() {
    const errs: typeof errors = {};
    let amtErr = '';
    if (!(selectedAmount >= MIN_AMT && selectedAmount <= MAX_AMT)) {
      amtErr = 'Choose an amount, or enter a custom amount between £10 and £500.';
    }
    if (!KA_CORE.validate.required(to)) errs.to = "Who's this for?";
    if (!KA_CORE.validate.email(toEmail)) errs.toEmail = 'Enter a valid recipient email.';
    if (!KA_CORE.validate.required(from)) errs.from = 'Tell us who this is from.';
    if (!sendOn) errs.sendOn = 'Choose a send date.';
    else if (minDate && sendOn < minDate) errs.sendOn = "Send date can't be in the past.";
    if (message.length > MAXMSG) errs.message = 'Keep your message under 200 characters.';
    setErrors(errs);
    setAmountErr(amtErr);
    return { errs, amtErr };
  }

  function focusFirstError(errs: typeof errors, amtErr: string) {
    if (errs.to) return toRef.current?.focus();
    if (errs.toEmail) return toEmailRef.current?.focus();
    if (errs.from) return fromRef.current?.focus();
    if (errs.sendOn) return dateRef.current?.focus();
    if (amtErr) return customAmountRef.current?.focus();
  }

  async function submitForm() {
    setResult(null);
    const { errs, amtErr } = validate();
    if (Object.keys(errs).length || amtErr) {
      setStatus('Please fix the highlighted fields.');
      focusFirstError(errs, amtErr);
      return;
    }

    const item: GiftItem = {
      kind: 'gift',
      amount: selectedAmount,
      to: to.trim(),
      from: from.trim(),
      email: toEmail.trim(),
      message: message.trim(),
      sendOn,
    };

    if (hp) {
      // honeypot tripped: behave as if it worked, but never touch the cart
      setResult({ ok: true, item });
      resetForm();
      return;
    }

    setBusy(true);
    setStatus('Adding to your cart…');
    try {
      cart.addItem(item);
      setBusy(false);
      setStatus('');
      setResult({ ok: true, item });
      toast('Gift card added to your cart', 'ok');
      resetForm();
    } catch {
      setBusy(false);
      setStatus('');
      setResult({ ok: false, item });
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submitForm();
      }}
      noValidate
    >
      <Reveal className="calc-shell">
        {/* ---------- form fields ---------- */}
        <div className="calc-card">
          <fieldset className="pd-field wide">
            <legend className="field-legend">Amount</legend>
            <div className="amount-row">
              {AMOUNTS.map((a) => {
                const on = a === selectedAmount && customAmount === '';
                return (
                  <button
                    key={a}
                    type="button"
                    className={cn('amount-btn', on && 'on')}
                    aria-pressed={on}
                    onClick={() => selectPreset(a)}
                  >
                    {KA_CORE.money(a)}
                  </button>
                );
              })}
            </div>
            <div className="amount-custom">
              <label htmlFor="gfCustomAmount">Or a custom amount (£10–£500)</label>
              <input
                ref={customAmountRef}
                type="number"
                id="gfCustomAmount"
                min={MIN_AMT}
                max={MAX_AMT}
                step={1}
                inputMode="numeric"
                placeholder="e.g. 60"
                value={customAmount}
                onChange={onCustomChange}
              />
            </div>
            <span className="field-err" role="alert">
              {amountErr}
            </span>
          </fieldset>

          <div className="form-grid">
            <Field id="gfTo" label="Recipient name" error={errors.to} className="min-w-0">
              <Input ref={toRef} type="text" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} required />
            </Field>
            <Field id="gfToEmail" label="Recipient email" error={errors.toEmail} className="min-w-0">
              <Input ref={toEmailRef} type="email" autoComplete="off" value={toEmail} onChange={(e) => setToEmail(e.target.value)} required />
            </Field>
            <Field id="gfFrom" label="Your name" error={errors.from} className="min-w-0">
              <Input ref={fromRef} type="text" autoComplete="name" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </Field>
            <Field id="gfDate" label="Send date" error={errors.sendOn} className="min-w-0">
              <Input ref={dateRef} type="date" min={minDate} value={sendOn} onChange={(e) => setSendOn(e.target.value)} required />
            </Field>
          </div>

          <div className="field">
            <label htmlFor="gfMessage">
              Message <span className="field-hint">(optional)</span>
            </label>
            <Textarea
              id="gfMessage"
              rows={4}
              maxLength={MAXMSG}
              placeholder="Write something they'll want to read twice."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={errors.message ? 'true' : undefined}
              aria-describedby={errors.message ? 'gfMessage-error' : undefined}
            />
            <div className={cn('char-count', message.length > MAXMSG * 0.85 && message.length < MAXMSG && 'near', message.length >= MAXMSG && 'over')}>
              {message.length} / {MAXMSG}
            </div>
            {errors.message && (
              <span id="gfMessage-error" className="field-error" role="alert">
                {errors.message}
              </span>
            )}
          </div>

          <div className="hp-field" aria-hidden="true">
            <label htmlFor="gfHp">Leave this field empty</label>
            <input type="text" id="gfHp" name="company" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>

          <Button type="submit" variant="solid" style={{ maxWidth: '320px' }} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="spin" aria-hidden="true" />
                Adding…
              </>
            ) : (
              'Add to cart'
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
                  <h3>Added to your cart</h3>
                  <dl>
                    <dt>Amount</dt>
                    <dd>{KA_CORE.money(result.item.amount)}</dd>
                    <dt>To</dt>
                    <dd>
                      {result.item.to} ({result.item.email})
                    </dd>
                    <dt>From</dt>
                    <dd>{result.item.from}</dd>
                    <dt>Sends on</dt>
                    <dd>{result.item.sendOn}</dd>
                    {result.item.message && (
                      <>
                        <dt>Message</dt>
                        <dd>{result.item.message}</dd>
                      </>
                    )}
                  </dl>
                  <p className="via-note">
                    Added to your order — we&rsquo;ll send this to your recipient by hand ahead of the date you chose.{' '}
                    <Link href="/checkout">Go to checkout →</Link>
                  </p>
                </>
              ) : (
                <>
                  <h3>Couldn&rsquo;t add that to your cart</h3>
                  <p>Something went wrong saving this on your device. Try again — if it keeps happening, refresh the page first.</p>
                  <div className="retry-row">
                    <Button type="button" variant="gold" onClick={() => void submitForm()}>
                      Try again
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ---------- live preview ---------- */}
        <div className="gift-preview-wrap">
          <GiftCardPreview amount={selectedAmount} to={to} from={from} />
          <p className="gift-preview-note">Live preview — your actual card is generated the same way when it&rsquo;s sent.</p>
        </div>
      </Reveal>
    </form>
  );
}
