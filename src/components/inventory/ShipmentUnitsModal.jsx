import { X, Printer } from "lucide-react";

const statusStyles = {
  Sold: "bg-blue-100 text-blue-600",
  Reserved: "bg-orange-100 text-orange-600",
  Available: "bg-green-100 text-green-600",
  "Customer Returned": "bg-purple-100 text-purple-600",
  "Supplier Defective": "bg-red-100 text-red-600",
  Returned: "bg-purple-100 text-purple-600",
};

// Lists every unit logged against one bulk shipment (one supplier, one day) —
// opened from the grouped shipment row on All Devices so staff don't have to
// hunt through the full device list to see what's actually arrived so far.
// Print Labels here is scoped to exactly group.units — this shipment's own
// logged units, not the checkbox-selected rows elsewhere on All Devices —
// so a whole order's barcodes can be printed in one go without hunting
// them down individually in the full list.
function ShipmentUnitsModal({ group, onClose, onView, onPrintLabels }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">{group.deviceName}</p>
            <p className="text-xs text-gray-400">
              {group.supplierName || "Unknown supplier"} · arrived {group.dateArrived}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {group.units.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No units logged against this shipment yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Batch Code</th>
                  <th className="pb-2 font-medium">Storage</th>
                  <th className="pb-2 font-medium">Color</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {group.units.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => onView(u)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-2.5 text-gray-700">{u.batchCode}</td>
                    <td className="py-2.5 text-gray-600">{u.storage}</td>
                    <td className="py-2.5 text-gray-600">{u.color}</td>
                    <td className="py-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{u.dateAdded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {group.units.length} of {group.quantityExpected} expected unit{group.quantityExpected === 1 ? "" : "s"} logged
          </p>
          <div className="flex gap-3">
            {group.units.length > 0 && (
              <button
                onClick={() => onPrintLabels(group.units)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Printer size={14} />
                Print Labels ({group.units.length})
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShipmentUnitsModal;
