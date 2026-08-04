import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, Settings, AlertTriangle, Package, TrendingUp, RotateCcw } from "lucide-react";
import { getLowStockItems } from "../../services/inventoryService";
import { getDeviceCategories } from "../../services/referenceService";
import { useServiceData } from "../../hooks/useServiceData";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import ReorderSettingsModal from "../../components/inventory/ReorderSettingsModal";

const blankFilters = { category: "All", search: "" };

function LowStock() {
  const isAdmin = useIsAdmin();
  const deviceCategories = useServiceData(getDeviceCategories, []);

  const [lowStockItems, setLowStockItems] = useState([]);
  const loadLowStockItems = useCallback(() => {
    getLowStockItems().then(setLowStockItems);
  }, []);
  useEffect(() => {
    loadLowStockItems();
  }, [loadLowStockItems]);

  const [filters, setFilters] = useState(blankFilters);
  const [appliedFilters, setAppliedFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const handleClear = () => {
    setFilters(blankFilters);
    setAppliedFilters(blankFilters);
    setPage(1);
  };

  const handleApply = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const records = useMemo(() => {
    const f = appliedFilters;
    return lowStockItems.filter((r) => {
      const matchesSearch = !f.search || r.device.toLowerCase().includes(f.search.toLowerCase());
      return matchesSearch && (f.category === "All" || r.category === f.category);
    });
  }, [appliedFilters, lowStockItems]);

  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const start = (page - 1) * perPage;
  const paginated = records.slice(start, start + perPage);

  const totalUnits = records.reduce((sum, r) => sum + r.available, 0);
  const totalValue = records.reduce((sum, r) => sum + r.estimatedValue, 0);
  const reorderNeeded = records.filter((r) => r.available < r.reorderLevel).length;

  const stats = [
    { label: "Total Low Stock Items", unit: "Models", value: records.length, icon: AlertTriangle, bg: "bg-orange-500", text: "text-orange-600" },
    { label: "Total Units", unit: "Units", value: totalUnits, icon: Package, bg: "bg-red-500", text: "text-red-600" },
    { label: "Total Estimated Value", unit: "Based on SRP", value: `₱${totalValue.toLocaleString()}`, icon: TrendingUp, bg: "bg-purple-500", text: "text-purple-600" },
    { label: "Reorder Needed", unit: "Models", value: reorderNeeded, icon: RotateCcw, bg: "bg-blue-500", text: "text-blue-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              {deviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Search (Device)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Type device name..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={handleClear} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear
          </button>
          <button onClick={handleApply} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Filter size={14} />
            Search
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-gray-800">
            Low Stock Items <span className="text-gray-400 font-normal">({records.length})</span>
          </p>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                <Settings size={14} />
                Settings
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Device</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Available Stock</th>
                <th className="pb-2 font-medium">Reorder Level</th>
                <th className="pb-2 font-medium">Estimated Value</th>
                <th className="pb-2 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No low stock items found.
                  </td>
                </tr>
              ) : paginated.map((row, index) => (
                <tr key={index} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3">
                    <p className="text-gray-800 font-medium">{row.device}</p>
                  </td>
                  <td className="py-3 text-gray-600">{row.category}</td>
                  <td className="py-3">
                    <span className="text-red-500 font-semibold">{row.available}</span>
                    <span className="text-gray-400 text-xs"> unit{row.available === 1 ? "" : "s"} left</span>
                  </td>
                  <td className="py-3 text-gray-600">{row.reorderLevel} units</td>
                  <td className="py-3 text-gray-700">
                    ₱{row.estimatedValue.toLocaleString()}
                    <span className="text-gray-400 text-xs"> (SRP)</span>
                  </td>
                  <td className="py-3 text-gray-500">
                    <p>{row.lastUpdated}</p>
                    <p className="text-xs text-gray-400">{row.time}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <p className="text-xs text-gray-500">
            Showing {records.length === 0 ? 0 : start + 1} to {Math.min(start + perPage, records.length)} of {records.length} records
          </p>
          <div className="flex items-center gap-3">
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded-lg text-xs px-2 py-1.5"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <button className="w-7 h-7 text-xs rounded-lg bg-blue-600 text-white">{page}</button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert banner */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-700">Low Stock Alert</p>
          <p className="text-xs text-yellow-600">
            These items are running low. Please restock soon to avoid loss of sales. Reorder level is the
            minimum stock level before an item is considered low — configure it per model from Settings.
          </p>
        </div>
      </div>

      {showSettings && (
        <ReorderSettingsModal onClose={() => setShowSettings(false)} onChanged={loadLowStockItems} />
      )}
    </div>
  );
}

export default LowStock;
