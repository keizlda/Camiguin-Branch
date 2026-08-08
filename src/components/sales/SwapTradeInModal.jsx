import { useState, useEffect } from "react";
import { X, AlertTriangle, Repeat } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getProductCatalog } from "../../services/referenceService";
import { addDevice, getNextBatchSequence } from "../../services/inventoryService";
import { isAccessoryLikeCategory } from "../../data/referenceData";
import SupplierSelect from "../inventory/SupplierSelect";

function batchCodeDatePrefix() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}-`;
}

const OTHER_MODEL = "__other__";
const conditionOptions = ["Brand New", "Pre-owned"];
const repairPartConditionOptions = ["Brand New", "Genuine", "Used"];

// Logs the customer's own phone as a new unit the moment a Swap sale takes
// it in — same "quick, sale-context" shape as QuickAddDeviceModal, but for
// the trade-in side instead of stock that just wasn't logged yet. No
// Selling Price here: like a walk-in Add-on purchase, it enters as unpriced
// stock (Selling Price 0) until someone prices it for resale later — this
// modal only needs its Appraised Value, which becomes its Capital.
function SwapTradeInModal({ onClose, onCreated }) {
  const productCatalog = useServiceData(getProductCatalog, {});
  const categories = Object.keys(productCatalog);

  const [form, setForm] = useState({
    category: "iPhone",
    model: "",
    customModel: "",
    storage: "",
    condition: "Pre-owned",
    supplier: "",
    batchCode: batchCodeDatePrefix(),
    appraisedValue: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const catalog = productCatalog[form.category];
  const isOtherModel = form.model === OTHER_MODEL;
  const resolvedModel = isOtherModel ? form.customModel.trim() : form.model;
  const isRepairPart = isAccessoryLikeCategory(form.category);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Brand-prefixed, same as Add Device's generator — re-runs whenever the
  // category (and therefore its prefix) changes, and once the catalog first
  // loads for the initial category.
  useEffect(() => {
    if (!catalog) return;
    const prefix = `${catalog.prefix}${batchCodeDatePrefix()}`;
    getNextBatchSequence(prefix)
      .then((seq) => update("batchCode", `${prefix}${String(seq).padStart(3, "0")}`))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const handleCategoryChange = (category) => {
    setForm((f) => ({
      ...f,
      category,
      model: "",
      customModel: "",
      storage: "",
      condition: "Pre-owned",
      supplier: "",
    }));
  };

  const handleModelChange = (model) => {
    setForm((f) => ({ ...f, model, customModel: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const appraisedValue = Number(form.appraisedValue);
      const { id } = await addDevice({
        batchCode: form.batchCode.trim(),
        deviceName: resolvedModel,
        category: catalog.dbValue,
        storage: isRepairPart ? null : form.storage,
        color: null,
        status: "Available",
        supplierName: form.supplier,
        condition: form.condition,
        purchasePrice: appraisedValue,
        price: 0,
        notes:
          "Received via swap trade-in — no resale price set yet. Update Selling Price via Edit Device once priced.",
        dateAdded: new Date().toISOString(),
      });

      onCreated({
        id,
        batchCode: form.batchCode.trim(),
        deviceName: resolvedModel,
        category: catalog.dbValue,
        storage: isRepairPart ? null : form.storage,
        appraisedValue,
      });
    } catch (err) {
      if (err.code === "23505") {
        setError("A device with this batch code already exists.");
      } else {
        setError(err.message || "Failed to save trade-in unit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!catalog) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-blue-500" />
            <p className="font-semibold text-gray-800">Trade-In Phone (Swap)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-gray-400">
              Log the phone the customer is trading in — it's added to inventory as Available stock the moment
              you save it here.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Model <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model</option>
                  {catalog.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value={OTHER_MODEL}>Other (specify model)</option>
                </select>
              </div>
            </div>

            {isOtherModel && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Model Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customModel}
                  onChange={(e) => update("customModel", e.target.value)}
                  required
                  placeholder="Enter model name"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {!isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Storage <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.storage}
                  onChange={(e) => update("storage", e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select storage</option>
                  {catalog.storages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Condition <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.condition}
                  onChange={(e) => update("condition", e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(isRepairPart ? repairPartConditionOptions : conditionOptions).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <SupplierSelect
                  value={form.supplier}
                  onChange={(v) => update("supplier", v)}
                  category={form.category}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Use "Walk-in" for a customer trade-in.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Batch Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.batchCode}
                onChange={(e) => update("batchCode", e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-filled with the next available code — edit if needed</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Appraised Value <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={form.appraisedValue}
                  onChange={(e) => update("appraisedValue", e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                What you're crediting the customer for this phone — becomes its Capital in inventory.
              </p>
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
              {submitting ? "Saving..." : "Save Trade-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SwapTradeInModal;
