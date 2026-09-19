'use client';

/* KHARIS & ALETHEIA — contact form. Ported from ../contact.js (name/email/topic/
   optional order ref/message, honeypot, useForms.submit('contact')). */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/cn';
import { KA_CONFIG } from '@/lib/config';
import { KA_CORE } from '@/lib/core';
import { useForms } from '@/app/providers';
import { Field, Input, Select, Textarea } from '@/components/FormControls';
import { Reveal } from '@/components/Reveal';
import { Button } from '@/components/Button';

type Topic = 'order' | 'sizing' | 'custom' | 'bulk' | 'press' | 'other';

const TOPIC_LABEL: Record<Topic, string> = {
  order: 'Order enquiry',
  sizing: 'Sizing help',
  custom: 'Custom print / design',
  bulk: 'Crew & Bulk',
  press: 'Press',
  other: 'Other',
};

interface ContactPayload {
  name: string;
  email: string;
  topic: Topic | '';
  orderRef: string;
  message: string;
}

function channelNote(via: string): string {
  if (via === 'endpoint') return 'Sent straight to our team — no further action needed from you.';
  if (via === 'mailto')
    return "Your email app should have opened with this message pre-filled. Please hit send there to complete it — if nothing opened, use the direct email link instead.";
  return "We've saved this message on this device. If you don't hear back within two working days, please email us directly so we don't miss it.";
}

function buildMailtoFallback(subject: string, lines: string[]): string {
  return `mailto:${KA_CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function ContactForm() {
  const forms = useForms();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<Topic | ''>('');
  const [orderRef, setOrderRef] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');

  const [errors, setErrors] = useState<{ name?: string; email?: string; topic?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ ok: boolean; via: string; payload: ContactPayload } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function validate() {
    const errs: typeof errors = {};
    if (!KA_CORE.validate.required(name)) errs.name = 'Tell us your name.';
    if (!KA_CORE.validate.email(email)) errs.email = 'Enter a valid email address.';
    if (!topic) errs.topic = 'Choose a topic.';
    if (!KA_CORE.validate.required(message)) errs.message = 'Add a message so we know how to help.';
    setErrors(errs);
    return errs;
  }

  function focusFirstError(errs: typeof errors) {
    if (errs.name) return nameRef.current?.focus();
    if (errs.email) return emailRef.current?.focus();
    if (errs.topic) return topicRef.current?.focus();
    if (errs.message) return messageRef.current?.focus();
  }

  function resetForm() {
    setName('');
    setEmail('');
    setTopic('');
    setOrderRef('');
    setMessage('');
    setHp('');
  }

  async function submitForm() {
    setResult(null);
    const errs = validate();
    if (Object.keys(errs).length) {
      setStatus('Please fix the highlighted fields.');
      focusFirstError(errs);
      return;
    }

    const payload: ContactPayload = {
      name: name.trim(),
      email: email.trim(),
      topic,
      orderRef: orderRef.trim(),
      message: message.trim(),
    };

    if (hp) {
      setResult({ ok: true, via: 'local', payload });
      resetForm();
      return;
    }

    setBusy(true);
    setStatus('Sending your message…');
    try {
      const res = await forms.submit('contact', payload);
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

  function topicLabel(t: Topic | ''): string {
    return t ? TOPIC_LABEL[t] : '';
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submitForm();
      }}
      noValidate
    >
      <Reveal className="calc-card">
        <div className="form-grid">
          <Field id="ctName" label="Name" error={errors.name} className="min-w-0">
            <Input ref={nameRef} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field id="ctEmail" label="Email" error={errors.email} className="min-w-0">
            <Input ref={emailRef} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field id="ctTopic" label="Topic" error={errors.topic} className="min-w-0">
            <Select ref={topicRef} value={topic} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTopic(e.target.value as Topic)} required>
              <option value="" disabled>
                Choose a topic
              </option>
              <option value="order">Order enquiry</option>
              <option value="sizing">Sizing help</option>
              <option value="custom">Custom print / design</option>
              <option value="bulk">Crew &amp; Bulk</option>
              <option value="press">Press</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field id="ctRef" label="Order reference" hint="(optional)" className="min-w-0">
            <Input type="text" placeholder="e.g. KA-482913" autoComplete="off" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
          </Field>
        </div>

        <Field id="ctMessage" label="Message" error={errors.message}>
          <Textarea
            ref={messageRef}
            rows={6}
            placeholder="Tell us what's going on — the more detail, the faster we can help."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </Field>

        <div className="hp-field" aria-hidden="true">
          <label htmlFor="ctHp">Leave this field empty</label>
          <input type="text" id="ctHp" name="company" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </div>

        <Button type="submit" variant="solid" style={{ maxWidth: '280px' }} disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send message'
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
                <h3>Message sent</h3>
                <dl>
                  <dt>Name</dt>
                  <dd>{result.payload.name}</dd>
                  <dt>Email</dt>
                  <dd>{result.payload.email}</dd>
                  <dt>Topic</dt>
                  <dd>{topicLabel(result.payload.topic)}</dd>
                  {result.payload.orderRef && (
                    <>
                      <dt>Order ref</dt>
                      <dd>{result.payload.orderRef}</dd>
                    </>
                  )}
                  <dt>Message</dt>
                  <dd>{result.payload.message}</dd>
                </dl>
                <p className="via-note">{channelNote(result.via)}</p>
              </>
            ) : (
              <>
                <h3>Couldn&rsquo;t send that just now</h3>
                <p>Your message is saved on this device, but sending it failed. Try again, or email us directly — your email app will open with everything pre-filled.</p>
                <div className="retry-row">
                  <Button type="button" variant="gold" onClick={() => void submitForm()}>
                    Try again
                  </Button>
                  <Button
                    href={buildMailtoFallback(`Contact: ${topicLabel(result.payload.topic)}`, [
                      `Name: ${result.payload.name}`,
                      `Email: ${result.payload.email}`,
                      `Topic: ${topicLabel(result.payload.topic)}`,
                      `Order ref: ${result.payload.orderRef || '—'}`,
                      '',
                      result.payload.message,
                    ])}
                    variant="berry"
                  >
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
