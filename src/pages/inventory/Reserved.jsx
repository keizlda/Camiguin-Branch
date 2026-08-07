import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, MoreVertical, Plus, ShoppingCart, Users, Clock, XCircle } from "lucide-react";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { getReservedDevices, cancelReservation } from "../../services/reservationsService";
import { getDeviceKind } from "../../utils/deviceKind";
import NewReservationModal from "../../components/inventory/NewReservationModal";
import ReservationDetailsModal from "../../components/inventory/ReservationDetailsModal";
import ConvertToSaleModal from "../../components/inventory/ConvertToSaleModal";
import { useToast } from "../../hooks/useToast";

const statusStyles = {
  Active: "bg-green-100 text-green-600",
  "Expiring Soon": "bg-orange-100 text-orange-600",
  Expired: "bg-red-100 text-red-600",
  Cancelled: "bg-gray-100 text-gray-500",
  Converted: "bg-blue-100 text-blue-600",
};

const daysLeftStyles = {
  Active: "text-green-500",
  "Expiring Soon": "text-orange-500",
  Expired: "text-red-500",
  Cancelled: "text-gray-400",
  Converted: "text-blue-500",
};

function daysLeftLabel(days) {
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

const blankFilters = { date: "", kind: "All", search: "" };

function Reserved() {
  const isAdmin = useIsAdmin();
  const showToast = useToast();
  const [reservedDevices, setReservedDevices] = useState([]);
  const loadReservations = useCallback(() => {
    getReservedDevices()
      .then(setReservedDevices)
      .catch((err) => showToast(err.message || "Failed to load reservations. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const [filters, setFilters] = useState(blankFilters);
  const [appliedFilters, setAppliedFilters] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openMenu, setOpenMenu] = useState(null);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [convertRecord, setConvertRecord] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const kinds = useMemo(() => {
    return [...new Set(reservedDevices.map((r) => getDeviceKind(r.device)))].sort();
  }, [reservedDevices]);

  const handleClear = () => {
    setFilters(blankFilters);
    setAppliedFilters(blankFilters);
    setPage(1);
  };

  const handleApply = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleCancelReservation = async (record) => {
    if (!window.confirm(`Cancel the reservation for ${record.batchCode}? This frees the unit back up for sale.`)) return;
    setCancellingId(record.id);
    try {
      await cancelReservation(record.id, record.deviceId);
      loadReservations();
    } catch (err) {
      showToast(err.message || "Failed to cancel reservation. Please try again.", "error");
    } finally {
      setCancellingId(null);
      setOpenMenu(null);
    }
  };

  const handleCreated = () => {
    setShowNewReservation(false);
    loadReservations();
  };

  const handleConverted = () => {
    setConvertRecord(null);
    loadReservations();
  };

  const records = useMemo(() => {
    const f = appliedFilters;
    const filterDate = f.date ? new Date(`${f.date}T00:00:00`) : null;
    return reservedDevices.filter((r) => {
      const reservedDate = new Date(r.dateReserved);
      const matchesSearch =
        !f.search ||
        (r.batchCode || "").toLowerCase().includes(f.search.toLowerCase()) ||
        (r.device || "").toLowerCase().includes(f.search.toLowerCase());
      return (
        matchesSearch &&
        (f.kind === "All" || getDeviceKind(r.device) === f.kind) &&
        (!filterDate || reservedDate.getTime() === filterDate.getTime())
      );
    });
  }, [appliedFilters, reservedDevices]);

  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const start = (page - 1) * perPage;
  const paginated = records.slice(start, start + perPage);

  // "Currently reserved" means the device is actually held right now —
  // Cancelled/Expired reservations still show in the list below for
  // history, but shouldn't count as reserved devices/value here, or these
  // cards drift from what All Devices' own Reserved count actually shows.
  const currentlyReserved = records.filter((r) => r.status === "Active" || r.status === "Expiring Soon");
  const totalValue = currentlyReserved.reduce((sum, r) => sum + r.totalPrice, 0);

  const stats = [
    { label: "Total Reserved Devices", unit: "Units", value: currentlyReserved.length, icon: ShoppingCart, bg: "bg-blue-500", text: "text-blue-600" },
    { label: "Total Reserved Value", unit: "Estimated Value", value: `₱${totalValue.toLocaleString()}`, icon: Users, bg: "bg-green-500", text: "text-green-600" },
    { label: "Expiring Soon", unit: "Reservations", value: records.filter((r) => r.status === "Expiring Soon").length, icon: Clock, bg: "bg-orange-500", text: "text-orange-600" },
    { label: "Expired Reservations", unit: "Reservations", value: records.filter((r) => r.status === "Expired").length, icon: XCircle, bg: "bg-purple-500", text: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Model
            </label>
            <select
              value={filters.kind}
              onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Models</option>
              {kinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-end min-h-[2.25rem] text-xs font-medium text-gray-500 mb-1.5">
              Search (Batch Code / Device)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Type batch code or device..."
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

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-gray-800">
            Reserved Devices List <span className="text-gray-400 font-normal">({records.length})</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewReservation(true)}
              className="flex items-center gap-2 text-sm text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} />
              New Reservation
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Batch Code</th>
                <th className="pb-2 font-medium">Date Reserved</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Salesperson</th>
                <th className="pb-2 font-medium">Device</th>
                <th className="pb-2 font-medium">Reserved Until</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Total Price</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No reservations found.
                  </td>
                </tr>
              ) : paginated.map((row, index) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3">
                    <span className="text-blue-600 font-medium">{row.batchCode}</span>
                  </td>
                  <td className="py-3 text-gray-500">
                    <p>{row.dateReserved}</p>
                    <p className="text-xs text-gray-400">{row.time}</p>
                  </td>
                  <td className="py-3">
                    <p className="text-gray-800">{row.customer}</p>
                    <p className="text-xs text-gray-400">{row.phone}</p>
                  </td>
                  <td className="py-3 text-gray-600">{row.salesperson}</td>
                  <td className="py-3">
                    <p className="text-gray-800 font-medium">{row.device}</p>
                    <p className="text-xs text-gray-400">{row.storage} · {row.color}</p>
                  </td>
                  <td className="py-3">
                    <p className="text-gray-600">{row.reservedUntil}</p>
                    <p className={`text-xs ${daysLeftStyles[row.status]}`}>
                      ({daysLeftLabel(row.daysLeft)})
                    </p>
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-700">₱{row.totalPrice.toLocaleString()}</td>
                  <td className="py-3 text-right relative">
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
                        {(row.status === "Active" || row.status === "Expiring Soon" || row.status === "Expired") && (
                          <>
                            <button
                              onClick={() => { setConvertRecord(row); setOpenMenu(null); }}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              Convert to Sale
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleCancelReservation(row)}
                                disabled={cancellingId === row.id}
                                className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50 disabled:opacity-60"
                              >
                                {cancellingId === row.id ? "Cancelling..." : "Cancel Reservation"}
                              </button>
                            )}
                          </>
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

      {showNewReservation && (
        <NewReservationModal onClose={() => setShowNewReservation(false)} onCreated={handleCreated} />
      )}

      {detailsRecord && (
        <ReservationDetailsModal record={detailsRecord} onClose={() => setDetailsRecord(null)} />
      )}

      {convertRecord && (
        <ConvertToSaleModal
          record={convertRecord}
          onClose={() => setConvertRecord(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
}

export default Reserved;