import { X, Printer } from "lucide-react";
import { dedupeByBatchCode } from "../../utils/dedupeByBatchCode";
import BarcodeSheetTable from "../common/BarcodeSheetTable";

// A printable # / Code / Item / Barcode table — one row per distinct batch
// code, sorted alphabetically by item name — for a wall/binder reference
// sheet staff can scan down to find or verify a code. Prints the same
// BarcodeSheetTable as Print Labels (see PrintLabelsModal.jsx) — the only
// difference between the two features is which devices get handed in
// (this one always prints every filtered device, not just a selection).
function PrintBarcodeSheetModal({ devices, onClose }) {
  const handlePrint = () => window.print();
  const rows = dedupeByBatchCode(devices).sort((a, b) => (a.device || "").localeCompare(b.device || ""));

  return (
    <>
    {/* print:hidden lives on this wrapper, not further out — same reason
        as PrintLabelsModal.jsx: the printable table below is a sibling,
        not a descendant, so an ancestor's display:none can't hide it too. */}
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">
              Print Reference Sheet {rows.length > 0 ? `(${rows.length})` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-gray-400 mb-3">
            A # / Code / Item / Barcode table for a wall or binder reference — sorted alphabetically, one row per
            batch code (not per unit), 5 rows per printed page.
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nothing matches the current filters.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
              {rows.map((d) => (
                <div key={d.batchCode} className="px-3 py-2 text-sm">
                  <p className="text-gray-800 font-medium">{d.device}</p>
                  <p className="text-xs text-gray-400">
                    {d.batchCode}
                    {[d.brand, d.storage].filter(Boolean).length > 0
                      ? ` · ${[d.brand, d.storage].filter(Boolean).join(" · ")}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>
    </div>

    <div className="hidden print:block">
      <BarcodeSheetTable rows={rows} />
    </div>
    </>
  );
}

export default PrintBarcodeSheetModal;
