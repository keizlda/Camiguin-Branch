import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MoreVertical,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getCustomerReturns, rejectReturn } from "../../services/returnsService";
import { getReturnReasons } from "../../services/referenceService";
import ReturnDetailsModal from "../../components/aftersales/ReturnDetailsModal";
import ReplaceReturnModal from "../../components/aftersales/ReplaceReturnModal";
import DateRangePicker from "../../components/common/DateRangePicker";
import { useToast } from "../../hooks/useToast";

const statusStyles = {
  Replaced: "bg-green-100 text-green-600",
  Pending: "bg-orange-100 text-orange-600",
  Rejected: "bg-red-100 text-red-600",
};

function CustomerReturns() {
  const showToast = useToast();
  const returnReasons = useServiceData(getReturnReasons, []);

  const [customerReturns, setCustomerReturns] = useState([]);
  const loadReturns = useCallback(() => {
    getCustomerReturns().then(setCustomerReturns);
  }, []);
  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const [dateRange, setDateRange] = useState();
  const [status, setStatus] = useState("All");
  const [reason, setReason] = useState("All");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState("desc");
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [replaceRecord, setReplaceRecord] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const from = dateRange?.from || null;
  const to = dateRange?.to || null;

  const filtered = customerReturns.filter((r) => {
    if (status !== "All" && r.status !== status) return false;
    if (reason !== "All" && !r.reason.startsWith(reason)) return false;
    const returnDate = new Date(r.returnDate);
    if (from && returnDate < from) return false;
    if (to && returnDate > to) return false;
    if (
      appliedSearch &&
      !(r.batchCode || "").toLowerCase().includes(appliedSearch.toLowerCase()) &&
      !(r.customer || "").toLowerCase().includes(appliedSearch.toLowerCase())
    )
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(`${a.returnDate} ${a.time}`);
    const db = new Date(`${b.returnDate} ${b.time}`);
    return sortDir === "asc" ? da - db : db - da;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const replaced = customerReturns.filter((r) => r.status === "Replaced");
  const pending = customerReturns.filter((r) => r.status === "Pending");
  const rejected = customerReturns.filter((r) => r.status === "Rejected");

  const handleApply = () => {
    setAppliedSearch(search);
    setPage(1);
  };

  const handleClear = () => {
    setDateRange(undefined);
    setStatus("All");
    setReason("All");
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const toggleSort = () => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  };

  const handleReject = async (record) => {
    if (!window.confirm(`Reject the return for ${record.batchCode}? This cannot be undone.`)) return;
    setRejectingId(record.id);
    try {
      await rejectReturn(record.id);
      loadReturns();
    } catch (err) {
      showToast(err.message || "Failed to reject return. Please try again.", "error");
    } finally {
      setRejectingId(null);
      setOpenMenu(null);
    }
  };

  const handleReplaced = () => {
    setReplaceRecord(null);
    loadReturns();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Range</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Replaced">Replaced</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Reasons</option>
              {returnReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Search (Batch Code / Customer)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type batch code or customer..."
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Filter size={14} />
            Search
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
            <RotateCcw size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Returns</p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{customerReturns.length}</p>
            <p className="text-xs text-gray-400">Returns</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Replaced Returns</p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{replaced.length}</p>
            <p className="text-xs text-gray-400">Returns</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Pending Returns</p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{pending.length}</p>
            <p className="text-xs text-gray-400">Returns</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <XCircle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Rejected Returns</p>
            <p className="text-xl font-bold text-gray-800 leading-tight">{rejected.length}</p>
            <p className="text-xs text-gray-400">Returns</p>
          </div>
        </div>
      </div>

      {/* Returns table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="mb-4">
          <p className="font-medium text-gray-800">Customer Returns List</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-3 py-2 font-medium">Batch Code</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">
                  <button onClick={toggleSort} className="flex items-center gap-1 hover:text-gray-600">
                    Return Date
                    {sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">No returns found.</td>
                </tr>
              ) : (
                paged.map((row, index) => (
                  <tr key={row.batchCode} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-3 text-blue-600 font-medium whitespace-nowrap">{row.batchCode}</td>
                    <td className="px-3 py-3">
                      <p className="text-gray-800">{row.customer}</p>
                      <p className="text-xs text-gray-400">{row.phone}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-gray-800 font-medium">{row.device}</p>
                      <p className="text-xs text-gray-400">{row.storage} · {row.color}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{row.reason}</td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                      <p>{row.returnDate}</p>
                      <p className="text-xs text-gray-400">{row.time}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
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
                            onClick={() => { setDetailsRecord(row); setOpenMenu(null); }}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            View Details
                          </button>
                          {row.status === "Pending" && (
                            <>
                              <button
                                onClick={() => { setReplaceRecord(row); setOpenMenu(null); }}
                                className="block w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-gray-50"
                              >
                                Replace Return
                              </button>
                              <button
                                onClick={() => handleReject(row)}
                                disabled={rejectingId === row.id}
                                className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50 disabled:opacity-60"
                              >
                                {rejectingId === row.id ? "Rejecting..." : "Reject Return"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Showing {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, sorted.length)} of {sorted.length} returns
          </p>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-7 w-7 flex items-center justify-center rounded-md text-xs font-medium ${
                    page === p ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <span className="font-medium">Note:</span>
        <span>Returns are resolved with a replacement unit of the same model — no cash refunds.</span>
      </div>

      {detailsRecord && (
        <ReturnDetailsModal record={detailsRecord} onClose={() => setDetailsRecord(null)} />
      )}

      {replaceRecord && (
        <ReplaceReturnModal
          record={replaceRecord}
          onClose={() => setReplaceRecord(null)}
          onReplaced={handleReplaced}
        />
      )}
    </div>
  );
}

export default CustomerReturns;