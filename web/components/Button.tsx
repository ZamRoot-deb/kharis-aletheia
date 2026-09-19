import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'berry' | 'gold' | 'solid' | 'plain';

interface CommonProps {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

/** Renders an `<a>` (via next/link) when `href` is given, a real `<button>` otherwise —
 *  matches the old site's `.btn`/`.btn-berry`/`.btn-gold`/`.btn-solid` classes exactly,
 *  so an "add to cart" action and a "Shop the drop →" navigation both look identical
 *  while staying the correct real element per CONTRACT-NEXT.md's a11y rule. */
export type ButtonProps =
  | (CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>)
  | (CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>);

export function Button(props: ButtonProps) {
  const { variant = 'plain', className, children } = props;
  const cls = cn(
    'btn',
    variant === 'berry' && 'btn-berry',
    variant === 'gold' && 'btn-gold',
    variant === 'solid' && 'btn-solid',
    className
  );

  if (props.href) {
    const { href, variant: _v, className: _c, children: _ch, ...rest } = props as Extract<ButtonProps, { href: string }>;
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v2, className: _c2, children: _ch2, href: _h, type, ...rest } = props as Extract<
    ButtonProps,
    { href?: undefined }
  >;
  return (
    <button type={type || 'button'} className={cls} {...rest}>
      {children}
    </button>
  );
}
