import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useServiceData } from "../../hooks/useServiceData";
import { getProductCatalog } from "../../services/referenceService";
import { createBulkOrderShell } from "../../services/bulkOrderShellsService";
import { addDevice, getNextBatchSequence } from "../../services/inventoryService";
import { todayLocalDateString } from "../../utils/datetime";
import { isAccessoryLikeCategory } from "../../data/referenceData";
import SupplierSelect from "./SupplierSelect";

const OTHER_MODEL = "__other__";
// Repair parts use a different condition vocabulary than a phone — a
// screen or battery isn't "Pre-owned", it's either factory-sealed, a
// genuine pulled part, or a used/aftermarket one. Mirrors AddDevice.jsx.
const repairPartConditionOptions = ["Brand New", "Genuine", "Used"];

// Batch codes follow <PREFIX>MMDDYY-### — mirrors AddDevice.jsx's own
// generateBatchCode, duplicated here rather than shared since this modal
// only ever needs it once, silently, at submit time (no live preview or
// regenerate button the way Add Device's page-level form has room for).
function batchCodeDatePrefix() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}-`;
}

// A function (not a static object) so the modal picks up today's date each
// time it's opened, rather than whatever date happened to be current when
// the module first loaded.
function createBlankForm() {
  return {
    category: "iPhone",
    model: "",
    customModel: "",
    color: "",
    storage: "",
    brand: "",
    condition: "Brand New",
    supplier: "",
    quantityExpected: "",
    unitCost: "",
    sellingPrice: "",
    dateArrived: todayLocalDateString(),
  };
}

// Two different things happen here depending on the category:
//
// Serialized devices (phones etc.) get a quick overnight placeholder —
// staff log "20 iPhone 15 Pros arrived from iStudio" without entering a
// single unit, then link each physical device back to this shell from Add
// Device the next morning, since each one needs its own batch code and
// condition.
//
// Bulk-identical accessories/repair parts (headsets, cases) go straight
// into inventory as Available, right here — every unit in the batch is
// interchangeable, so there's no "enter them one by one later" step, and
// Selling Price is asked up front instead of per-unit in Add Device (see
// add_device's p_quantity in schema.sql). A shell still gets logged
// underneath for Supplier Payables tracking, same as the placeholder path
// below, just linked to every unit immediately instead of staying Pending.
function LogShipmentArrivalModal({ onClose, onCreated }) {
  const productCatalog = useServiceData(getProductCatalog, {});
  const categories = Object.keys(productCatalog);

  const [form, setForm] = useState(createBlankForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const catalog = productCatalog[form.category];
  const isOtherModel = form.model === OTHER_MODEL;
  const resolvedModel = isOtherModel ? form.customModel.trim() : form.model;
  const modelColors = !isOtherModel && form.model ? catalog?.modelColors[form.model] || [] : [];
  const isRepairPart = isAccessoryLikeCategory(form.category);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleCategoryChange = (category) => {
    setForm((f) => ({ ...f, category, model: "", customModel: "", color: "", storage: "", supplier: "" }));
  };

  const handleModelChange = (model) => {
    setForm((f) => ({ ...f, model, customModel: "", color: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resolvedModel) {
      setError("Select or enter a model.");
      return;
    }
    if (!form.supplier) {
      setError("Select a supplier.");
      return;
    }
    if (!form.quantityExpected || Number(form.quantityExpected) <= 0) {
      setError(isRepairPart ? "Enter how many units arrived." : "Enter how many units are expected.");
      return;
    }
    if (isRepairPart && !(Number(form.sellingPrice) > 0)) {
      setError("Enter a Selling Price greater than ₱0.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (isRepairPart) {
        const dateArrivedIso = new Date(`${form.dateArrived}T00:00:00`).toISOString();

        // Still logs a shell underneath (same as the placeholder path) so
        // this shipment keeps showing up in Supplier Payables — it just
        // gets linked to every unit in the same breath instead of staying
        // Pending until someone visits Add Device. A dropped connection
        // between this and the addDevice call below leaves an ordinary
        // Pending shell with nothing linked yet, the same recoverable state
        // the placeholder path already produces — not a stuck half-done sale.
        const shellId = await createBulkOrderShell({
          supplierName: form.supplier,
          deviceName: resolvedModel,
          storage: null,
          color: null,
          quantityExpected: Number(form.quantityExpected),
          unitCost: form.unitCost === "" ? null : Number(form.unitCost),
          dateArrived: dateArrivedIso,
        });

        const prefix = `${catalog.prefix}${batchCodeDatePrefix()}`;
        const seq = await getNextBatchSequence(prefix);
        const batchCode = `${prefix}${String(seq).padStart(3, "0")}`;

        // Mirrors AddDevice.jsx's own dateAdded logic: today's arrival
        // gets the real current timestamp, a backdated one gets that day's
        // local midnight — dateArrived (above) is separately what the
        // shell/device remember as when the shipment physically showed up.
        const isToday = form.dateArrived === todayLocalDateString();
        const dateAdded = isToday ? new Date().toISOString() : dateArrivedIso;

        await addDevice({
          batchCode,
          deviceName: resolvedModel,
          category: catalog.dbValue,
          storage: null,
          color: null,
          brand: form.brand.trim() || null,
          status: "Available",
          supplierName: form.supplier,
          price: Number(form.sellingPrice),
          purchasePrice: form.unitCost === "" ? null : Number(form.unitCost),
          condition: form.condition,
          dateAdded,
          bulkOrderShellId: shellId,
          dateArrived: dateArrivedIso,
          quantity: Number(form.quantityExpected),
        });
        onCreated(batchCode);
      } else {
        await createBulkOrderShell({
          supplierName: form.supplier,
          deviceName: resolvedModel,
          storage: form.storage,
          color: form.color,
          quantityExpected: Number(form.quantityExpected),
          unitCost: form.unitCost === "" ? null : Number(form.unitCost),
          dateArrived: new Date(`${form.dateArrived}T00:00:00`).toISOString(),
        });
        onCreated();
      }
    } catch (err) {
      setError(err.message || "Failed to log shipment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!catalog) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">Log Shipment Arrival</p>
            <p className="text-xs text-gray-400">
              {isRepairPart
                ? "Every unit in this batch is identical — quantity and price go in once, right here."
                : "Record that a bulk shipment arrived — log each unit individually later via Add Device."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
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
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model</option>
                  {catalog.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value={OTHER_MODEL}>Other (specify model)</option>
                </select>
                {isOtherModel && (
                  <input
                    type="text"
                    value={form.customModel}
                    onChange={(e) => update("customModel", e.target.value)}
                    placeholder="Enter model name"
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>

            {!isRepairPart && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Color <span className="text-gray-400 font-normal">(optional — leave blank if mixed)</span>
                  </label>
                  {isOtherModel ? (
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => update("color", e.target.value)}
                      placeholder="Enter color"
                      className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <select
                      value={form.color}
                      onChange={(e) => update("color", e.target.value)}
                      disabled={!form.model}
                      className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">{form.model ? "Any color" : "Select a model first"}</option>
                      {modelColors.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Storage <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={form.storage}
                    onChange={(e) => update("storage", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any storage</option>
                    {catalog.storages.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {isRepairPart ? "Quantity" : "Quantity Expected"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.quantityExpected}
                  onChange={(e) => update("quantityExpected", e.target.value)}
                  placeholder="20"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Unit Cost (Capital) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input
                    type="number"
                    value={form.unitCost}
                    onChange={(e) => update("unitCost", e.target.value)}
                    placeholder="Per unit"
                    className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {isRepairPart
                    ? "What we pay the supplier per unit — this batch's Capital."
                    : "What we pay the supplier per unit, for the payables total"}
                </p>
              </div>
            </div>

            {isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Brand <span className="text-gray-400 font-normal">(optional)</span>
                </label>
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
                <p className="text-xs text-gray-400 mt-1">
                  Click Various if this shipment is a mixed-brand box, not one single brand.
                </p>
              </div>
            )}

            {isRepairPart && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Selling Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                    <input
                      type="number"
                      value={form.sellingPrice}
                      onChange={(e) => update("sellingPrice", e.target.value)}
                      placeholder="Per unit"
                      required
                      className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Same price for every unit in this batch.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Condition</label>
                  <select
                    value={form.condition}
                    onChange={(e) => update("condition", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {repairPartConditionOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Date Arrived <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.dateArrived}
                  onChange={(e) => update("dateArrived", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
              {submitting ? "Saving..." : isRepairPart ? "Add to Inventory" : "Log Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LogShipmentArrivalModal;
