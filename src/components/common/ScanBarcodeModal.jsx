import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle, Smartphone, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { BrowserCodeReader } from "@zxing/browser";
import { createBarcodeReader, SCAN_VIDEO_CONSTRAINTS } from "../../utils/barcodeScanner";
import { supabase } from "../../lib/supabaseClient";
import QRCode from "./QRCode";

// Two ways to get a barcode into the field this modal was opened from:
//
// "device" (default) — opens whatever camera is on THIS device (rear-facing
// on phones, webcam on desktop) and scans the live feed directly. Only
// useful if the device running the app actually has a camera.
//
// "phone" — for a desktop/laptop with no camera. Shows a QR code encoding
// a one-time link (/scan/:sessionId, see PhoneScan.jsx); scanning it with a
// phone's own camera app opens a lightweight public page that scans the
// real barcode and pushes the result back here over Supabase Realtime
// (broadcast, no database table — this is ephemeral, nothing needs to
// persist). The session id is an unguessable random UUID shown once, so
// that public page doesn't need its own login to be reasonably safe.
//
// onScanned is read through a ref rather than a direct effect dependency —
// callers typically pass a fresh inline function each render, and neither
// mode's effect should restart just because the caller re-rendered.
function ScanBarcodeModal({ onScanned, onClose }) {
  const [mode, setMode] = useState("device");
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;

  const [sessionId] = useState(() => crypto.randomUUID());
  const scanUrl = `${window.location.origin}/scan/${sessionId}`;

  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [deviceError, setDeviceError] = useState("");
  // Bumped by the error state's "Try Again" button to force the camera
  // effect below to re-run without needing to close and reopen the whole
  // modal — e.g. after granting a permission that was denied the first time.
  const [retryKey, setRetryKey] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (mode !== "device") return;
    setDeviceError("");
    let cancelled = false;
    // See utils/barcodeScanner.js for what's tuned here and why — capped
    // resolution, continuous autofocus where supported, Code128-only,
    // TRY_HARDER, and a much shorter gap between decode attempts.
    const reader = createBarcodeReader();

    reader
      .decodeFromConstraints(
        SCAN_VIDEO_CONSTRAINTS,
        videoRef.current,
        (result, err, controls) => {
          if (cancelled) return;
          controlsRef.current = controls;
          if (result) {
            controls.stop();
            onScannedRef.current(result.getText());
          }
          // err is the expected NotFoundException on every frame that
          // doesn't contain a decodable barcode yet — not a real failure,
          // ignored.
        }
      )
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") {
          setDeviceError("Camera access was denied. Allow camera permission for this site and try again.");
        } else if (err?.name === "NotFoundError") {
          setDeviceError("No camera was found on this device.");
        } else {
          setDeviceError("Couldn't start the camera. Please try again.");
        }
      });

    return () => {
      cancelled = true;
      // controlsRef only gets populated once the first decode callback
      // fires — if this mode is left before that (fast switch to "phone",
      // permission denial, or closing the modal), controlsRef.current
      // would still be null and the camera stream would keep running with
      // no way to reach it through the local ref. releaseAllStreams stops
      // every stream the library has opened regardless of that timing —
      // safe here since this app never has more than one scan modal open
      // at once.
      controlsRef.current?.stop();
      BrowserCodeReader.releaseAllStreams();
    };
  }, [mode, retryKey]);

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(scanUrl)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard access can fail (permissions, insecure context) — the
        // QR code itself still works as the primary path, this is only a
        // fallback for when scanning it doesn't (e.g. screen glare), so
        // silently doing nothing here just means that fallback isn't
        // available rather than breaking the modal.
      });
  };

  useEffect(() => {
    if (mode !== "phone") return;
    const channel = supabase
      .channel(`scan-${sessionId}`)
      .on("broadcast", { event: "scanned" }, ({ payload }) => {
        onScannedRef.current(payload.value);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, sessionId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">Scan Barcode</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-gray-100">
          {[
            { id: "device", label: "This Device", icon: Camera },
            { id: "phone", label: "My Phone", icon: Smartphone },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                mode === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === "device" ? (
            deviceError ? (
              <div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{deviceError}</p>
                </div>
                <button
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="flex items-center gap-1.5 mx-auto mt-3 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw size={13} />
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Point the camera at a batch code barcode — it fills in automatically once recognized.
                </p>
              </>
            )
          ) : (
            <div className="text-center">
              <QRCode value={scanUrl} className="w-40 h-40 mx-auto border border-gray-100 rounded-lg" />
              <div className="flex items-center justify-center gap-1.5 mt-3 text-sm text-gray-600">
                <Loader2 size={14} className="animate-spin" />
                Waiting for scan...
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Scan this with your phone's camera app (not the button above — your phone's own camera), then scan
                the barcode on the page that opens.
              </p>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 mx-auto mt-3 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {linkCopied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                {linkCopied ? "Copied!" : "Can't scan? Copy the link instead"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanBarcodeModal;
