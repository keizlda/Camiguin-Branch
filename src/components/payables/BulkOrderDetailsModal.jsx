import { X } from "lucide-react";

const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });

// Always shows real amounts/profit regardless of payment status — unlike
// Reports (which hides a pending bulk order's totals until it's paid), this
// is the accounts-receivable detail view staff use to verify what's owed
// before deciding to mark it paid, so redacting numbers here would defeat
// the point.
function BulkOrderDetailsModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">{order.customer}</p>
            <p className="text-xs text-gray-400">
              {order.date} · {order.items.length} unit{order.items.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Batch Code</th>
                <th className="pb-2 font-medium">Unit Sold</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 text-gray-700 whitespace-nowrap">{item.batchCode}</td>
                  <td className="py-2.5 text-gray-800 font-medium">{item.unit}</td>
                  <td className="py-2.5 text-right text-gray-800">{peso(item.price)}</td>
                  <td
                    className={`py-2.5 text-right font-medium ${
                      item.netProfit == null ? "text-gray-400" : item.netProfit < 0 ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {item.netProfit != null ? peso(item.netProfit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-gray-800 border-t border-gray-100">
                <td className="pt-3" colSpan={2}>TOTAL</td>
                <td className="pt-3 text-right">{peso(order.total)}</td>
                <td className={`pt-3 text-right ${order.totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>
                  {peso(order.totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              order.paymentStatus === "Paid" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
            }`}
          >
            {order.paymentStatus}
          </span>
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

export default BulkOrderDetailsModal;
