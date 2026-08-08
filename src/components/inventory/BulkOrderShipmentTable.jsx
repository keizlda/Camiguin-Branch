import { Layers } from "lucide-react";

const shellStatusStyles = {
  Pending: "bg-orange-100 text-orange-600",
  Completed: "bg-green-100 text-green-600",
};

// One row per bulk shipment (supplier + day) instead of one row per unit —
// used on All Devices when "Bulk shipment units only" is checked, so staff
// can see shipments at a glance instead of scrolling through every unit.
function BulkOrderShipmentTable({ groups, onViewUnits }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="pb-2 font-medium">Supplier</th>
            <th className="pb-2 font-medium">Model</th>
            <th className="pb-2 font-medium">Variant</th>
            <th className="pb-2 font-medium">Date Arrived</th>
            <th className="pb-2 font-medium">Units</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-gray-400">
                No bulk shipments found.
              </td>
            </tr>
          ) : (
            groups.map((g) => (
              <tr key={g.shellId} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 text-gray-700">{g.supplierName || "—"}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Layers size={15} className="text-gray-500" />
                    </div>
                    <span className="text-gray-800 font-medium">{g.deviceName}</span>
                  </div>
                </td>
                <td className="py-3 text-gray-600">
                  {g.storage || "—"}
                </td>
                <td className="py-3 text-gray-500">{g.dateArrived}</td>
                <td className="py-3 text-gray-600">
                  {g.units.length}
                  {g.quantityExpected ? ` / ${g.quantityExpected}` : ""} logged
                </td>
                <td className="py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${shellStatusStyles[g.status] || "bg-gray-100 text-gray-600"}`}>
                    {g.status || "—"}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => onViewUnits(g)}
                    className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    View Units
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default BulkOrderShipmentTable;
