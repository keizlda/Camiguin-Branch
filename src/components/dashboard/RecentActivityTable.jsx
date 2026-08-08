import { useNavigate } from "react-router-dom";
import { useServiceData } from "../../hooks/useServiceData";
import { getRecentActivity } from "../../services/dashboardService";

const statusStyles = {
  Sold: "bg-blue-100 text-blue-600",
  Reserved: "bg-orange-100 text-orange-600",
  Available: "bg-green-100 text-green-600",
  "Customer Returned": "bg-purple-100 text-purple-600",
  "Supplier Defective": "bg-red-100 text-red-600",
  Returned: "bg-purple-100 text-purple-600",
};

function RecentActivityTable() {
  const navigate = useNavigate();
  const recentActivity = useServiceData(getRecentActivity, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-medium text-gray-800">Recent Device Activity</p>
        <button onClick={() => navigate("/inventory/all")} className="text-blue-600 text-sm hover:underline">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium">Batch Code</th>
              <th className="pb-2 font-medium">Device</th>
              <th className="pb-2 font-medium">Storage</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Customer</th>
              <th className="pb-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row, index) => (
              <tr key={index} className="border-b border-gray-50">
                <td className="py-3 text-gray-600">{row.batchCode}</td>
                <td className="py-3 text-gray-800 font-medium">{row.device}</td>
                <td className="py-3 text-gray-600">{row.storage}</td>
                <td className="py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="py-3">
                  {row.customer ? (
                    <>
                      <p className="text-gray-700">{row.customer}</p>
                      <p className="text-gray-400 text-xs">{row.phone}</p>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-3 text-gray-500">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecentActivityTable;