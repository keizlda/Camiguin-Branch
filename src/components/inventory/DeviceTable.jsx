import { useState } from "react";
import { Smartphone, Tablet, Watch, Laptop, Headphones, Wrench, MoreVertical, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsAdmin } from "../../hooks/useIsAdmin";

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

function DeviceTable({ devices, onView, onEdit, onDelete }) {
  const isAdmin = useIsAdmin();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openMenu, setOpenMenu] = useState(null);

  const totalPages = Math.max(1, Math.ceil(devices.length / perPage));
  const start = (page - 1) * perPage;
  const paginated = devices.slice(start, start + perPage);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
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
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  No devices found.
                </td>
              </tr>
            ) : (
              paginated.map((row, index) => {
                const Icon = categoryIcon[row.category] || Smartphone;
                return (
                  <tr key={index} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-gray-600">{row.batchCode}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Icon size={15} className="text-gray-500" />
                        </div>
                        <span className="text-gray-800 font-medium">{row.device}</span>
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
                        // Staff only ever have View available — a kebab menu
                        // hiding a single option is worse than just showing
                        // the action directly.
                        <button
                          onClick={() => onView(row)}
                          className="text-gray-400 hover:text-gray-700 p-1"
                          aria-label="View"
                        >
                          <Eye size={16} />
                        </button>
                      )}
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
          Showing {devices.length === 0 ? 0 : start + 1} to {Math.min(start + perPage, devices.length)} of {devices.length} devices
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
    </div>
  );
}

export default DeviceTable;