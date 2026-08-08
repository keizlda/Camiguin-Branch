import { X, Printer, Eye, Pencil, Trash2 } from "lucide-react";
import { useIsAdmin } from "../../hooks/useIsAdmin";

const statusStyles = {
  Sold: "bg-blue-100 text-blue-600",
  Reserved: "bg-orange-100 text-orange-600",
  Available: "bg-green-100 text-green-600",
  "Customer Returned": "bg-purple-100 text-purple-600",
  "Supplier Defective": "bg-red-100 text-red-600",
  Returned: "bg-purple-100 text-purple-600",
};

// Bulk-identical accessories (headsets, cases) share one batch code across
// every unit — see add_device's p_quantity in schema.sql. All Devices
// collapses them to one row (DeviceTable.jsx) so a batch of 63 earphones
// doesn't drown out the rest of the list; clicking that row's batch code
// opens this to see (and act on) every individual unit behind it, same as
// View/Edit/Delete/Print already work one row at a time elsewhere in the
// table.
function AccessoryBatchModal({ units, onClose, onView, onEdit, onDelete, onPrintLabel }) {
  const isAdmin = useIsAdmin();
  const first = units[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">
              {first.device}
              {first.brand && <span className="text-gray-400 font-normal"> · {first.brand}</span>}
            </p>
            <p className="text-xs text-gray-400">
              {first.batchCode} · {units.length} unit{units.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date Added</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u, index) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-400">{index + 1}</td>
                  <td className="py-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[u.status] || ""}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-500">
                    {u.dateAdded} <span className="text-xs text-gray-400">{u.time}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onView(u)}
                        className="text-gray-400 hover:text-gray-700 p-1"
                        aria-label="View"
                        title="View"
                      >
                        <Eye size={15} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => onEdit(u)}
                            className="text-gray-400 hover:text-gray-700 p-1"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => onDelete(u)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">All {units.length} units share one printed label.</p>
          <div className="flex gap-3">
            <button
              onClick={() => onPrintLabel(units)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer size={14} />
              Print Label
            </button>
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

export default AccessoryBatchModal;
