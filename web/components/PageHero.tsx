import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GlitchHeading } from './GlitchHeading';

export interface PageHeroImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface PageHeroProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Omit for the `.page-hero.plain` gradient variant (sizing/about-less pages);
   *  pass it for the photographic `.page-hero` variant (about/shop/lookbook/makers). */
  image?: PageHeroImage;
  /** e.g. '38vh' — matches the old inline `style="min-height:…"` per page. */
  minHeight?: string;
  align?: 'left' | 'center';
  className?: string;
  children?: ReactNode;
}

/** `.page-hero[.plain]` banner — ported from every old `<section class="page-hero
 *  [plain]">…</section>`. Pass `image` for the photo+veil variant, omit it for the
 *  plain gradient variant used by most sub-pages. */
export function PageHero({ eyebrow, title, lede, image, minHeight, align = 'left', className, children }: PageHeroProps) {
  const style: CSSProperties | undefined = minHeight ? { minHeight } : undefined;
  const wrapStyle: CSSProperties | undefined = align === 'center' ? { textAlign: 'center' } : undefined;
  const ledeStyle: CSSProperties | undefined =
    align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : undefined;

  return (
    <section className={cn('page-hero', !image && 'plain', className)} style={style}>
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ph-img"
            src={image.src}
            width={image.width}
            height={image.height}
            alt={image.alt}
            decoding="async"
          />
          <div className="ph-veil" />
        </>
      )}
      <div className="wrap" style={wrapStyle}>
        {eyebrow && <p className="micro">{eyebrow}</p>}
        <GlitchHeading text={title} />
        {lede && (
          <p className="lede" style={ledeStyle}>
            {lede}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
