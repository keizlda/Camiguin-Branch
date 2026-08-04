import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { updateSupplierDefectiveStatus } from "../../services/inventoryService";

const statusOptions = ["Pending Return", "Returned to Supplier", "Resolved"];

function UpdateDefectiveStatusModal({ record, onClose, onUpdated }) {
  const [status, setStatus] = useState(record?.status || "Pending Return");
  const [actionTaken, setActionTaken] = useState(record?.actionTaken === "-" ? "" : record?.actionTaken || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!record) return null;

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      await updateSupplierDefectiveStatus(record.id, {
        status,
        actionTaken: actionTaken.trim(),
        deviceId: record.deviceId,
      });
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update status. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Update Status</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {record.batchCode} · {record.device} · {record.supplier}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Action Taken</label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              placeholder="e.g. Returned to supplier on Jul 30, replacement unit expected in 5 days"
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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

export default UpdateDefectiveStatusModal;
