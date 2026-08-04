import { Smartphone, CheckCircle2, ShoppingBag, Wrench, RotateCcw, AlertTriangle } from "lucide-react";

function InventoryStats({ total, available, reserved, defective, returned, lowStock }) {
  const stats = [
    { icon: Smartphone, label: "Total Devices", unit: "Units", value: total, bg: "bg-blue-500", text: "text-blue-600" },
    { icon: CheckCircle2, label: "Available", unit: "Units", value: available, bg: "bg-green-500", text: "text-green-600" },
    { icon: ShoppingBag, label: "Reserved", unit: "Units", value: reserved, bg: "bg-orange-500", text: "text-orange-600" },
    { icon: Wrench, label: "Supplier Defective", unit: "Units", value: defective, bg: "bg-red-500", text: "text-red-600" },
    { icon: RotateCcw, label: "Returned", unit: "Unit", value: returned, bg: "bg-purple-500", text: "text-purple-600" },
    { icon: AlertTriangle, label: "Low Stock", unit: "Models", value: lowStock, bg: "bg-yellow-500", text: "text-yellow-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`${s.bg} w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className={`text-xl font-bold leading-none ${s.text}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.unit}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InventoryStats;