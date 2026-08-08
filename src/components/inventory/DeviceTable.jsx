import { useState, useEffect, useMemo } from "react";
import { Smartphone, Tablet, Watch, Laptop, Headphones, Wrench, MoreVertical, Eye, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import AccessoryBatchModal from "./AccessoryBatchModal";

const statusStyles = {
  Sold: "bg-blue-100 text-blue-600",
  Reserved: "bg-orange-100 text-orange-600",
  Available: "bg-green-100 text-green-600",
  "Customer Returned": "bg-purple-100 text-purple-600",
  "Supplier Defective": "bg-red-100 text-red-600",
  Returned: "bg-purple-100 text-purple-600",
};

const categoryIcon = {
  iPhones: Smartphone,
  iPads: Tablet,
  "Apple Watches": Watch,
  MacBooks: Laptop,
  Accessories: Headphones,
  "Repair Parts": Wrench,
};

// Bulk-identical accessories share one batch code across every unit in a
// batch (see add_device's p_quantity in schema.sql) — a plain unique
// batch_code is only enforced for serialized devices (see
// devices_batch_code_unique_serialized), so a shared code here always means
// an accessory batch, never a coincidence. Collapsing those into one row
// (instead of listing 63 identical-looking earphones one after another)
// keeps the list readable; the batch code becomes a button that opens
// AccessoryBatchModal for the individual units behind it.
function groupByBatchCode(devices) {
  const order = [];
  const byBatch = new Map();
  for (const d of devices) {
    if (!byBatch.has(d.batchCode)) {
      byBatch.set(d.batchCode, []);
      order.push(d.batchCode);
    }
    byBatch.get(d.batchCode).push(d);
  }
  return order.map((code) => {
    const units = byBatch.get(code);
    return units.length === 1 ? { type: "single", device: units[0] } : { type: "group", batchCode: code, units };
  });
}

function DeviceTable({ devices, onView, onEdit, onDelete, onPrintLabel, selectedIds, onToggleSelect, onToggleSelectAll }) {
  const isAdmin = useIsAdmin();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openMenu, setOpenMenu] = useState(null);
  const [viewingBatch, setViewingBatch] = useState(null);

  const displayRows = useMemo(() => groupByBatchCode(devices), [devices]);
  const totalPages = Math.max(1, Math.ceil(displayRows.length / perPage));

  // A new filter can shrink `devices` enough that whatever page the user
  // was already on no longer exists — without this, the table silently
  // rendered "No devices found" against a stale page number even though
  // matching rows existed on page 1 of the new, smaller result set.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const start = (page - 1) * perPage;
  const paginated = displayRows.slice(start, start + perPage);

  // Selecting "all" selects every device matching the current filters, not
  // just what's visible on this page — so a filter-then-select-all-then-
  // print workflow (e.g. "everything added today") covers the whole result
  // set, not just whichever page happens to be showing. Deliberately over
  // the raw devices list, not displayRows — a collapsed accessory row still
  // needs every one of its underlying units selected, not just its one
  // display row.
  const allSelected = devices.length > 0 && devices.every((d) => selectedIds.has(d.id));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(devices)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all"
                />
              </th>
              <th className="pb-2 font-medium">Batch Code</th>
              <th className="pb-2 font-medium">Device</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Storage</th>
              <th className="pb-2 font-medium">Color</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Date Added</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400">
                  No devices found.
                </td>
              </tr>
            ) : (
              paginated.map((entry, index) => {
                if (entry.type === "group") {
                  const { batchCode, units } = entry;
                  const first = units[0];
                  const Icon = categoryIcon[first.category] || Smartphone;
                  const groupSelected = units.every((u) => selectedIds.has(u.id));
                  const statusCounts = units.reduce((acc, u) => {
                    acc[u.status] = (acc[u.status] || 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <tr key={batchCode} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={groupSelected}
                          onChange={() => onToggleSelectAll(units)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select all ${batchCode}`}
                        />
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => setViewingBatch(units)}
                          className="text-blue-600 hover:underline"
                          title={`View all ${units.length} units on this batch code`}
                        >
                          {batchCode}
                        </button>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={15} className="text-gray-500" />
                          </div>
                          <div>
                            <span className="text-gray-800 font-medium">{first.device}</span>
                            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              ×{units.length}
                            </span>
                            {first.brand && <p className="text-xs text-gray-400">{first.brand}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-gray-600">{first.category}</td>
                      <td className="py-3 text-gray-300">—</td>
                      <td className="py-3 text-gray-300">—</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(statusCounts).map(([status, count]) => (
                            <span
                              key={status}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || ""}`}
                            >
                              {status} ×{count}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">
                        <p>{first.dateAdded}</p>
                        <p className="text-xs text-gray-400">{first.time}</p>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onPrintLabel(units)}
                          className="text-gray-400 hover:text-gray-700 p-1"
                          aria-label="Print Label"
                          title="Print Label"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                }

                const row = entry.device;
                const Icon = categoryIcon[row.category] || Smartphone;
                return (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => onToggleSelect(row.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select ${row.batchCode}`}
                      />
                    </td>
                    <td className="py-3 text-gray-600">{row.batchCode}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Icon size={15} className="text-gray-500" />
                        </div>
                        <div>
                          <span className="text-gray-800 font-medium">{row.device}</span>
                          {row.brand && <p className="text-xs text-gray-400">{row.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{row.category}</td>
                    <td className={`py-3 ${row.storage ? "text-gray-600" : "text-gray-300"}`}>{row.storage || "—"}</td>
                    <td className={`py-3 ${row.color ? "text-gray-600" : "text-gray-300"}`}>{row.color || "—"}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      <p>{row.dateAdded}</p>
                      <p className="text-xs text-gray-400">{row.time}</p>
                    </td>
                    <td className="py-3 text-right relative">
                      <div className="flex items-center justify-end gap-1">
                        {/* Printing a label doesn't touch data, so it's
                            available to every role — not folded into the
                            admin-only kebab menu below. */}
                        <button
                          onClick={() => onPrintLabel([row])}
                          className="text-gray-400 hover:text-gray-700 p-1"
                          aria-label="Print Label"
                          title="Print Label"
                        >
                          <Printer size={16} />
                        </button>
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => setOpenMenu(openMenu === index ? null : index)}
                              className="text-gray-400 hover:text-gray-700 p-1"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenu === index && (
                              <div className="absolute right-6 top-8 bg-white border border-gray-200 rounded-lg shadow-md z-10 w-32 text-left">
                                <button
                                  onClick={() => { onView(row); setOpenMenu(null); }}
                                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => { onEdit(row); setOpenMenu(null); }}
                                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { onDelete(row); setOpenMenu(null); }}
                                  className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          // Staff only ever have View available — a kebab
                          // menu hiding a single option is worse than just
                          // showing the action directly.
                          <button
                            onClick={() => onView(row)}
                            className="text-gray-400 hover:text-gray-700 p-1"
                            aria-label="View"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <p className="text-xs text-gray-500">
          Showing {displayRows.length === 0 ? 0 : start + 1} to {Math.min(start + perPage, displayRows.length)} of{" "}
          {displayRows.length} rows ({devices.length} units)
        </p>

        <div className="flex items-center gap-3">
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="border border-gray-200 rounded-lg text-xs px-2 py-1.5"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded-lg ${
                  page === p ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600"
                }`}
              >
                {p}
              </button>
            ))}
            {totalPages > 3 && <span className="text-gray-400 text-xs px-1">...</span>}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {viewingBatch && (
        <AccessoryBatchModal
          units={viewingBatch}
          onClose={() => setViewingBatch(null)}
          onView={(unit) => { setViewingBatch(null); onView(unit); }}
          onEdit={(unit) => { setViewingBatch(null); onEdit(unit); }}
          onDelete={(unit) => { setViewingBatch(null); onDelete(unit); }}
          onPrintLabel={(units) => { setViewingBatch(null); onPrintLabel(units); }}
        />
      )}
    </div>
  );
}

export default DeviceTable;