import Link from 'next/link';
import type { Product } from '@/lib/types';

/* KHARIS & ALETHEIA — size guide modal (product page's "Find my size"). Tables
   ported verbatim from ../product.js's TEE_TABLE/CREW_TABLE/HOODIE_TABLE, which are
   themselves a verbatim copy of ../sizing.html's tables — kept in sync there. */

const SIZES_FULL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const TEE_TABLE = {
  head: SIZES_FULL,
  rows: [
    ['Chest width', '19 5/8"', '20 1/2"', '21 1/4"', '22"', '23 1/4"', '24 3/8"', '25 5/8"'],
    ['Body length', '24 1/4"', '25 1/4"', '26 1/8"', '27 1/8"', '28 1/8"', '29 1/8"', '30 1/8"'],
    ['Sleeve length', '8 1/4"', '8 5/8"', '9"', '9 1/2"', '10"', '10 7/8"', '11 1/4"'],
  ],
};
const CREW_TABLE = {
  head: SIZES_FULL,
  rows: [
    ['Chest width', '21 1/8"', '22"', '22 3/4"', '23 1/2"', '24 3/4"', '26"', '27 1/4"'],
    ['Body length', '25 3/8"', '26 1/2"', '27 3/8"', '28 1/4"', '29 3/8"', '30 1/2"', '31 3/4"'],
    ['Sleeve length', '19 1/4"', '20"', '20 3/4"', '21 3/4"', '22 5/8"', '23 1/2"', '24 3/8"'],
  ],
};
const HOODIE_TABLE = {
  head: SIZES_FULL,
  rows: [
    ['Chest width', '20 1/2"', '21 1/2"', '22 1/2"', '23 1/2"', '24 1/2"', '25 3/4"', '27"'],
    ['Body length', '24 1/4"', '25 3/4"', '27"', '28"', '29"', '30"', '31"'],
    ['Sleeve length', '20 1/4"', '21 3/4"', '23"', '24"', '25"', '26"', '27"'],
  ],
};

export function isHoodieProduct(product: Product): boolean {
  return product.cat === 'sweatshirts' && /hood/i.test(product.name + ' ' + (product.details || ''));
}

export function sizeGuideLabel(product: Product): string {
  if (isHoodieProduct(product)) return 'Hoodies';
  return product.cat === 'tees' ? 'Tees' : 'Sweatshirts & Crewnecks';
}

function tableFor(product: Product) {
  if (isHoodieProduct(product)) return HOODIE_TABLE;
  return product.cat === 'tees' ? TEE_TABLE : CREW_TABLE;
}

export function SizeGuideModal({ product }: { product: Product }) {
  const table = tableFor(product);
  const label = sizeGuideLabel(product);

  return (
    <div className="ka-modal-sizeguide">
      <p className="micro">Size guide</p>
      <h2 className="h-display h-md">{label}</h2>
      <div className="size-table">
        <table>
          <thead>
            <tr>
              <th>Size</th>
              {table.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r[0]}>
                <th>{r[0]}</th>
                {r.slice(1).map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="modal-note">All measurements in inches. Between sizes? Size up for a relaxed drape.</p>
      <Link className="btn btn-gold" href="/sizing">
        Full size charts →
      </Link>
    </div>
  );
}
