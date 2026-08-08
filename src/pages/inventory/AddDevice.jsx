import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Info, AlertTriangle, ClipboardList, Fingerprint, Eye, Calendar, Smartphone, PackagePlus, Settings, RefreshCw, Printer, Camera } from "lucide-react";
import { getProductCatalog } from "../../services/referenceService";
import { addDevice, getNextBatchSequence } from "../../services/inventoryService";
import { getPendingShellsWithProgress } from "../../services/bulkOrderShellsService";
import { isAccessoryLikeCategory } from "../../data/referenceData";
import { formatDate, todayLocalDateString } from "../../utils/datetime";
import SupplierSelect from "../../components/inventory/SupplierSelect";
import ManageCatalogModal from "../../components/inventory/ManageCatalogModal";
import PrintLabelsModal from "../../components/inventory/PrintLabelsModal";
import ScanBarcodeModal from "../../components/common/ScanBarcodeModal";
import { useToast } from "../../hooks/useToast";
import { useIsAdmin } from "../../hooks/useIsAdmin";

// Batch codes follow <PREFIX>MMDDYY-### (e.g. SS073026-004) — the brand
// prefix comes from the currently selected category's catalog entry
// (categories.prefix in the database), so this only ever builds the
// date+sequence part; generateBatchCode below prepends the prefix.
function batchCodeDatePrefix() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}-`;
}

function formatShellLabel(shell) {
  const variant = [shell.storage, shell.color].filter(Boolean).join(" · ");
  const arrived = formatDate(shell.dateArrived);
  return `${shell.deviceName}${variant ? " · " + variant : ""} — arrived ${arrived} (${shell.linkedCount}/${shell.quantityExpected} logged)`;
}

// "Reserved" isn't offered here — reserving a unit always needs a customer,
// a reserved-until date, and a price, none of which this form captures.
// Setting status straight to Reserved would leave a device that LOOKS
// reserved everywhere else in the app with no reservation record behind
// it. Use "New Reservation" on the Reserved page instead, once this unit
// is Available.
const statusOptions = [
  { label: "Available", color: "bg-green-500" },
  { label: "Supplier Defective", color: "bg-red-500" },
];

const OTHER_MODEL = "__other__";
const OTHER_CATEGORY = "__other_category__";
const conditionOptions = ["Brand New", "Pre-owned"];
// Repair parts use a different condition vocabulary — a screen or battery
// isn't "Pre-owned", it's either factory-sealed, a genuine pulled Apple
// part, or a used/aftermarket one.
const repairPartConditionOptions = ["Brand New", "Genuine", "Used"];

// A function (not a static object) so every fresh form — including the one
// after "Save & Add Another" — picks up the current date rather than
// whatever date happened to be current when the page first loaded.
function createBlankForm() {
  return {
    category: "iPhone",
    customCategory: "",
    model: "",
    customModel: "",
    color: "",
    storage: "",
    brand: "",
    condition: "Brand New",
    supplier: "",
    dateReceived: todayLocalDateString(),
    batchCode: batchCodeDatePrefix(),
    purchasePrice: "",
    price: "",
    status: "Available",
    issueDescription: "",
    remarks: "",
    shellId: "",
    quantity: "1",
  };
}

function AddDevice() {
  const navigate = useNavigate();
  const showToast = useToast();
  const isAdmin = useIsAdmin();

  const [productCatalog, setProductCatalog] = useState({});
  const loadProductCatalog = useCallback(() => {
    getProductCatalog()
      .then(setProductCatalog)
      .catch((err) => showToast(err.message || "Failed to load the product catalog. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadProductCatalog();
  }, [loadProductCatalog]);
  const categories = Object.keys(productCatalog);

  const [form, setForm] = useState(createBlankForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showManageCatalog, setShowManageCatalog] = useState(false);
  // The unit just saved — shown as a dismissible "Print Label" prompt until
  // the next save (or the banner's own X) replaces/clears it.
  const [justSaved, setJustSaved] = useState(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);
  const [showScanBatchCode, setShowScanBatchCode] = useState(false);

  const [pendingShells, setPendingShells] = useState([]);
  const loadPendingShells = useCallback(() => {
    getPendingShellsWithProgress()
      .then(setPendingShells)
      .catch((err) => showToast(err.message || "Failed to load pending shipments. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadPendingShells();
  }, [loadPendingShells]);

  // Fills in the full batch code — brand prefix (from the category's own
  // catalog entry) + today's date + the next unused sequence number for
  // that exact prefix+date combo, checked against existing devices.batch_code
  // values (see getNextBatchSequence) so two staff entries can't collide on
  // the same code. Falls back to leaving whatever's already in the field if
  // the category's catalog entry isn't loaded yet or the lookup fails —
  // this never touches existing devices, only what gets typed into this
  // one field before Save Device is clicked.
  const generateBatchCode = useCallback(
    async (category, { silent = false } = {}) => {
      // "Others (specify)" has no catalog entry at all, ever — a brand-new,
      // uncatalogued brand has no prefix to generate from, unlike a real
      // category that just hasn't finished loading yet.
      if (category === OTHER_CATEGORY) {
        if (!silent) showToast("No prefix for a custom category — enter the batch code by hand.", "error");
        return;
      }
      const catalogEntry = productCatalog[category];
      if (!catalogEntry) {
        if (!silent) showToast("Catalog hasn't finished loading yet — try again in a moment.", "error");
        return;
      }
      const prefix = `${catalogEntry.prefix}${batchCodeDatePrefix()}`;
      try {
        const seq = await getNextBatchSequence(prefix);
        const code = `${prefix}${String(seq).padStart(3, "0")}`;
        setForm((f) => ({ ...f, batchCode: code }));
        // The "next available" code for a given prefix+date is deterministic
        // until a device is actually saved with it — clicking Generate twice
        // in a row with nothing saved in between correctly produces the same
        // value both times. Without this, that looked indistinguishable from
        // the button silently doing nothing.
        if (!silent) showToast(`Generated ${code}.`);
      } catch (err) {
        // Auto-generation on mount/category-change fails silently (staff
        // can still type the code by hand) — but the explicit Generate
        // button click should say why nothing changed instead of looking
        // like it did nothing.
        if (!silent) showToast(err.message || "Failed to generate a batch code. Please try again.", "error");
      }
    },
    [productCatalog, showToast]
  );

  // Auto-generates once, the first moment the currently-selected category's
  // catalog entry (and therefore its prefix) becomes available — covers the
  // initial page load. Deliberately doesn't re-run on every later catalog
  // refetch (e.g. from Manage Catalog), which would otherwise silently
  // clobber a batch code staff already generated or hand-edited; category
  // changes and Save Device both trigger regeneration explicitly instead.
  const [autoGenerated, setAutoGenerated] = useState(false);
  useEffect(() => {
    if (autoGenerated || !productCatalog[form.category]) return;
    setAutoGenerated(true);
    generateBatchCode(form.category, { silent: true });
  }, [autoGenerated, productCatalog, form.category, generateBatchCode]);

  const catalog = productCatalog[form.category];
  const isOtherCategory = form.category === OTHER_CATEGORY;
  const resolvedCategory = isOtherCategory ? form.customCategory.trim() : form.category;
  const isOtherModel = form.model === OTHER_MODEL;
  const resolvedModel = isOtherModel ? form.customModel.trim() : form.model;
  const modelColors = !isOtherModel && form.model ? catalog?.modelColors[form.model] || [] : [];
  const isDefective = form.status === "Supplier Defective";
  // A brand-new, uncatalogued category has no way to know if it's
  // accessory-like — default to treating it as a serialized device (the
  // common case), same as every real category except the two literal ones.
  const isRepairPart = isAccessoryLikeCategory(form.category);
  // Bulk quantity only makes sense for accessories/repair parts — a
  // headset or screen protector batch is genuinely interchangeable unit
  // to unit, unlike a serialized phone. Clamped to at least 1 so an
  // emptied or invalid field can't submit a zero/negative-quantity batch.
  const resolvedQuantity = isRepairPart ? Math.max(1, parseInt(form.quantity, 10) || 1) : 1;
  const selectedShell = pendingShells.find((s) => s.id === form.shellId);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleCategoryChange = (category) => {
    setForm((f) => ({
      ...f,
      category,
      customCategory: "",
      // There's no catalog models list to pick from for a custom
      // category, so skip straight to the free-text model input instead
      // of showing a pointless empty dropdown first.
      model: category === OTHER_CATEGORY ? OTHER_MODEL : "",
      customModel: "",
      color: "",
      storage: "",
      brand: "",
      quantity: "1",
      // "Brand New" is valid in both condition vocabularies, so switching
      // category never leaves a stale, now-invalid condition selected.
      condition: "Brand New",
      // The supplier list is filtered by category — a phone supplier
      // selected before switching to Accessories/Repair Parts (or vice
      // versa) wouldn't be in the new list, so it'd show selected but
      // invalid rather than actually being saved.
      supplier: "",
    }));
    // The batch code prefix is brand-specific — regenerate so it matches
    // the newly selected category instead of leaving a stale prefix from
    // whatever was selected before.
    generateBatchCode(category, { silent: true });
  };

  const handleModelChange = (model) => {
    setForm((f) => ({ ...f, model, customModel: "", color: "" }));
  };

  // Log Shipment Arrival already picked the model/color/storage/supplier
  // from the same catalog, so pulling them back in here just saves staff
  // from re-selecting what's already known about the shipment.
  const handleShellChange = (shellId) => {
    const shell = pendingShells.find((s) => s.id === shellId);
    if (!shell) {
      update("shellId", shellId);
      return;
    }

    const matchedCategory = categories.find((cat) => productCatalog[cat]?.models?.includes(shell.deviceName));

    setForm((f) => ({
      ...f,
      shellId,
      category: matchedCategory || f.category,
      model: matchedCategory ? shell.deviceName : OTHER_MODEL,
      customModel: matchedCategory ? "" : shell.deviceName,
      color: shell.color || "",
      storage: shell.storage || "",
      supplier: shell.supplierName || f.supplier,
    }));
    // Same reason handleCategoryChange regenerates the batch code — the
    // prefix is brand-specific, and a shipment can resolve to a different
    // category than whatever was already selected. Without this, a code
    // generated for the previous category's brand stayed in the field even
    // after switching brands via a linked shipment.
    generateBatchCode(matchedCategory || form.category, { silent: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isDefective && !form.issueDescription.trim()) {
      setError("Describe the issue before adding this unit as Supplier Defective.");
      return;
    }
    setSubmitting(true);
    try {
      // A date-only value would parse to midnight UTC and print as 8 AM in
      // Manila time. When the receipt date is today, use the real current
      // timestamp; a backdated date still gets that day's local midnight.
      const isToday = form.dateReceived === todayLocalDateString();
      const dateAdded = isToday ? new Date().toISOString() : new Date(`${form.dateReceived}T00:00:00`).toISOString();

      const savedDevice = await addDevice({
        batchCode: form.batchCode.trim(),
        deviceName: resolvedModel,
        // devices.category is free text (not a foreign key), same as
        // device_name/color — a custom category is stored exactly as
        // typed, no catalog dbValue to fall back on.
        category: isOtherCategory ? resolvedCategory : catalog.dbValue,
        storage: isRepairPart ? null : form.storage,
        color: isRepairPart ? null : form.color,
        brand: isRepairPart ? form.brand.trim() || null : null,
        status: form.status,
        supplierName: form.supplier,
        condition: form.condition,
        purchasePrice: Number(form.purchasePrice),
        price: Number(form.price),
        notes: form.remarks.trim(),
        dateAdded,
        issueDescription: isDefective ? form.issueDescription.trim() : null,
        bulkOrderShellId: form.shellId || null,
        dateArrived: selectedShell ? selectedShell.dateArrived : null,
        quantity: resolvedQuantity,
      });

      showToast(resolvedQuantity > 1 ? `${resolvedQuantity} units saved.` : "Device saved.");
      setJustSaved({
        id: savedDevice.id,
        batchCode: form.batchCode.trim(),
        device: resolvedModel,
        storage: isRepairPart ? null : form.storage,
        color: isRepairPart ? null : form.color,
      });
      setForm(createBlankForm());
      loadPendingShells();
      generateBatchCode(createBlankForm().category, { silent: true });
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

  // catalog is legitimately undefined in two different cases: the product
  // catalog hasn't finished its initial fetch yet (bail out, nothing
  // renderable yet) vs. "Others (specify)" is deliberately selected (a
  // real, intentional state with its own form below, not a loading state).
  if (!catalog && !isOtherCategory) return null;

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4 print:hidden">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Register a new device into the inventory.
            </p>
            <p className="text-xs text-blue-500">All fields marked with * are required.</p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowManageCatalog(true)}
            className="flex items-center gap-1.5 text-sm text-blue-700 border border-blue-200 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 flex-shrink-0"
          >
            <Settings size={14} />
            Manage Catalog
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {justSaved && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-green-800">
            Saved <span className="font-medium">{justSaved.batchCode}</span> — {justSaved.device}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPrintLabel(true)}
              className="flex items-center gap-1.5 text-sm text-green-700 border border-green-200 bg-white px-3 py-1.5 rounded-lg hover:bg-green-50"
            >
              <Printer size={14} />
              Print Label
            </button>
            <button
              type="button"
              onClick={() => setJustSaved(null)}
              className="text-green-400 hover:text-green-700 px-2 text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {pendingShells.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1.5">
            <PackagePlus size={14} className="text-blue-500" />
            Link to Pending Shipment <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <select
            value={form.shellId}
            onChange={(e) => handleShellChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Not linked to a shipment</option>
            {pendingShells.map((s) => (
              <option key={s.id} value={s.id}>{formatShellLabel(s)}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Fills in category, model, color, storage, and supplier from the shipment, and records its actual
            arrival date. Batch code, price, and status still need to be entered per unit.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Device Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={16} className="text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">DEVICE INFORMATION</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Product Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={OTHER_CATEGORY}>Others (specify)</option>
              </select>
              {isOtherCategory && (
                <input
                  type="text"
                  value={form.customCategory}
                  onChange={(e) => update("customCategory", e.target.value)}
                  required
                  placeholder="Enter category/brand name"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              {/* A custom category has no catalog models list to choose
                  from, so skip straight to free text instead of showing a
                  dropdown with nothing but "Other" in it. */}
              {!isOtherCategory && (
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
              )}
              {isOtherModel && (
                <input
                  type="text"
                  value={form.customModel}
                  onChange={(e) => update("customModel", e.target.value)}
                  required
                  placeholder="Enter model name"
                  className={`w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isOtherCategory ? "" : "mt-2"}`}
                />
              )}
            </div>

            {!isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Color <span className="text-red-500">*</span>
                </label>
                {isOtherModel ? (
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => update("color", e.target.value)}
                    required
                    placeholder="Enter color"
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <select
                    value={form.color}
                    onChange={(e) => update("color", e.target.value)}
                    required
                    disabled={!form.model}
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">{form.model ? "Select color" : "Select a model first"}</option>
                    {modelColors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            )}

            {!isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Storage <span className="text-red-500">*</span>
                </label>
                {isOtherCategory ? (
                  <input
                    type="text"
                    value={form.storage}
                    onChange={(e) => update("storage", e.target.value)}
                    required
                    placeholder="Enter storage (e.g. 8GB+128GB)"
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <select
                    value={form.storage}
                    onChange={(e) => update("storage", e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select storage</option>
                    {catalog.storages.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            )}

            {isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  Which brand this batch is — click Various if it's a mixed-brand box, not one single brand.
                </p>
              </div>
            )}

            {isRepairPart && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {resolvedQuantity > 1
                    ? `Logs ${resolvedQuantity} identical units sharing one batch code and one printed label — for a batch of interchangeable stock like a box of the same case or headset.`
                    : "More than 1 logs identical units sharing one batch code and one printed label, for interchangeable stock like a box of the same case or headset."}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <SupplierSelect
                value={form.supplier}
                onChange={(v) => update("supplier", v)}
                category={form.category}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date Received</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={form.dateReceived}
                  onChange={(e) => update("dateReceived", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Identification & Pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint size={16} className="text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">IDENTIFICATION & PRICING</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Batch Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.batchCode}
                  onChange={(e) => update("batchCode", e.target.value)}
                  required
                  placeholder="SS070926-001"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => generateBatchCode(form.category)}
                  title="Generate a new code using this category's brand prefix"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0 whitespace-nowrap"
                >
                  <RefreshCw size={14} />
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanBatchCode(true)}
                  title="Scan an existing label's barcode into this field"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
                >
                  <Camera size={14} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Auto-filled with the next available code for this category's brand prefix — edit it, or click
                Generate, if needed
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Capital (Purchase Price) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => update("purchasePrice", e.target.value)}
                  required
                  placeholder="45000.00"
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">How much this unit cost — used to gauge profit at sale time</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Base Selling Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  required
                  placeholder="74990.00"
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Enter the default/base selling price</p>
            </div>


            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Initial Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Select the initial status of this device</p>
            </div>

            {isDefective && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
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
          </div>
        </div>

        {/* Column 3: Product Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={16} className="text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">PRODUCT PREVIEW</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
              <Smartphone size={28} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{resolvedModel || "—"}</p>
              {isRepairPart && form.brand && <p className="text-xs text-gray-500">{form.brand}</p>}
              {!isRepairPart && (
                <>
                  <p className="text-xs text-gray-500">{form.storage || "—"}</p>
                  <p className="text-xs text-gray-500">{form.color || "—"}</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Category</span>
              <span className="text-gray-700">{resolvedCategory || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Model</span>
              <span className="text-gray-700">{resolvedModel || "—"}</span>
            </div>
            {isRepairPart && (
              <div className="flex justify-between">
                <span className="text-gray-400">Brand</span>
                <span className="text-gray-700">{form.brand || "—"}</span>
              </div>
            )}
            {isRepairPart && (
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity</span>
                <span className="text-gray-700">{resolvedQuantity}</span>
              </div>
            )}
            {!isRepairPart && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Color</span>
                  <span className="text-gray-700">{form.color || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage</span>
                  <span className="text-gray-700">{form.storage || "—"}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Condition</span>
              <span className="text-gray-700">{form.condition || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Batch Code</span>
              <span className="text-gray-700">{form.batchCode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Capital</span>
              <span className="text-gray-700">
                {form.purchasePrice ? `₱${Number(form.purchasePrice).toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Base Price</span>
              <span className="text-gray-700">
                {form.price ? `₱${Number(form.price).toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Status</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600">
                {form.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
        <textarea
          value={form.remarks}
          onChange={(e) => update("remarks", e.target.value.slice(0, 255))}
          rows={3}
          placeholder="Enter any additional notes or remarks about this device..."
          className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-400 text-right mt-1">{form.remarks.length} / 255</p>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate("/inventory/all")}
          disabled={submitting}
          className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Save Device"}
        </button>
      </div>
    </form>

    {showManageCatalog && (
      <ManageCatalogModal onClose={() => setShowManageCatalog(false)} onChanged={loadProductCatalog} />
    )}

    {showPrintLabel && justSaved && (
      <PrintLabelsModal devices={[justSaved]} onClose={() => setShowPrintLabel(false)} />
    )}

    {showScanBatchCode && (
      <ScanBarcodeModal
        onScanned={(value) => {
          update("batchCode", value);
          setShowScanBatchCode(false);
          showToast(`Scanned "${value}".`);
        }}
        onClose={() => setShowScanBatchCode(false)}
      />
    )}
    </>
  );
}

export default AddDevice;