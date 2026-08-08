// Best-effort OS detection for choosing which receipt layout to print.
// Every OS/print-pipeline combination this shop has actually tested has
// shown its own real quirks (Android's print path extracts plain text and
// drops non-ASCII characters entirely, ignoring CSS layout; macOS's
// thermal driver has ignored @page sizing outright in the past) — sharing
// one parameterized receipt template between them meant a fix tuned for
// one pipeline's quirks kept visibly degrading a different one. See
// PrintReceiptModal.jsx.
export function getPrintPlatform() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  // Unrecognized UA (or a platform this shop hasn't hit issues on yet)
  // falls back to the real-CSS-rendering assumption rather than the
  // defensive plain-text-safe one — most browsers render CSS properly;
  // Android's plain-text extraction is the specific outlier this was
  // built to detect and work around, not the default to assume.
  return "mac";
}
