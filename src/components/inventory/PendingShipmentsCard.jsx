import { PackagePlus } from "lucide-react";
import { formatDate } from "../../utils/datetime";

// Lets staff see what's still being entered from an overnight shipment
// placeholder (see bulk_order_shells / Log Shipment Arrival).
function PendingShipmentsCard({ shells }) {
  if (shells.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus size={16} className="text-blue-500" />
        <p className="text-sm font-semibold text-gray-700">
          Pending Shipments <span className="text-gray-400 font-normal">({shells.length})</span>
        </p>
      </div>

      <div className="space-y-3">
        {shells.map((s) => {
          const pct = Math.min(100, Math.round((s.linkedCount / s.quantityExpected) * 100));
          const variant = [s.storage, s.color].filter(Boolean).join(" · ");
          return (
            <div key={s.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-sm font-medium text-gray-800">
                  {s.deviceName}
                  {variant && <span className="text-gray-400 font-normal"> · {variant}</span>}
                </p>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {s.linkedCount}/{s.quantityExpected} logged
                </p>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {s.supplierName || "No supplier"} · arrived {formatDate(s.dateArrived)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PendingShipmentsCard;
