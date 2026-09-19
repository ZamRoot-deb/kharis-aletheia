/* KHARIS & ALETHEIA — PRINT LAB constants (ported verbatim from ../lab.js).
   Pure data, DOM-free — safe to import from a server or client file. */
import type { PrintFamily } from '@/lib/types';

export const FAMILIES: PrintFamily[] = ['kente', 'ankara', 'adinkra'];
export const MOTIF_OPTS = ['zigzag', 'checker', 'steps', 'diamond', 'bars'];
export const ANKARA_MOTIFS = ['rings', 'fans', 'petals', 'waves', 'suns', 'shells'];
export const FRAME_OPTS = ['none', 'box', 'comb'];

export const FAMILY_LABEL: Record<PrintFamily, string> = { kente: 'Kente', ankara: 'Ankara', adinkra: 'Adinkra' };

export const FAMILY_MEANING: Record<PrintFamily, string> = {
  kente:
    'Kente began with Akan weavers in Ghana — narrow strips woven on a horizontal loom, then sewn edge to edge into cloth. Historically, every stripe combination carried its own name and proverb. The strips and bands you’re remixing echo that same structure.',
  ankara:
    'Ankara (Dutch wax print) is wax-resist cotton, bold and large in scale by design, worn across West Africa for everyday wear and for ceremony alike. The motifs repeat freely — there’s no single "correct" layout.',
  adinkra:
    'Adinkra symbols come from the Akan of Ghana, traditionally stamped onto cloth for funerals and formal occasions. Each glyph is a compressed proverb — pick one below to read what it carries.',
};

export interface HousePalette {
  name: string;
  hexes: string[];
}

/** House palette presets offered in the palette editor — distinct from prints.ts's
 *  internal randomize() palette pools (same house colours, different purpose: these
 *  are one-click "apply this palette" swatches, not randomize seeds). */
export const HOUSE_PALETTES: HousePalette[] = [
  { name: 'Gold & Berry', hexes: ['#d8b26a', '#e8325e', '#2a0816', '#f2e8d6'] },
  { name: 'Forest Kente', hexes: ['#0f3d2e', '#d8b26a', '#8b0e3a', '#f2e8d6'] },
  { name: 'Midnight Ankara', hexes: ['#121013', '#1f4fa8', '#d8b26a', '#f4f1ea'] },
  { name: 'Adire Indigo', hexes: ['#14213d', '#f4f1ea', '#8a6a2a', '#2a0816'] },
  { name: 'Sunset Wax', hexes: ['#e8325e', '#f0d6a0', '#8b0e3a', '#4a5232'] },
  { name: 'Earth & Ivory', hexes: ['#4a5232', '#e9dfc8', '#8a6a78', '#2a0816'] },
];

export const HIST_MAX = 60;
export const LS_KEY = 'ka_lab';
