import { X, Printer } from "lucide-react";
import { formatDate, formatTime } from "../../utils/datetime";

const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// receipt shape: { soldAt, customerName, customerPhone, salesperson,
// paymentMethod, paymentStatus, referenceNumber, notes, downPayment,
// balance, items: [{ device, storage, color, batchCode, price }] }
//
// Same dedicated-print-stylesheet + window.print() pattern as Reports/
// Labels: the on-screen preview is print:hidden, and .receipt-print (styled
// in index.css) is hidden on screen and only shown when printing, in a
// narrow receipt-width column rather than a full-width page.
function PrintReceiptModal({ receipt, onClose }) {
  const subtotal = receipt.items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const handlePrint = () => window.print();

  return (
    <>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">Print Receipt</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto text-sm">
          <p className="text-xs text-gray-400 mb-3">
            {receipt.items.length} unit{receipt.items.length === 1 ? "" : "s"} · {peso(subtotal)} total
          </p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {receipt.items.map((item, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-gray-800 font-medium">{item.device}</p>
                  <p className="text-xs text-gray-400">
                    {[item.storage, item.color, item.batchCode].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="text-gray-700 flex-shrink-0">{peso(item.price)}</p>
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

    {/* Print-only — invisible on screen, shown only when printing */}
    <div className="hidden print:block receipt-print">
      <div className="text-center mb-3">
        <p className="font-bold text-base">Mark Gadgets CGN</p>
        <p className="text-xs">
          {formatDate(receipt.soldAt)} {formatTime(receipt.soldAt)}
        </p>
      </div>

      {(receipt.customerName || receipt.customerPhone) && (
        <div className="text-xs mb-2 border-t border-b border-dashed border-gray-400 py-1.5">
          {receipt.customerName && <p>Customer: {receipt.customerName}</p>}
          {receipt.customerPhone && <p>Phone: {receipt.customerPhone}</p>}
        </div>
      )}

      <div className="text-xs border-b border-dashed border-gray-400 pb-1.5 mb-1.5">
        {receipt.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-2 py-0.5">
            <div>
              <p>{item.device}</p>
              <p className="text-[10px]">
                {[item.storage, item.color, item.batchCode].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="flex-shrink-0">{peso(item.price)}</p>
          </div>
        ))}
      </div>

      <div className="text-xs space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{peso(subtotal)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-400 pt-1 mt-1">
          <span>Total</span>
          <span>{peso(subtotal)}</span>
        </div>
      </div>

      <div className="text-xs mt-2 pt-1.5 border-t border-dashed border-gray-400 space-y-0.5">
        <div className="flex justify-between">
          <span>Payment Method</span>
          <span>{receipt.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>Payment Status</span>
          <span>{receipt.paymentStatus}</span>
        </div>
        {receipt.referenceNumber && receipt.referenceNumber !== "N/A" && (
          <div className="flex justify-between">
            <span>Reference #</span>
            <span>{receipt.referenceNumber}</span>
          </div>
        )}
        {receipt.downPayment != null && (
          <div className="flex justify-between">
            <span>Down Payment</span>
            <span>{peso(receipt.downPayment)}</span>
          </div>
        )}
        {receipt.balance != null && (
          <div className="flex justify-between">
            <span>Balance</span>
            <span>{peso(receipt.balance)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Served by</span>
          <span>{receipt.salesperson || "—"}</span>
        </div>
      </div>

      {receipt.notes && (
        <p className="text-[10px] mt-2 pt-1.5 border-t border-dashed border-gray-400">{receipt.notes}</p>
      )}

      <p className="text-center text-[10px] mt-3">Thank you!</p>
    </div>
    </>
  );
}

export default PrintReceiptModal;
