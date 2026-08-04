import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { convertReservationToSale } from "../../services/reservationsService";

const paymentOptions = ["Cash", "GCash", "Credit Card", "Bank Transfer"];

function ConvertToSaleModal({ record, onClose, onConverted }) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("N/A");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!record) return null;

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      await convertReservationToSale(record.id, {
        deviceId: record.deviceId,
        customerName: record.customer,
        customerPhone: record.phone,
        totalPrice: record.totalPrice,
        downPayment: record.downPayment,
        paymentMethod,
        referenceNumber,
      });
      onConverted();
    } catch (err) {
      setError(err.message || "Failed to convert reservation to a sale. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Convert to Sale</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {record.batchCode} · {record.device} · {record.customer} · ₱{record.totalPrice.toLocaleString()}
          </p>

          {record.downPayment > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 space-y-0.5">
              <p>Down payment already collected: ₱{record.downPayment.toLocaleString()}</p>
              <p className="font-medium">
                Balance due now: ₱{Math.max(0, record.totalPrice - record.downPayment).toLocaleString()}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value === "Cash") setReferenceNumber("N/A");
              }}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {paymentOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {paymentMethod !== "Cash" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Converting..." : "Convert to Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConvertToSaleModal;
