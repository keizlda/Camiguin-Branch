import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getDeviceCategories } from "../../services/referenceService";
import { updateDevice } from "../../services/inventoryService";
import { isAccessoryLikeCategory } from "../../data/referenceData";
import SupplierSelect from "./SupplierSelect";

const baseStatusOptions = ["Available", "Customer Returned", "Supplier Defective", "Returned"];
const conditionOptions = ["Brand New", "Pre-owned"];
const repairPartConditionOptions = ["Brand New", "Genuine", "Used"];

function EditDeviceModal({ device, onClose, onSaved }) {
  const categories = useServiceData(getDeviceCategories, []);
  // "Reserved" and "Sold" are only offered if the device already is one of
  // them — both always need a matching record elsewhere (a reservation, or
  // a real sale via New Sale) that this form can't create. Manually
  // switching a device to Reserved/Sold here would leave one with no
  // reservation/sale behind it, same bug this is closing on Add Device.
  // Switching a Sold device back to Available is still allowed — that's
  // handled as "undo this sale" by update_device, which refunds it.
  let statusOptions = baseStatusOptions;
  if (device.status === "Reserved") statusOptions = ["Reserved", ...statusOptions];
  if (device.status === "Sold") statusOptions = ["Sold", ...statusOptions];

  const [form, setForm] = useState({
    batchCode: device.batchCode || "",
    deviceName: device.device || "",
    category: device.category || "",
    storage: device.storage || "",
    brand: device.brand || "",
    status: device.status,
    condition: device.condition || "",
    supplierName: device.supplier || "",
    purchasePrice: device.purchasePrice ?? "",
    price: device.price ?? "",
    notes: device.notes || "",
    issueDescription: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isRepairPart = isAccessoryLikeCategory(form.category);

  // Setting status to Supplier Defective needs an issue description so it
  // actually creates a record on the Supplier Defective page — not just a
  // devices.status flip that goes nowhere.
  const isNewlyDefective = form.status === "Supplier Defective" && device.status !== "Supplier Defective";
  // Sold -> Available is treated as undoing the sale (update_device deletes
  // its sale record) rather than a return, so the admin should know before
  // confirming.
  const isUndoingSale = device.status === "Sold" && form.status === "Available";

  const handleConfirm = async () => {
    setError("");
    if (isNewlyDefective && !form.issueDescription.trim()) {
      setError("Describe the issue before marking this unit as Supplier Defective.");
      return;
    }
    setSubmitting(true);
    try {
      await updateDevice(device.id, {
        batchCode: form.batchCode.trim(),
        deviceName: form.deviceName.trim(),
        category: form.category,
        storage: isRepairPart ? null : form.storage.trim(),
        // No longer a field in this form — preserves whatever was already
        // recorded (if anything) instead of silently wiping it out just
        // because some other field on this device got edited.
        color: device.color ?? null,
        brand: isRepairPart ? form.brand.trim() || null : null,
        status: form.status,
        supplierName: form.supplierName,
        condition: form.condition || null,
        purchasePrice: form.purchasePrice === "" ? null : Number(form.purchasePrice),
        price: Number(form.price) || 0,
        notes: form.notes.trim(),
        issueDescription: isNewlyDefective ? form.issueDescription.trim() : null,
      });
      onSaved();
    } catch (err) {
      if (err.code === "23505") {
        setError("A device with this batch code already exists.");
      } else {
        setError(err.message || "Failed to save device. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Edit Device</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Batch Code</label>
              <input
                type="text"
                value={form.batchCode}
                onChange={(e) => update("batchCode", e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value;
                  // The supplier list is filtered by category — a supplier
                  // selected under the old category may not be valid for
                  // the new one.
                  setForm((f) => ({ ...f, category, supplierName: "" }));
                }}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Device Name</label>
            <input
              type="text"
              value={form.deviceName}
              onChange={(e) => update("deviceName", e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!isRepairPart && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Storage</label>
              <input
                type="text"
                value={form.storage}
                onChange={(e) => update("storage", e.target.value)}
                placeholder="256GB or -"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {isRepairPart && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => update("brand", e.target.value)}
                  placeholder="e.g. Anker"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => update("brand", "Various")}
                  title="This batch has mixed brands"
                  className="flex-shrink-0 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Various
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => update("condition", e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not set</option>
                {(isRepairPart ? repairPartConditionOptions : conditionOptions).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {isUndoingSale && (
                <p className="text-xs text-amber-600 mt-1">
                  This undoes the sale — it's removed from Sales History, Reports, and Financial entirely, as if it had never been sold.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier</label>
              <SupplierSelect
                value={form.supplierName}
                onChange={(v) => update("supplierName", v)}
                category={form.category}
                placeholder="None"
              />
            </div>
          </div>

          {isNewlyDefective && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Issue / Defect Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.issueDescription}
                onChange={(e) => update("issueDescription", e.target.value)}
                rows={2}
                placeholder="e.g. Volume button not working"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                This creates the record shown on the Supplier Defective page.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Capital (Purchase Price)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
              <input
                type="number"
                value={form.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="Not recorded"
                className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Selling Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
              <input
                type="number"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditDeviceModal;
