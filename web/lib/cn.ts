/* Tiny class-join helper — per CONTRACT-NEXT.md "clsx-style joins: write a 3-line
   local helper, don't add a package." */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
