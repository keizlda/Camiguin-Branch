import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { markShellPaid, markShellUnpaid } from "../../services/bulkOrderShellsService";

// Confirms marking a shipment Paid or Unpaid — a plain confirm dialog rather
// than a form, since there's nothing to fill in, just a decision to make.
function MarkPaymentModal({ shell, action, onClose, onUpdated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isMarkingPaid = action === "pay";

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (isMarkingPaid) {
        await markShellPaid(shell.id);
      } else {
        await markShellUnpaid(shell.id);
      }
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update payment status. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">
            {isMarkingPaid ? "Mark as Paid" : "Mark as Unpaid"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {shell.supplierName || "Unknown supplier"} · {shell.deviceName} · arrived {shell.dateArrived}
          </p>
          <p className="text-sm text-gray-700">
            {isMarkingPaid ? (
              <>
                Confirm that <strong>₱{(shell.amountPayable || 0).toLocaleString()}</strong> has been paid to
                this supplier for this shipment.
              </>
            ) : (
              <>
                This will reset the shipment back to <strong>Unpaid</strong> and clear its paid date — use this
                to correct a mistaken "Mark as Paid".
              </>
            )}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
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
            className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 ${
              isMarkingPaid ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {submitting ? "Saving..." : isMarkingPaid ? "Confirm Paid" : "Confirm Unpaid"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarkPaymentModal;
