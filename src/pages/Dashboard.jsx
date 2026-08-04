import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ShoppingCart, RotateCcw, FileText } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import SalesChart from "../components/dashboard/SalesChart";
import InventoryDonut from "../components/dashboard/InventoryDonut";
import LowStockAlerts from "../components/dashboard/LowStockAlerts";
import RecentActivityTable from "../components/dashboard/RecentActivityTable";
import DeviceDetailsModal from "../components/inventory/DeviceDetailsModal";
import { useServiceData } from "../hooks/useServiceData";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { getAllDevices, getLowStockItems } from "../services/inventoryService";
import { getSalesHistory } from "../services/salesService";
import { getDeviceCategories } from "../services/referenceService";

const categoryColors = {
  iPhones: "#3b82f6",
  iPads: "#22c55e",
  "Apple Watches": "#f97316",
  MacBooks: "#a855f7",
};

function Dashboard() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  const allDevices = useServiceData(getAllDevices, []);
  const lowStockItems = useServiceData(getLowStockItems, []);
  const salesHistory = useServiceData(getSalesHistory, []);
  const deviceCategories = useServiceData(getDeviceCategories, []);

  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState(null);

  const searchResults = deviceSearch.trim()
    ? allDevices
        .filter((d) => {
          const q = deviceSearch.toLowerCase();
          return d.batchCode?.toLowerCase().includes(q);
        })
        .slice(0, 8)
    : [];

  const handleSelectDevice = (device) => {
    setSelectedDevice(device);
    setDeviceSearch("");
  };

  const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const statCards = [
    { label: "Available", value: allDevices.filter((d) => d.status === "Available").length, unit: "Units", color: "green" },
    { label: "Sold Today", value: salesHistory.filter((s) => s.date === todayStr).length, unit: "Units", color: "blue" },
    { label: "Low Stock", value: lowStockItems.length, unit: "Models", color: "orange" },
    { label: "Supplier Defective", value: allDevices.filter((d) => d.status === "Supplier Defective").length, unit: "Units", color: "red" },
    { label: "Returned", value: allDevices.filter((d) => d.status === "Returned" || d.status === "Customer Returned").length, unit: "Units", color: "purple" },
  ];

  const totalDevices = allDevices.length;
  const inventoryByCategory = deviceCategories.map((cat) => {
    const value = allDevices.filter((d) => d.category === cat).length;
    return {
      name: cat,
      value,
      percent: totalDevices ? Number(((value / totalDevices) * 100).toFixed(1)) : 0,
      color: categoryColors[cat],
    };
  });

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Search Device (Batch Code)
        </p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={deviceSearch}
            onChange={(e) => setDeviceSearch(e.target.value)}
            placeholder="Type batch code..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {deviceSearch.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md z-10 max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No devices found.</p>
              ) : (
                searchResults.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDevice(d)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-800">{d.device}</p>
                    <p className="text-xs text-gray-400">
                      {d.batchCode} · {d.status}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 flex-wrap">
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate("/inventory/add")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Device
        </button>
        <button
          onClick={() => navigate("/sales/new")}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600"
        >
          <ShoppingCart size={16} />
          New Sale
        </button>
        <button
          onClick={() => navigate("/after-sales/customer-returns")}
          className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-600"
        >
          <RotateCcw size={16} />
          Customer Return
        </button>
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <FileText size={16} />
          View Reports
        </button>
      </div>

      {/* Charts + alerts row — Sales This Month is financial info, admin-only */}
      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {isAdmin && <SalesChart />}
        <InventoryDonut data={inventoryByCategory} />
        <LowStockAlerts />
      </div>

      {/* Recent activity */}
      <RecentActivityTable />

      {selectedDevice && (
        <DeviceDetailsModal device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}
    </div>
  );
}

export default Dashboard;