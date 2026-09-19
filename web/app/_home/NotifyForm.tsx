'use client';

/* "Get notified" form for an upcoming maker — ported from ../home.js's
   notifyFormHtml()/wireNotifyForms() and ../makers.js's identical copy. Used on the
   homepage's maker teaser (upcoming makers only) and on /makers' own profile
   sections. No honeypot field in the old markup for this form (unlike
   bulk/gift/contact) — none added here either, per CONTRACT-NEXT.md "Callers own
   their own honeypot field." */

import { useId, useState, type FormEvent } from 'react';
import { useForms } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';

/* Mirrors the via-aware follow-up copy ../contact.js/../bulk.js already use
   (ContactForm.tsx/BulkCalculator.tsx) — `res.ok` only means the submit path
   *ran* without throwing; `via:'mailto'`/'local' mean nothing has actually
   reached us yet, so the message must say so instead of a blanket "you're on
   the list". */
function channelNote(via: string): string {
  if (via === 'endpoint') return "You're on the list — we'll email you the moment it drops.";
  if (via === 'mailto')
    return `Your email app should have opened with a notify-me message pre-filled. Please hit send there to complete it — if nothing opened, email ${KA_CONFIG.contactEmail} directly.`;
  return `We've saved your request on this device, but nothing has been sent yet. Please email ${KA_CONFIG.contactEmail} directly so we don't miss it.`;
}

export function NotifyForm({ maker }: { maker: string }) {
  const { submit } = useForms();
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!KA_CORE.validate.email(value)) {
      setInvalid(true);
      setStatus({ type: 'err', msg: 'Enter a valid email address.' });
      return;
    }
    setInvalid(false);
    setSending(true);
    try {
      const res = await submit('notify', { maker, email: value });
      if (res && res.ok) {
        setDone(true);
        setStatus({ type: 'ok', msg: channelNote(res.via) });
      } else {
        setStatus({ type: 'err', msg: `Something went wrong. Try again, or email ${KA_CONFIG.contactEmail} directly.` });
      }
    } catch {
      setStatus({ type: 'err', msg: `Something went wrong. Try again, or email ${KA_CONFIG.contactEmail} directly.` });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="notify-form" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor={inputId}>
        Email address
      </label>
      {!done && (
        <div className="notify-row">
          <input
            type="email"
            className="input"
            id={inputId}
            name="email"
            placeholder="you@email.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (invalid) setInvalid(false);
            }}
            aria-invalid={invalid || undefined}
          />
          <button type="submit" className="btn btn-gold" disabled={sending}>
            {sending ? 'Sending…' : 'Get notified'}
          </button>
        </div>
      )}
      <p className={`notify-status${status ? ` ${status.type}` : ''}`} role="status" aria-live="polite">
        {status?.msg}
      </p>
    </form>
  );
}
