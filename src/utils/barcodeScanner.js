import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";

// Shared camera-scanning tuning for both ScanBarcodeModal.jsx (this
// device's own camera) and PhoneScan.jsx (a phone scanning on behalf of a
// desktop session) — one place to keep them from drifting apart, and one
// place to keep tuning if scanning still needs to get faster/more reliable.
//
// ideal (not exact) 1280x720 caps the camera frame size instead of letting
// the browser default to the sensor's native/often much higher resolution
// — every decode attempt then has far fewer pixels to binarize, which is
// most of why scanning felt slow. "ideal" degrades gracefully on a camera
// that can't hit it exactly, rather than refusing to open at all.
//
// focusMode inside `advanced` is a best-effort continuous-autofocus hint
// some browsers (mainly Chrome on Android) honor — a blurry, not-yet-
// focused frame is a real reason a scan can fail to read at all, not just
// feel slow. Unsupported browsers simply ignore an entry inside `advanced`
// rather than failing to open the camera over it.
export const SCAN_VIDEO_CONSTRAINTS = {
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    advanced: [{ focusMode: "continuous" }],
  },
};

// Reads only Code128 (the only format this app ever prints, see
// Barcode.jsx/jsbarcode) with TRY_HARDER on — scanning for just one format
// instead of ZXing's default of checking every format it knows already
// buys back time per attempt, leaving headroom to spend on TRY_HARDER's
// more thorough per-frame decode without the combination feeling slower
// overall. Also drops the default 500ms gap between decode attempts to
// 100ms — still comfortably above a single camera frame (~33ms at 30fps),
// so this isn't decoding faster than new frames actually arrive, just not
// sitting idle for half a second between tries.
export function createBarcodeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
}
