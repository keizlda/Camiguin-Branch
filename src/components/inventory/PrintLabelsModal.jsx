import { X, Printer } from "lucide-react";
import Barcode from "../common/Barcode";

// Prints one label per device — a single unit (from Add Device right after
// saving, or All Devices' row action) or a whole batch (checked rows on
// All Devices). Same dedicated-print-stylesheet + window.print() pattern as
// Reports/Financial's "Print Report": the on-screen preview here is
// print:hidden, and the actual label grid (.label-sheet, styled in
// index.css) is hidden on screen and only shown when printing.
// Matches the 6 columns x 11 rows grid in index.css's .label-sheet.
const LABELS_PER_PAGE = 66;

function PrintLabelsModal({ devices, onClose }) {
  const handlePrint = () => window.print();
  const pageCount = Math.ceil(devices.length / LABELS_PER_PAGE);

  return (
    <>
    {/* print:hidden lives on this wrapper, not further out — display:none
        on an ancestor hides everything inside it regardless of a
        descendant's own print:block, so the label sheet below is a
        sibling of this whole modal, not nested inside it. */}
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">
              Print {devices.length === 1 ? "Label" : `Labels (${devices.length})`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-gray-400 mb-3">
            Prints on a 29×21mm A4 adhesive label sheet (normal printer, not the thermal one) — 6 columns × 11
            rows, {LABELS_PER_PAGE} labels per sheet. This batch: {devices.length} label{devices.length === 1 ? "" : "s"}{" "}
            across {pageCount} page{pageCount === 1 ? "" : "s"}.
          </p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {devices.map((d) => (
              <div key={d.id} className="px-3 py-2 text-sm">
                <p className="text-gray-800 font-medium">{d.batchCode}</p>
                <p className="text-xs text-gray-400">{[d.device, d.storage, d.color].filter(Boolean).join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>
    </div>

    {/* Print-only — invisible on screen (this whole modal's print:hidden
        wrapper above never touches this, since it's a sibling, not a
        descendant), and this is all that shows when printing. */}
    <div className="hidden print:block label-sheet">
      {devices.map((d) => (
        <div key={d.id} className="label-cell">
          {/* w-full scales to the cell's content width (29mm minus the
              0.3mm padding on each side, index.css) — 28.4mm, still
              comfortably above the simulated-safe 26mm+ threshold. height
              is bar thickness, not physical size — 210 fills ~92% of the
              cell's usable vertical room (~18.7mm of ~20.4mm) without
              touching the cell's own 29x21mm footprint. overflow:hidden
              on .label-cell is the safety net if real print metrics run
              slightly larger than this estimate. */}
          <Barcode value={d.batchCode} height={210} className="w-full h-auto" />
        </div>
      ))}
    </div>
    </>
  );
}

export default PrintLabelsModal;
