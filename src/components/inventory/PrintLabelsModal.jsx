import { X, Printer } from "lucide-react";
import { dedupeByBatchCode } from "../../utils/dedupeByBatchCode";
import BarcodeSheetTable from "../common/BarcodeSheetTable";

// Prints one reference-sheet row per device — a single unit (from Add
// Device right after saving, or All Devices' row action) or a whole batch
// (checked rows on All Devices) — on the same BarcodeSheetTable as Print
// Reference Sheet (PrintBarcodeSheetModal.jsx), so the two only differ in
// which devices get handed in (this one is always an explicit selection,
// not "every filtered device"). Used to print small adhesive stick-on
// labels sized for a specialty A4 label sheet; everything now prints on
// plain bondpaper instead.
function PrintLabelsModal({ devices, onClose }) {
  const handlePrint = () => window.print();
  const labels = dedupeByBatchCode(devices);
  const pageCount = Math.ceil(labels.length / 5);

  return (
    <>
    {/* print:hidden lives on this wrapper, not further out — display:none
        on an ancestor hides everything inside it regardless of a
        descendant's own print:block, so the printable table below is a
        sibling of this whole modal, not nested inside it. */}
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">
              Print {labels.length === 1 ? "Label" : `Labels (${labels.length})`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-gray-400 mb-3">
            Prints a # / Code / Item / Barcode reference row per batch code on plain paper — 5 rows per page. This
            batch: {labels.length} row{labels.length === 1 ? "" : "s"} across {pageCount} page{pageCount === 1 ? "" : "s"}.
          </p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {labels.map((d) => (
              <div key={d.batchCode} className="px-3 py-2 text-sm">
                <p className="text-gray-800 font-medium">
                  {d.batchCode}
                  {d.count > 1 && (
                    <span className="text-xs text-gray-400 font-normal"> · {d.count} units, 1 row</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{[d.device, d.storage].filter(Boolean).join(" · ")}</p>
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
    <div className="hidden print:block">
      <BarcodeSheetTable rows={labels} />
    </div>
    </>
  );
}

export default PrintLabelsModal;
