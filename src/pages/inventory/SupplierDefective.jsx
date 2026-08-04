import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, MoreVertical, Wrench, ShoppingBag, Truck, CheckCircle2, Info } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { getSupplierDefectiveRecords } from "../../services/inventoryService";
import { getSuppliers } from "../../services/referenceService";
import UpdateDefectiveStatusModal from "../../components/inventory/UpdateDefectiveStatusModal";
import EditDefectiveRecordModal from "../../components/inventory/EditDefectiveRecordModal";
import DateRangePicker from "../../components/common/DateRangePicker";

const statusStyles = {
  "Pending Return": "bg-orange-100 text-orange-600",
  "Returned to Supplier": "bg-blue-100 text-blue-600",
  Resolved: "bg-green-100 text-green-600",
};

const blankFilters = { dateRange: undefined, supplier: "All", status: "All", search: "" };

function SupplierDefective() {
  const suppliers = useServiceData(getSuppliers, []);
  const isAdmin = useIsAdmin();

  const [supplierDefectiveRecords, setSupplierDefectiveRecords] = useState([]);
  const loadRecords = useCallback(() => {
    getSupplierDefectiveRecords().then(setSupplierDefectiveRecords);
  }, []);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const [filters, setFilters] = useState(blankFilters);
  const [appliedFilters, setAppliedFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openMenu, setOpenMenu] = useState(null);
  const [updateRecord, setUpdateRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);

  const handleClear = () => {
    setFilters(blankFilters);
    setAppliedFilters(blankFilters);
    setPage(1);
  };

  const handleApply = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleUpdated = () => {
    setUpdateRecord(null);
    loadRecords();
  };

  const handleEdited = () => {
    setEditRecord(null);
    loadRecords();
  };

  const records = useMemo(() => {
    const f = appliedFilters;
    const from = f.dateRange?.from || null;
    const to = f.dateRange?.to || null;
    return supplierDefectiveRecords.filter((r) => {
      const detectedDate = new Date(r.dateDetected);
      const matchesSearch = !f.search || (r.batchCode || "").toLowerCase().includes(f.search.toLowerCase());
      return (
        matchesSearch &&
        (f.supplier === "All" || r.supplier === f.supplier) &&
        (f.status === "All" || r.status === f.status) &&
        (!from || detectedDate >= from) &&
        (!to || detectedDate <= to)
      );
    });
  }, [appliedFilters, supplierDefectiveRecords]);

  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const start = (page - 1) * perPage;
  const paginated = records.slice(start, start + perPage);

  const stats = [
    { label: "Total Supplier Defective", unit: "Units", value: records.length, icon: Wrench, bg: "bg-red-500", text: "text-red-600" },
    { label: "Pending Return", unit: "Unit", value: records.filter(r => r.status === "Pending Return").length, icon: ShoppingBag, bg: "bg-orange-500", text: "text-orange-600" },
    { label: "Returned to Supplier", unit: "Unit", value: records.filter(r => r.status === "Returned to Supplier").length, icon: Truck, bg: "bg-blue-500", text: "text-blue-600" },
    { label: "Resolved", unit: "Units", value: records.filter(r => r.status === "Resolved").length, icon: CheckCircle2, bg: "bg-green-500", text: "text-green-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Date Range
            </label>
            <DateRangePicker
              value={filters.dateRange}
              onChange={(range) => setFilters((f) => ({ ...f, dateRange: range }))}
            />
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Supplier
            </label>
            <select
              value={filters.supplier}
              onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending Return">Pending Return</option>
              <option value="Returned to Supplier">Returned to Supplier</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Search (Batch Code)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Type batch code..."
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
        <div className="mb-4">
          <p className="font-medium text-gray-800">
            Supplier Defective List <span className="text-gray-400 font-normal">({records.length})</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-3 py-2 font-medium">Batch Code</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Date Detected</th>
                <th className="px-3 py-2 font-medium">Issue / Defect</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Action Taken</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No supplier defective records found.
                  </td>
                </tr>
              ) : paginated.map((row, index) => (
                <tr key={row.batchCode} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{row.batchCode}</td>
                  <td className="px-3 py-3">
                    <p className="text-gray-800 font-medium whitespace-nowrap">{row.device}</p>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{row.storage} · {row.color}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{row.supplier}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                    <p>{row.dateDetected}</p>
                    <p className="text-xs text-gray-400">{row.time}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-600">• {row.issue}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyles[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">{row.actionTaken}</td>
                  <td className="px-3 py-3 text-right relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === index ? null : index)}
                      className="text-gray-400 hover:text-gray-700 p-1"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === index && (
                      <div className="absolute right-6 top-8 bg-white border border-gray-200 rounded-lg shadow-md z-10 w-40 text-left">
                        <button
                          onClick={() => { setUpdateRecord(row); setOpenMenu(null); }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          Update Status
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => { setEditRecord(row); setOpenMenu(null); }}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
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

      {/* Note banner */}
      <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700">Note:</p>
          <p className="text-xs text-red-500">
            Supplier defective items are units with issues reported and confirmed to be manufacturer/supplier
            defects. These items will be returned to the supplier for repair, replacement, or credit.
          </p>
        </div>
      </div>

      {updateRecord && (
        <UpdateDefectiveStatusModal
          record={updateRecord}
          onClose={() => setUpdateRecord(null)}
          onUpdated={handleUpdated}
        />
      )}

      {editRecord && (
        <EditDefectiveRecordModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onUpdated={handleEdited}
        />
      )}
    </div>
  );
}

export default SupplierDefective;