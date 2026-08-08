import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BrowserCodeReader } from "@zxing/browser";
import { createBarcodeReader, SCAN_VIDEO_CONSTRAINTS } from "../utils/barcodeScanner";
import { supabase } from "../lib/supabaseClient";

// Public, unauthenticated page a phone lands on after scanning the QR code
// shown by ScanBarcodeModal's "Scan with Phone" mode. Deliberately outside
// RequireAuth — this page can only push a decoded barcode string into a
// field on an already-authenticated desktop session (via the session id in
// the URL, an unguessable random UUID shown once), it can't touch data
// directly, so the friction of requiring login here isn't worth it.
//
// httpSend (REST, not the websocket subscribe+send pattern) is used since
// each scan is independent and one-shot — no need to wait for a websocket
// subscription to become ready before the very first one, even though the
// camera itself keeps running for however many scans follow it.
//
// How long a "Sent!" confirmation stays up before the camera goes back to
// actively accepting scans — long enough to notice it worked and move the
// phone to the next barcode, short enough that scanning several units in a
// row doesn't feel like waiting each time.
const CONFIRMATION_MS = 1200;

function PhoneScan() {
  const { sessionId } = useParams();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  // A cooldown, not a one-time flag — the camera now keeps decoding
  // continuously (never calls controls.stop() on a successful scan), so
  // this is what stops the same still-in-view barcode from being resent on
  // the very next frame. It clears itself after CONFIRMATION_MS, letting
  // this same phone session scan one barcode after another instead of
  // being stuck on a single "Sent!" screen that needed a full page reload
  // to scan again.
  const cooldownRef = useRef(false);
  const [cameraError, setCameraError] = useState("");
  const [lastSent, setLastSent] = useState(null); // { value, ok, message } | null

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let confirmationTimeout = null;
    const channel = supabase.channel(`scan-${sessionId}`);
    // See utils/barcodeScanner.js for what's tuned here and why.
    const reader = createBarcodeReader();

    reader
      .decodeFromConstraints(
        SCAN_VIDEO_CONSTRAINTS,
        videoRef.current,
        (result, err, controls) => {
          if (cancelled || cooldownRef.current) return;
          controlsRef.current = controls;
          if (!result) return;
          cooldownRef.current = true;
          const value = result.getText();

          const finish = (ok, message) => {
            if (cancelled) return;
            setLastSent({ value, ok, message });
            confirmationTimeout = setTimeout(() => {
              cooldownRef.current = false;
              setLastSent(null);
            }, CONFIRMATION_MS);
          };

          channel
            .httpSend("scanned", { value })
            .then((res) => finish(res.success, res.success ? "" : "Couldn't send — check your connection."))
            .catch(() => finish(false, "Couldn't send — check your connection."));
        }
      )
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") {
          setCameraError("Camera access was denied. Allow camera permission for this site and reload the page.");
        } else if (err?.name === "NotFoundError") {
          setCameraError("No camera was found on this device.");
        } else {
          setCameraError("Couldn't start the camera. Please reload the page and try again.");
        }
      });

    return () => {
      cancelled = true;
      if (confirmationTimeout) clearTimeout(confirmationTimeout);
      controlsRef.current?.stop();
      BrowserCodeReader.releaseAllStreams();
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Camera size={18} className="text-blue-500" />
          <p className="font-semibold text-gray-800">Scan Barcode</p>
        </div>

        <div className="p-5">
          {cameraError ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{cameraError}</p>
            </div>
          ) : (
            <>
              {/* The video feed itself never goes away on a successful scan
                  — only a transient banner overlays it, so the camera is
                  always ready for the next barcode instead of the whole
                  view being replaced by a dead-end confirmation screen. */}
              <div className="relative">
                <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
                {lastSent && (
                  <div
                    className={`absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white ${
                      lastSent.ok ? "bg-green-600/90" : "bg-red-600/90"
                    }`}
                  >
                    {lastSent.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {lastSent.ok ? `Sent ${lastSent.value}` : lastSent.message}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Point the camera at a batch code barcode — it sends automatically once recognized, then keeps
                scanning for the next one.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhoneScan;
