import { KA_CORE } from '@/lib/core';

/** Renders a number through KA_CORE.money() (e.g. `£38`, `£4.95`) — the single place
 *  every page should format a price so currency/rounding stays consistent. Pure/DOM-free,
 *  safe in server components too. */
export function Money({ value }: { value: number }) {
  return <>{KA_CORE.money(value)}</>;
}
