import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle } from "lucide-react";
import { BrowserMultiFormatReader, BrowserCodeReader, BarcodeFormat } from "@zxing/browser";

// Opens the device camera (rear-facing on phones, webcam on desktop — both
// are just "a camera" to getUserMedia, which decodeFromVideoDevice already
// prefers environment-facing for when undefined is passed as the device id)
// and continuously scans the live feed for a Code128 barcode. Calls
// onScanned(text) and stops the camera the moment one decodes.
//
// onScanned is read through a ref rather than a direct effect dependency —
// callers typically pass a fresh inline function each render, and this
// effect should only ever run once (starting the camera stream twice would
// leak the first one).
function ScanBarcodeModal({ onScanned, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    reader.possibleFormats = [BarcodeFormat.CODE_128];

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        if (cancelled) return;
        controlsRef.current = controls;
        if (result) {
          controls.stop();
          onScannedRef.current(result.getText());
        }
        // err is the expected NotFoundException on every frame that doesn't
        // contain a decodable barcode yet — not a real failure, ignored.
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") {
          setError("Camera access was denied. Allow camera permission for this site and try again.");
        } else if (err?.name === "NotFoundError") {
          setError("No camera was found on this device.");
        } else {
          setError("Couldn't start the camera. Please try again.");
        }
      });

    return () => {
      cancelled = true;
      // controlsRef only gets populated once the first decode callback
      // fires — if the modal closes before that (fast close, permission
      // denial, or navigating away mid-getUserMedia), controlsRef.current
      // would still be null and the camera stream would keep running with
      // no way to reach it through the local ref. releaseAllStreams stops
      // every stream the library has opened regardless of that timing —
      // safe here since this app never has more than one scan modal open
      // at once.
      controlsRef.current?.stop();
      BrowserCodeReader.releaseAllStreams();
    };
  }, []);

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

        <div className="p-5">
          {error ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Point the camera at a batch code barcode — it fills in automatically once recognized.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanBarcodeModal;
