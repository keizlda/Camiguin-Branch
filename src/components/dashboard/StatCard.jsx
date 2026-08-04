import { Package, ShoppingBag, AlertTriangle, Wrench, RotateCcw } from "lucide-react";

const iconMap = {
  green: Package,
  blue: ShoppingBag,
  orange: AlertTriangle,
  red: Wrench,
  purple: RotateCcw,
};

const colorMap = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
};

function StatCard({ label, value, unit, color }) {
  const Icon = iconMap[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-1">
      <div className={`${colorMap[color]} w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{unit}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export default StatCard;