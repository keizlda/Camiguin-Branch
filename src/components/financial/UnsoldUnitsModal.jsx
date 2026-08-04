import { X } from "lucide-react";

const statusStyles = {
  Available: "bg-green-100 text-green-600",
  Reserved: "bg-orange-100 text-orange-600",
  "Customer Returned": "bg-purple-100 text-purple-600",
  "Supplier Defective": "bg-red-100 text-red-600",
  Returned: "bg-purple-100 text-purple-600",
};

const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });

// Every unit behind Financial's "Units In Stock" card — everything not yet
// Sold, the same set counted into Capital Tied Up.
function UnsoldUnitsModal({ units, onClose, onView }) {
  const totalCapital = units.reduce((sum, u) => sum + (u.purchasePrice || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">Units In Stock</p>
            <p className="text-xs text-gray-400">Every unit not yet Sold, across every status</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {units.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nothing currently unsold.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Batch Code</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Condition</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Supplier</th>
                  <th className="pb-2 font-medium text-right">Capital</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => onView(u)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-2.5 text-gray-700">{u.batchCode}</td>
                    <td className="py-2.5 text-gray-800 font-medium">
                      {[u.device, u.storage, u.color].filter(Boolean).join(" · ")}
                    </td>
                    <td className="py-2.5 text-gray-600">{u.condition || "—"}</td>
                    <td className="py-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[u.status] || "bg-gray-100 text-gray-600"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600">{u.supplier || "—"}</td>
                    <td className="py-2.5 text-right text-gray-700">
                      {u.purchasePrice != null ? peso(u.purchasePrice) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {units.length} unit{units.length === 1 ? "" : "s"} · {peso(totalCapital)} capital tied up
          </p>
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

export default UnsoldUnitsModal;
