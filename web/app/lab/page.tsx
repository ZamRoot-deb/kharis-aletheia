import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { LabClient } from './LabClient';

/* KHARIS & ALETHEIA — Print Lab, ported from ../lab.html + ../lab.js (CONTRACT-NEXT.md
   "lab" row). This file stays a server component (static hero + metadata only); all
   the state/interactivity lives in the 'use client' <LabClient/> below it. */

export const metadata: Metadata = {
  title: 'PRINT LAB',
  description:
    'Remix kente, ankara and adinkra prints live — pick a palette, tune the pattern, save it and send it straight to the Tee Studio.',
};

export default function LabPage() {
  return (
    <div className="page">
      <a className="lab-skip" href="#labControls">
        Skip to Print Lab controls
      </a>

      <PageHero
        eyebrow="Design studio"
        title="PRINT LAB"
        lede="Remix kente and ankara blocks live. Watch the layout update as you play."
      />

      <LabClient />
    </div>
  );
}
