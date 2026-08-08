import { X, Printer } from "lucide-react";
import Barcode from "../common/Barcode";

// Dedupe by batch code — a shared-code batch (bulk-identical accessories,
// or now bulk-identical devices via the Bulk toggle, see AddDevice.jsx)
// still only needs one reference row, not one per physical unit, same
// reasoning as PrintLabelsModal.jsx's own dedupe.
function dedupeByBatchCode(devices) {
  const map = new Map();
  for (const d of devices) {
    if (!map.has(d.batchCode)) map.set(d.batchCode, d);
  }
  return [...map.values()];
}

// A printable # / Code / Item / Barcode table — one row per distinct batch
// code, sorted alphabetically by item name — for a wall/binder reference
// sheet staff can scan down to find or verify a code, distinct from
// PrintLabelsModal's small adhesive stick-on labels. Reuses the generic
// printed-table styling already set up for Financial/Reports' own "Print
// Report" (see index.css's plain @media print table rule) rather than a
// bespoke @page — an ordinary table needs nothing more specific than that.
//
// Barcode size here (height 50, ~40mm rendered width) is a first pass, not
// ruler-measured against a real print the way the stick-on label grid's
// 29x21mm spec was — worth checking a real printout before trusting it at
// scale for a long list.
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
            batch code (not per unit). Different from Print Labels, which prints small stick-on labels instead.
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
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-bold w-10">#</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">CODE</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">ITEM</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-bold">BARCODE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => {
            const variant = [d.brand, d.storage].filter(Boolean).join(" · ");
            return (
              <tr key={d.batchCode} style={{ breakInside: "avoid" }}>
                <td className="border border-gray-800 px-2 py-3 align-top">{i + 1}</td>
                <td className="border border-gray-800 px-2 py-3 align-top">{d.batchCode}</td>
                <td className="border border-gray-800 px-2 py-3 align-top">
                  <p>{d.device}</p>
                  {variant && <p className="text-xs text-gray-500">{variant}</p>}
                </td>
                <td className="border border-gray-800 px-2 py-3 align-top">
                  <div className="inline-block border border-dashed border-gray-400 px-2 py-1">
                    <Barcode value={d.batchCode} height={50} className="w-40 h-auto" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

export default PrintBarcodeSheetModal;
