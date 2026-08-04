import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getReturnReasons } from "../../services/referenceService";
import { createReturn } from "../../services/returnsService";

function InitiateReturnModal({ record, onClose, onCreated }) {
  const returnReasons = useServiceData(getReturnReasons, []);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!record) return null;

  const handleConfirm = async () => {
    if (!reason) {
      setError("Select a reason for the return.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createReturn({ saleItemId: record.saleItemId, reason });
      onCreated();
    } catch (err) {
      if (err.code === "23505") {
        setError("A return has already been started for this item.");
      } else {
        setError(err.message || "Failed to start return. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Return Item</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {record.batchCode} · {record.device} · {record.customer}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a reason</option>
              {returnReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              This creates a pending return — resolve it with a replacement unit from After Sales.
            </p>
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
            {submitting ? "Starting..." : "Start Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InitiateReturnModal;
