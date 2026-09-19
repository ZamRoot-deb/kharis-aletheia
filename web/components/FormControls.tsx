import {
  cloneElement,
  forwardRef,
  isValidElement,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/* KHARIS & ALETHEIA — form primitives (CONTRACT-NEXT.md "Providers + shared
   components"). Ported from globals.css's `.field`/`.input`/`.select`/`.textarea`/
   `.checkbox`/`.field-error` shared primitives (originally added in ../styles.css's
   "SHARED PRIMITIVES" section for every page's forms: product size/qty, checkout,
   bulk, gift, contact, studio). */

/* ---------- Field — label + control + hint/error, auto-wires aria-describedby ---------- */

export interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  /** the single Input/Select/Textarea/Checkbox element this field wraps — gets
   *  `id`/`aria-describedby`/`aria-invalid` injected automatically */
  children: ReactNode;
}

export function Field({ id, label, error, hint, className, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
      })
    : children;

  return (
    <div className={cn('field', className)}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

/* ---------- Input / Select / Textarea — thin styled wrappers over the native elements ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn('input', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn('select', className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={cn('textarea', className)} {...props} />;
});

/* ---------- Checkbox — `.checkbox` label-wraps a real <input type="checkbox"> ---------- */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...props },
  ref
) {
  return (
    <label className={cn('checkbox', className)}>
      <input ref={ref} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
});
