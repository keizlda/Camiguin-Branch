import { X } from "lucide-react";

const statusStyles = {
  Replaced: "bg-green-100 text-green-600",
  Pending: "bg-orange-100 text-orange-600",
  Rejected: "bg-red-100 text-red-600",
};

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 text-right">{children}</span>
    </div>
  );
}

function ReturnDetailsModal({ record, onClose }) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Return Details</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <Row label="Batch Code">{record.batchCode}</Row>
          <Row label="Device">
            {record.device}
            <span className="text-gray-400"> · {record.storage}</span>
          </Row>
          <Row label="Customer">
            {record.customer}
            <span className="text-gray-400"> · {record.phone}</span>
          </Row>
          <Row label="Purchased">{record.purchaseDate || "—"}</Row>
          <Row label="Returned">
            {record.returnDate} <span className="text-gray-400">{record.time}</span>
          </Row>
          <Row label="Reason">{record.reason}</Row>
          <Row label="Status">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[record.status]}`}>
              {record.status}
            </span>
          </Row>
          <Row label="Replacement Unit">
            {record.replacementBatchCode ? (
              <>
                {record.replacementBatchCode}
                <span className="text-gray-400"> · {record.replacementDevice}</span>
              </>
            ) : (
              <span className="text-gray-400">No replacement issued</span>
            )}
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

export default ReturnDetailsModal;
