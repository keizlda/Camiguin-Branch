import { useState, useEffect, useCallback, useMemo } from "react";
import { Wallet, Info, Users2 } from "lucide-react";
import { getSupplierPayables } from "../services/bulkOrderShellsService";
import { getSalesHistory, updateSalePaymentStatus } from "../services/salesService";
import MarkPaymentModal from "../components/payables/MarkPaymentModal";
import BulkOrderDetailsModal from "../components/payables/BulkOrderDetailsModal";
import { useToast } from "../hooks/useToast";

const statusStyles = {
  Unpaid: "bg-orange-100 text-orange-600",
  Paid: "bg-green-100 text-green-600",
};

const buyerStatusStyles = {
  Pending: "bg-orange-100 text-orange-600",
  Paid: "bg-green-100 text-green-600",
};

const filterOptions = ["All", "Unpaid", "Paid"];
const buyerFilterOptions = ["All", "Pending", "Paid"];

function SupplierPayables() {
  const showToast = useToast();
  const [view, setView] = useState("suppliers"); // "suppliers" | "buyers"

  const [shells, setShells] = useState([]);
  const loadShells = useCallback(() => {
    getSupplierPayables()
      .then(setShells)
      .catch((err) => showToast(err.message || "Failed to load supplier payables. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadShells();
  }, [loadShells]);

  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentAction, setPaymentAction] = useState(null); // { shell, action }

  const filtered = useMemo(() => {
    if (statusFilter === "All") return shells;
    return shells.filter((s) => s.supplierPaymentStatus === statusFilter);
  }, [shells, statusFilter]);

  const totalOutstanding = useMemo(() => {
    return shells
      .filter((s) => s.supplierPaymentStatus === "Unpaid")
      .reduce((sum, s) => sum + (Number(s.amountPayable) || 0), 0);
  }, [shells]);

  const handleUpdated = () => {
    setPaymentAction(null);
    loadShells();
  };

  // ============ Bulk Buyers — the reverse of the above: what other
  // people/branches (bulk sales customers) owe us, not what we owe
  // suppliers. ============
  const [salesHistory, setSalesHistory] = useState([]);
  const loadSalesHistory = useCallback(() => {
    getSalesHistory()
      .then(setSalesHistory)
      .catch((err) => showToast(err.message || "Failed to load sales history. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadSalesHistory();
  }, [loadSalesHistory]);

  const [buyerFilter, setBuyerFilter] = useState("All");
  const [updatingSaleId, setUpdatingSaleId] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);

  // One row per sale_item, all sharing the same sale — grouped back into
  // one bulk order per saleId so "what they bought" lists every unit under
  // a single Paid/Pending status (payment_status lives on the sale, not
  // per unit). Keeps full per-unit detail (not just a joined name string)
  // so the "View" popup can show amount/profit per item, same shape as
  // Reports' table.
  const bulkOrders = useMemo(() => {
    const map = new Map();
    for (const row of salesHistory) {
      if (row.orderType !== "Bulk") continue;
      if (!map.has(row.saleId)) {
        map.set(row.saleId, {
          saleId: row.saleId,
          customer: row.customer?.trim() || "—",
          date: row.date,
          paymentStatus: row.paymentStatus,
          items: [],
          total: 0,
          totalProfit: 0,
        });
      }
      const order = map.get(row.saleId);
      order.items.push({
        batchCode: row.batchCode,
        unit: [row.device, row.storage].filter(Boolean).join(" · "),
        price: row.total,
        netProfit: row.netProfit,
      });
      order.total += row.total;
      order.totalProfit += row.netProfit ?? 0;
    }
    return [...map.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [salesHistory]);

  const filteredBulkOrders = useMemo(() => {
    if (buyerFilter === "All") return bulkOrders;
    return bulkOrders.filter((o) => o.paymentStatus === buyerFilter);
  }, [bulkOrders, buyerFilter]);

  const totalReceivable = useMemo(() => {
    return bulkOrders.filter((o) => o.paymentStatus === "Pending").reduce((sum, o) => sum + o.total, 0);
  }, [bulkOrders]);

  const handleToggleBuyerPayment = async (order) => {
    const nextStatus = order.paymentStatus === "Paid" ? "Pending" : "Paid";
    setUpdatingSaleId(order.saleId);
    try {
      await updateSalePaymentStatus(order.saleId, nextStatus);
      loadSalesHistory();
    } catch (err) {
      showToast(err.message || "Failed to update payment status. Please try again.", "error");
    } finally {
      setUpdatingSaleId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setView("suppliers")}
            className={`px-4 py-2 text-sm font-medium ${
              view === "suppliers" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Suppliers
          </button>
          <button
            type="button"
            onClick={() => setView("buyers")}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 ${
              view === "buyers" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Bulk Buyers
          </button>
        </div>
      </div>

      {view === "suppliers" ? (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900">
              What's owed to each supplier for a bulk shipment — based on the agreed quantity and unit cost, not just
              how many units have been individually logged so far.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="bg-red-500 w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
              <Wallet size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 leading-none">
                ₱{totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Outstanding (Unpaid shipments)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="font-medium text-gray-800">Bulk Shipments</p>
              <div className="flex gap-1.5">
                {filterOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setStatusFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      statusFilter === opt
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">Supplier</th>
                    <th className="pb-2 font-medium">Device Model</th>
                    <th className="pb-2 font-medium">Variant</th>
                    <th className="pb-2 font-medium">Qty Expected</th>
                    <th className="pb-2 font-medium">Unit Cost</th>
                    <th className="pb-2 font-medium">Amount Payable</th>
                    <th className="pb-2 font-medium">Date Arrived</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400">
                        No bulk shipments found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 text-gray-700">{s.supplierName || "—"}</td>
                        <td className="py-3 text-gray-800 font-medium">{s.deviceName}</td>
                        <td className="py-3 text-gray-600">
                          {s.storage || "—"}
                        </td>
                        <td className="py-3 text-gray-600">{s.quantityExpected}</td>
                        <td className="py-3 text-gray-600">
                          {s.unitCost != null ? `₱${Number(s.unitCost).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 text-gray-800 font-medium">
                          {s.amountPayable != null ? `₱${Number(s.amountPayable).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 text-gray-500">{s.dateArrived?.slice(0, 10)}</td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[s.supplierPaymentStatus]}`}>
                            {s.supplierPaymentStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {s.supplierPaymentStatus === "Paid" ? (
                            <button
                              onClick={() => setPaymentAction({ shell: s, action: "unpay" })}
                              className="text-sm text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50"
                            >
                              Mark as Unpaid
                            </button>
                          ) : (
                            <button
                              onClick={() => setPaymentAction({ shell: s, action: "pay" })}
                              className="text-sm text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900">
              What each bulk buyer (another branch or reseller) bought from us and whether they've settled
              it — the reverse of the Suppliers view above.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="bg-orange-500 w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
              <Users2 size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 leading-none">
                ₱{totalReceivable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Receivable (Pending bulk orders)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="font-medium text-gray-800">Bulk Orders</p>
              <div className="flex gap-1.5">
                {buyerFilterOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBuyerFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      buyerFilter === opt
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">Buyer</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">What They Bought</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBulkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No bulk orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredBulkOrders.map((o) => (
                      <tr key={o.saleId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 pr-4 text-gray-800 font-medium whitespace-nowrap">{o.customer}</td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{o.date}</td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => setViewOrder(o)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {o.items.length} unit{o.items.length === 1 ? "" : "s"} — View
                          </button>
                        </td>
                        <td className="py-3 pr-4 text-gray-800 font-medium whitespace-nowrap">
                          ₱{o.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${buyerStatusStyles[o.paymentStatus]}`}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {o.paymentStatus === "Paid" ? (
                            <button
                              onClick={() => handleToggleBuyerPayment(o)}
                              disabled={updatingSaleId === o.saleId}
                              className="text-sm text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 disabled:opacity-60"
                            >
                              Mark as Pending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleBuyerPayment(o)}
                              disabled={updatingSaleId === o.saleId}
                              className="text-sm text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-60"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {paymentAction && (
        <MarkPaymentModal
          shell={paymentAction.shell}
          action={paymentAction.action}
          onClose={() => setPaymentAction(null)}
          onUpdated={handleUpdated}
        />
      )}

      {viewOrder && <BulkOrderDetailsModal order={viewOrder} onClose={() => setViewOrder(null)} />}
    </div>
  );
}

export default SupplierPayables;
