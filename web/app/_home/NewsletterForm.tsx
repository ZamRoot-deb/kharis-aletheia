'use client';

/* Newsletter signup band — ported from ../index.html's #newsletter form +
   ../home.js's wireNewsletter(). */

import { useId, useState, type FormEvent } from 'react';
import { useForms } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';

/* Mirrors the via-aware follow-up copy ../contact.js/../bulk.js already use
   (ContactForm.tsx/BulkCalculator.tsx) — `res.ok` only means the submit path
   *ran* without throwing; `via:'mailto'`/'local' mean nothing has actually
   reached us yet, so the message must say so instead of a blanket "you're in". */
function channelNote(via: string): string {
  if (via === 'endpoint') return "You're in — welcome to the list.";
  if (via === 'mailto')
    return `Your email app should have opened with a sign-up message pre-filled. Please hit send there to complete it — if nothing opened, email ${KA_CONFIG.contactEmail} directly to join.`;
  return `We've saved your email on this device, but nothing has been sent yet. Please email ${KA_CONFIG.contactEmail} directly to join the list.`;
}

export function NewsletterForm() {
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
      const res = await submit('newsletter', { email: value });
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
    <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor={inputId}>
        Email address
      </label>
      {!done && (
        <div className="nl-row">
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
          <button className="btn btn-berry" type="submit" disabled={sending}>
            {sending ? 'Signing up…' : 'Sign up →'}
          </button>
        </div>
      )}
      <p className={`notify-status${status ? ` ${status.type}` : ''}`} role="status" aria-live="polite">
        {status?.msg}
      </p>
    </form>
  );
}
