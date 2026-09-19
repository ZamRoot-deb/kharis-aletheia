'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/* ../sizing.html's #sizePills + .size-block tables, ported from ../app.js's
   "SIZING TABS" block. The old script click()s the first pill on load to apply the
   initial `display:none` toggling; here the equivalent (which block is shown) is
   plain useState, so server and first client render already agree — no effect
   needed. */

type SizeGroup = 'tees' | 'sweatshirts' | 'hoodies';

const TABS: { id: SizeGroup; label: string }[] = [
  { id: 'tees', label: 'Tees' },
  { id: 'sweatshirts', label: 'Sweatshirts' },
  { id: 'hoodies', label: 'Hoodies' },
];

const CHARTS: Record<SizeGroup, { title: string; rows: { label: string; values: string[] }[] }> = {
  tees: {
    title: 'Tees',
    rows: [
      { label: 'Chest width', values: ['19 5/8"', '20 1/2"', '21 1/4"', '22"', '23 1/4"', '24 3/8"', '25 5/8"'] },
      { label: 'Body length', values: ['24 1/4"', '25 1/4"', '26 1/8"', '27 1/8"', '28 1/8"', '29 1/8"', '30 1/8"'] },
      { label: 'Sleeve length', values: ['8 1/4"', '8 5/8"', '9"', '9 1/2"', '10"', '10 7/8"', '11 1/4"'] },
    ],
  },
  sweatshirts: {
    title: 'Sweatshirts & Crewnecks',
    rows: [
      { label: 'Chest width', values: ['21 1/8"', '22"', '22 3/4"', '23 1/2"', '24 3/4"', '26"', '27 1/4"'] },
      { label: 'Body length', values: ['25 3/8"', '26 1/2"', '27 3/8"', '28 1/4"', '29 3/8"', '30 1/2"', '31 3/4"'] },
      { label: 'Sleeve length', values: ['19 1/4"', '20"', '20 3/4"', '21 3/4"', '22 5/8"', '23 1/2"', '24 3/8"'] },
    ],
  },
  hoodies: {
    title: 'Hoodies',
    rows: [
      { label: 'Chest width', values: ['20 1/2"', '21 1/2"', '22 1/2"', '23 1/2"', '24 1/2"', '25 3/4"', '27"'] },
      { label: 'Body length', values: ['24 1/4"', '25 3/4"', '27"', '28"', '29"', '30"', '31"'] },
      { label: 'Sleeve length', values: ['20 1/4"', '21 3/4"', '23"', '24"', '25"', '26"', '27"'] },
    ],
  },
};

const HEAD = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export function SizeTabs() {
  const [active, setActive] = useState<SizeGroup>('tees');

  return (
    <>
      <div className="pill-row" id="sizePills">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn('pill', active === tab.id && 'on')}
            aria-pressed={active === tab.id}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {TABS.map((tab) => {
        const chart = CHARTS[tab.id];
        return (
          <div
            key={tab.id}
            className="size-block"
            data-size-group={tab.id}
            style={{ display: active === tab.id ? undefined : 'none' }}
          >
            <h2>{chart.title}</h2>
            <div className="size-table">
              <table>
                <thead>
                  <tr>
                    <th>Size</th>
                    {HEAD.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row) => (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      {row.values.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
