import { useState } from "react";
import { X, AlertTriangle, Pencil } from "lucide-react";
import { editSale } from "../../services/salesService";
import { toDatetimeLocalString } from "../../utils/datetime";

// Payment methods selectable from Edit Sale — Swap is deliberately excluded
// (see isSwapLocked below) since it's tied to a specific trade-in device
// logged elsewhere, not just a payment_method string. Home Credit is no
// longer offered for new sales (replaced by PayJoy) but is added back into
// the option list below when it's the sale's current value, so an old sale
// that used it still has a valid selection to show/keep.
const BASE_PAYMENT_METHODS = ["Cash", "GCash", "Credit Card", "Bank Transfer"];
const INSTALLMENT_METHODS = ["Skyro", "PayJoy"];

// Admin-only correction for a sale after the fact — customer info, payment
// method, this unit's sold price, notes, financing/reference detail, and
// the sale/received dates. Which device was sold stays locked; changing it
// is really a delete + a new sale, not an edit (see edit_sale in
// schema.sql).
function EditSaleModal({ row, onClose, onSaved }) {
  const [customerName, setCustomerName] = useState(row.customer || "");
  const [customerPhone, setCustomerPhone] = useState(row.phone || "");
  const [priceAtSale, setPriceAtSale] = useState(String(row.total ?? ""));
  const [notes, setNotes] = useState(row.notes || "");
  const [paymentMethod, setPaymentMethod] = useState(row.payment);
  const [referenceNumber, setReferenceNumber] = useState(row.referenceNumber || "");
  const [downPayment, setDownPayment] = useState(row.downPayment != null ? String(row.downPayment) : "");
  const [soldAt, setSoldAt] = useState(toDatetimeLocalString(row.soldAt));
  const [dateAdded, setDateAdded] = useState(toDatetimeLocalString(row.dateAddedRaw));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isBulk = row.orderType === "Bulk";
  const isSwapLocked = row.payment === "Swap";

  // The sale's current value is always included even if it wouldn't
  // normally qualify (e.g. Home Credit, retired for new sales, or Skyro/
  // PayJoy on a sale whose category was reclassified as accessory-like
  // after the fact) — a select whose value matches no option renders
  // blank, which would make an untouched Payment Method look changed.
  const paymentMethodOptions = [
    ...new Set([
      ...BASE_PAYMENT_METHODS,
      ...(isBulk ? ["Check"] : []),
      ...(row.installmentEligible !== false ? INSTALLMENT_METHODS : []),
      ...(isSwapLocked ? [] : [row.payment]),
    ]),
  ];

  // Home Credit is kept selectable here only because it's this sale's
  // existing value (see paymentMethodOptions above) — never freshly chosen.
  const isFinancing = ["Skyro", "Home Credit", "PayJoy", "Credit Card"].includes(paymentMethod);

  // Down Payment/Balance live once per sale, not per unit — for a Bulk
  // order this unit's own Price Sold isn't the whole picture, so sibling
  // units' totals (passed in via row.otherUnitsTotal, see SalesHistory.jsx)
  // are added back in. This is just an on-screen preview; edit_sale
  // recomputes the real total (and balance) from every sale_item itself
  // when the sale is actually saved, so it can't drift from what's shown.
  const saleTotal = (row.otherUnitsTotal || 0) + (Number(priceAtSale) || 0);
  const balance = isFinancing && downPayment !== "" ? Math.max(0, saleTotal - Number(downPayment)) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!(Number(priceAtSale) > 0)) {
      setError("Price Sold must be greater than ₱0.");
      return;
    }
    if (isFinancing && (downPayment === "" || Number(downPayment) < 0)) {
      setError("Enter a Down Payment before saving a financed sale.");
      return;
    }
    if (isFinancing && Number(downPayment) > saleTotal) {
      setError("Down Payment cannot exceed the total price.");
      return;
    }
    setSubmitting(true);
    try {
      await editSale({
        saleItemId: row.saleItemId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim(),
        paymentMethod,
        referenceNumber: isFinancing ? "" : referenceNumber.trim(),
        downPayment: isFinancing && downPayment !== "" ? Number(downPayment) : null,
        priceAtSale: Number(priceAtSale),
        soldAt: new Date(soldAt).toISOString(),
        dateAdded: new Date(dateAdded).toISOString(),
      });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">
              Edit Sale <span className="text-gray-400 font-normal">· {row.batchCode}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {isBulk && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
                <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  This unit is part of a Bulk order — Customer, Payment Method, Notes, Reference/Financing, and Date
                  Sold are shared across the whole order, so changing them here updates every unit in it. Price Sold
                  and Date Added only affect this unit.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment Method</label>
              {isSwapLocked ? (
                <div className="w-full border border-gray-100 bg-gray-50 rounded-lg text-sm px-3 py-2 text-gray-500">
                  Swap — locked (tied to a trade-in device logged for this sale; delete and re-enter the sale to
                  change it)
                </div>
              ) : (
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {paymentMethodOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Price Sold <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={priceAtSale}
                  onChange={(e) => setPriceAtSale(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">This unit's own price — not shared with sibling units.</p>
            </div>

            {isFinancing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Down Payment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                    <input
                      type="number"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={(balance ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Price − Down Payment — fills in automatically.</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date Sold</label>
                <input
                  type="datetime-local"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date Added</label>
                <input
                  type="datetime-local"
                  value={dateAdded}
                  onChange={(e) => setDateAdded(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditSaleModal;
