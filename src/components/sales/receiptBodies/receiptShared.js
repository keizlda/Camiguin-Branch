// Genuinely platform-independent receipt data/logic — pure facts and a
// barcode-scannability constraint, not visual formatting choices, so
// sharing this (unlike the receipt bodies themselves) can't cause an
// Android-specific fix to leak into Mac/Windows or vice versa.

export const STORE_ADDRESS = ["Balintawak, Mambajao,", "Camiguin 911"];
export const STORE_PHONE = "0916 245 6667";
export const RETURN_POLICY = "No returns after 7 days.";

// Not a stored/sequential invoice number — this app's sales are identified
// by UUID, not a counter. Derived entirely from real fields (the sale's own
// date + a slice of its real id) purely for a shorter, receipt-friendly
// reference, not a fabricated fact.
//
// label (shown as text) and barcodeValue (what's actually encoded) are
// deliberately different lengths: a receipt's printable width is much
// narrower than a device label's. Verified by simulated decode at the
// actual usable width of a 58mm thermal roll (the narrowest paper this
// app supports) — a 12-character encoded value already failed there, so
// the barcode carries an 8-character value (MMDD + 4 hex chars of the
// real sale id) while the full "SALE-MMDDYY-XXXXXX" still prints as
// human-readable text underneath.
export function getSaleReference(soldAt, saleId) {
  if (!soldAt || !saleId) return null;
  const d = new Date(soldAt);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const fullSuffix = saleId.replace(/-/g, "").slice(-6).toUpperCase();
  return {
    label: `SALE-${mm}${dd}${yy}-${fullSuffix}`,
    barcodeValue: `${mm}${dd}${fullSuffix.slice(-4)}`,
  };
}
