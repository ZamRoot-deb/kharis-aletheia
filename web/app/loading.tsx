/* Route-loading fallback shown by the App Router while a route segment streams in.
   Net-new (the old static site had no equivalent — every page was a full browser
   navigation); kept tiny and token-driven via globals.css's `.page-loading` rule so
   it reads as part of the same system rather than a generic spinner. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}
