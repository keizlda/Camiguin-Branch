import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { editSupplierDefectiveRecord } from "../../services/inventoryService";
import { toDatetimeLocalString } from "../../utils/datetime";
import SupplierSelect from "./SupplierSelect";

// Admin-only correction of a supplier defective record's own fields — the
// separate "Update Status" action still owns status/action taken, this
// covers what was wrong at the time it was logged instead.
function EditDefectiveRecordModal({ record, onClose, onUpdated }) {
  const [issueDescription, setIssueDescription] = useState(record?.issue || "");
  const [supplier, setSupplier] = useState(record?.supplier || "");
  const [dateDetected, setDateDetected] = useState(toDatetimeLocalString(record?.dateDetectedRaw));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!record) return null;

  const handleConfirm = async () => {
    if (!issueDescription.trim()) {
      setError("Issue / Defect description is required.");
      return;
    }
    // Without this, clearing the field (reachable by deleting its
    // sub-fields) let `new Date("")` reach .toISOString() below, which
    // throws a raw "Invalid time value" instead of a clear prompt.
    if (!dateDetected) {
      setError("Date Detected is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await editSupplierDefectiveRecord(record.id, {
        issueDescription: issueDescription.trim(),
        supplierName: supplier,
        dateDetected: new Date(dateDetected).toISOString(),
      });
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to save changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Edit Defective Record</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {record.batchCode} · {record.device}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Issue / Defect Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier</label>
            <SupplierSelect value={supplier} onChange={setSupplier} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date Detected</label>
            <input
              type="datetime-local"
              value={dateDetected}
              onChange={(e) => setDateDetected(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditDefectiveRecordModal;
