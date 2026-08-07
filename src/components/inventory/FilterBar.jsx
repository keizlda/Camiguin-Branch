import { useState } from "react";
import { Search, Filter, Camera } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getDeviceCategories, getDeviceStorages, getSuppliers } from "../../services/referenceService";
import { useToast } from "../../hooks/useToast";
import ScanBarcodeModal from "../common/ScanBarcodeModal";

function FilterBar({ filters, setFilters, onApply, onClear, kinds = [] }) {
  const deviceCategories = useServiceData(getDeviceCategories, []);
  const deviceStorages = useServiceData(getDeviceStorages, []);
  const suppliers = useServiceData(getSuppliers, []);
  const statuses = ["Available", "Sold", "Reserved", "Customer Returned", "Supplier Defective", "Returned"];
  const conditions = ["Brand New", "Pre-owned"];
  const [showScan, setShowScan] = useState(false);
  const showToast = useToast();

  const update = (key, value) => setFilters({ ...filters, [key]: value });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Search Device (Batch Code)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
                placeholder="Type batch code..."
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowScan(true)}
              title="Scan a barcode into this field"
              className="flex items-center px-3 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
            >
              <Camera size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Categories</option>
            {deviceCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Storage
          </label>
          <select
            value={filters.storage}
            onChange={(e) => update("storage", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Storage</option>
            {deviceStorages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Model
          </label>
          <select
            value={filters.kind}
            onChange={(e) => update("kind", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Models</option>
            {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Supplier
          </label>
          <select
            value={filters.supplier}
            onChange={(e) => update("supplier", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Suppliers</option>
            {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
            Condition
          </label>
          <select
            value={filters.condition}
            onChange={(e) => update("condition", e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Conditions</option>
            {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.bulkShipmentOnly}
            onChange={(e) => update("bulkShipmentOnly", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Bulk shipment units only
        </label>

        <div className="flex gap-3">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={onApply}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Filter size={14} />
            Search
          </button>
        </div>
      </div>

      {showScan && (
        <ScanBarcodeModal
          onScanned={(value) => {
            update("search", value);
            setShowScan(false);
            showToast(`Scanned "${value}" — click Search to filter.`);
          }}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
}

export default FilterBar;