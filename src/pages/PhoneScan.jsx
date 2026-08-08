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
// httpSend (REST, not the websocket subscribe+send pattern) is used
// because this page only ever sends once and then is done — no need to
// wait for a websocket subscription to become ready first.
function PhoneScan() {
  const { sessionId } = useParams();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const hasScannedRef = useRef(false);
  const [status, setStatus] = useState("scanning"); // scanning | sent | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const channel = supabase.channel(`scan-${sessionId}`);
    // See utils/barcodeScanner.js for what's tuned here and why.
    const reader = createBarcodeReader();

    reader
      .decodeFromConstraints(
        SCAN_VIDEO_CONSTRAINTS,
        videoRef.current,
        (result, err, controls) => {
          if (cancelled || hasScannedRef.current) return;
          controlsRef.current = controls;
          if (!result) return;
          hasScannedRef.current = true;
          controls.stop();

          channel
            .httpSend("scanned", { value: result.getText() })
            .then((res) => {
              if (cancelled) return;
              if (res.success) {
                setStatus("sent");
              } else {
                setStatus("error");
                setError("Couldn't send the scan — check your connection and try reloading this page.");
              }
            })
            .catch(() => {
              if (!cancelled) {
                setStatus("error");
                setError("Couldn't send the scan — check your connection and try reloading this page.");
              }
            });
        }
      )
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        if (err?.name === "NotAllowedError") {
          setError("Camera access was denied. Allow camera permission for this site and reload the page.");
        } else if (err?.name === "NotFoundError") {
          setError("No camera was found on this device.");
        } else {
          setError("Couldn't start the camera. Please reload the page and try again.");
        }
      });

    return () => {
      cancelled = true;
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
          {status === "sent" ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 size={40} className="text-green-500" />
              <p className="font-medium text-gray-800">Sent!</p>
              <p className="text-sm text-gray-500">Check the computer — the field should be filled in now. You can close this tab.</p>
            </div>
          ) : status === "error" ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Point the camera at a batch code barcode — it sends automatically once recognized.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhoneScan;
