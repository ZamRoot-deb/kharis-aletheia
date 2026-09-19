'use client';

/* KHARIS & ALETHEIA — PRINT LAB reusable field builders. Ported from ../lab.js's
   rangeField/segField/multiSegField/boolRow/bandHeightsField/symbolPickerField
   (which built these as raw DOM nodes) into small React components. Range- and
   color-type controls need the browser's native 'change' event (fires once, on
   release) to know when to push an undo-history entry, while every keystroke/drag
   tick ('input'/onChange) only updates the live preview — see useCommitRef below,
   the refs+effects the imperative original relied on for that same distinction. */

import { useEffect, useId, useRef, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { KA_PRINTS } from '@/lib/prints';
import { normalizeHex } from './lab-utils';

/** Attaches a ref to a range/color <input> so its native 'change' event (release —
 *  after a drag, or after each keyboard step) triggers `onCommit`, independently of
 *  whatever onInput/onChange React prop drives the continuous live update. The ref
 *  callback always calls the LATEST `onCommit` passed in (via a plain mutable ref
 *  updated on every render), so the listener itself only needs to attach once. */
export function useCommitRef<T extends HTMLElement>(onCommit: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  const latest = useRef(onCommit);
  latest.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => latest.current();
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, []);
  return ref;
}

function formatVal(v: number, decimals?: number): string {
  return decimals != null ? v.toFixed(decimals) : String(Math.round(v));
}

/* ---------- range (continuous — live onInput, commit on release) ---------- */

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  decimals,
  onInput,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onInput: (v: number) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const ref = useCommitRef<HTMLInputElement>(onCommit);
  return (
    <div className="lab-field">
      <label htmlFor={id}>{label}</label>
      <div className="lab-range-row">
        <input
          ref={ref}
          type="range"
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onInput(parseFloat(e.target.value))}
        />
        <output htmlFor={id}>{formatVal(value, decimals)}</output>
      </div>
    </div>
  );
}

/* ---------- single-select segmented pills (discrete — commit immediately) ---------- */

export function SegField<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const labelId = useId();
  return (
    <div className="lab-field">
      <span className="lab-field-label" id={labelId}>
        {label}
      </span>
      <div className="lab-seg" role="group" aria-labelledby={labelId}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={cn('pill', opt === value && 'on')}
            aria-pressed={opt === value}
            onClick={() => {
              if (opt !== value) onChange(opt);
            }}
          >
            {format ? format(opt) : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- multi-select segmented pills (discrete — commit immediately, blocks emptying) ---------- */

export function MultiSegField<T extends string>({
  label,
  options,
  values,
  onChange,
  onBlocked,
  format,
}: {
  label: string;
  options: T[];
  values: T[];
  onChange: (next: T[]) => void;
  onBlocked?: () => void;
  format?: (v: T) => string;
}) {
  const labelId = useId();
  return (
    <div className="lab-field">
      <span className="lab-field-label" id={labelId}>
        {label}
      </span>
      <div className="lab-seg" role="group" aria-labelledby={labelId}>
        {options.map((opt) => {
          const on = values.indexOf(opt) >= 0;
          return (
            <button
              key={opt}
              type="button"
              className={cn('pill', on && 'on')}
              aria-pressed={on}
              onClick={() => {
                if (on) {
                  if (values.length <= 1) {
                    onBlocked?.();
                    return;
                  }
                  onChange(values.filter((v) => v !== opt));
                } else {
                  onChange([...values, opt]);
                }
              }}
            >
              {format ? format(opt) : opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- boolean toggle row (discrete — commit immediately) ---------- */

export interface BoolItem {
  key: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function BoolRow({ items }: { items: BoolItem[] }) {
  return (
    <div className="lab-bool-row">
      {items.map((it) => (
        <label className="lab-toggle" key={it.key}>
          <input type="checkbox" checked={it.value} aria-label={it.label} onChange={(e) => it.onChange(e.target.checked)} />
          <span className="lt-box" aria-hidden="true" />
          <span>{it.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---------- kente band-heights repeatable list ---------- */

function BandRow({
  idx,
  height,
  canRemove,
  onInput,
  onCommit,
  onRemove,
}: {
  idx: number;
  height: number;
  canRemove: boolean;
  onInput: (v: number) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const ref = useCommitRef<HTMLInputElement>(onCommit);
  return (
    <div className="lab-band-row">
      <label className="lb-idx" htmlFor={id}>
        Band {idx + 1}
      </label>
      <input
        ref={ref}
        type="range"
        id={id}
        min={4}
        max={14}
        step={1}
        value={height}
        onChange={(e) => onInput(parseInt(e.target.value, 10))}
      />
      <output htmlFor={id}>{height}</output>
      <button type="button" aria-label={`Remove band ${idx + 1}`} disabled={!canRemove} onClick={onRemove}>
        {'−'}
      </button>
    </div>
  );
}

export function BandHeightsField({
  heights,
  onInput,
  onCommit,
  onRemove,
  onAdd,
  addBtnRef,
}: {
  heights: number[];
  onInput: (idx: number, v: number) => void;
  onCommit: () => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  addBtnRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="lab-field">
      <span className="lab-field-label">Band heights</span>
      <div className="lab-bandlist">
        {heights.map((h, idx) => (
          <BandRow
            key={idx}
            idx={idx}
            height={h}
            canRemove={heights.length > 2}
            onInput={(v) => onInput(idx, v)}
            onCommit={onCommit}
            onRemove={() => onRemove(idx)}
          />
        ))}
      </div>
      <button type="button" ref={addBtnRef} className="btn btn-gold lab-mini-btn" disabled={heights.length >= 5} onClick={onAdd}>
        + Add band
      </button>
    </div>
  );
}

/* ---------- adinkra symbol picker ---------- */

export function SymbolPickerField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const labelId = useId();
  const symbols = KA_PRINTS.symbols() || [];

  if (!symbols.length) {
    return (
      <div className="lab-field">
        <span className="lab-field-label" id={labelId}>
          Symbol
        </span>
        <p className="lab-gallery-error">Symbols could not be loaded. Refresh to try again.</p>
      </div>
    );
  }

  return (
    <div className="lab-field">
      <span className="lab-field-label" id={labelId}>
        Symbol
      </span>
      <div className="lab-symbols" role="group" aria-labelledby={labelId}>
        {symbols.map((sym) => {
          const on = sym.id === value;
          return (
            <button
              key={sym.id}
              type="button"
              className={cn('lab-symbol', on && 'on')}
              aria-pressed={on}
              title={`${sym.name} — ${sym.meaning}`}
              onClick={() => {
                if (sym.id !== value) onChange(sym.id);
              }}
            >
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <path d={sym.path} fill="currentColor" />
              </svg>
              <span>{sym.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- palette swatch (continuous colour — live onInput, commit on release) ---------- */

export function ColorSwatch({
  index,
  hex,
  canRemove,
  onInput,
  onCommit,
  onRemove,
}: {
  index: number;
  hex: string;
  canRemove: boolean;
  onInput: (hex: string) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  const ref = useCommitRef<HTMLInputElement>(onCommit);
  return (
    <div className="lab-swatch">
      <input
        ref={ref}
        type="color"
        value={normalizeHex(hex)}
        aria-label={`Swatch ${index + 1} colour`}
        onChange={(e) => onInput(e.target.value)}
      />
      <button type="button" className="lab-swatch-rm" disabled={!canRemove} aria-label={`Remove swatch ${index + 1}`} onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
