import { X } from "lucide-react";

const statusStyles = {
  Active: "bg-green-100 text-green-600",
  "Expiring Soon": "bg-orange-100 text-orange-600",
  Expired: "bg-red-100 text-red-600",
  Cancelled: "bg-gray-100 text-gray-600",
  Converted: "bg-blue-100 text-blue-600",
};

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 text-right">{children}</span>
    </div>
  );
}

function ReservationDetailsModal({ record, onClose }) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Reservation Details</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <Row label="Batch Code">{record.batchCode}</Row>
          <Row label="Device">
            {record.device}
            <span className="text-gray-400"> · {record.storage} · {record.color}</span>
          </Row>
          <Row label="Customer">
            {record.customer}
            <span className="text-gray-400"> · {record.phone}</span>
          </Row>
          <Row label="Salesperson">{record.salesperson}</Row>
          <Row label="Date Reserved">
            {record.dateReserved} <span className="text-gray-400">{record.time}</span>
          </Row>
          <Row label="Reserved Until">{record.reservedUntil}</Row>
          <Row label="Status">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[record.status] || ""}`}>
              {record.status}
            </span>
          </Row>
          <Row label="Total Price">₱{record.totalPrice.toLocaleString()}</Row>
          <Row label="Down Payment">₱{(record.downPayment || 0).toLocaleString()}</Row>
          <Row label="Balance Due">
            ₱{Math.max(0, record.totalPrice - (record.downPayment || 0)).toLocaleString()}
          </Row>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReservationDetailsModal;
