import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, Trash2, Plus, RotateCcw } from "lucide-react";
import {
  getCatalogModels,
  addProductModel,
  removeProductModel,
  addModelColor,
  removeModelColor,
  getAllSuppliers,
  addSupplier,
  setSupplierActive,
  setSupplierType,
  getAllCategories,
  addCategory,
  setCategoryActive,
} from "../../services/referenceService";

// Admin-only catalog management — models/colors/categories used to be
// hardcoded in the app's source, so adding a new Android brand (or a new
// Apple release) meant a code deploy. This edits the same
// categories/product_models/suppliers tables Add Device already reads
// from, so changes show up there immediately.
function ManageCatalogModal({ onClose, onChanged }) {
  const [tab, setTab] = useState("catalog");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Manage Catalog</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-gray-100">
          {[
            { id: "catalog", label: "Models & Colors" },
            { id: "categories", label: "Categories & Brands" },
            { id: "suppliers", label: "Suppliers" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">
          {tab === "catalog" && <CatalogTab onChanged={onChanged} />}
          {tab === "categories" && <CategoriesTab onChanged={onChanged} />}
          {tab === "suppliers" && <SuppliersTab onChanged={onChanged} />}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogTab({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [newModelName, setNewModelName] = useState("");
  const [newColor, setNewColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getCatalogModels().then((rows) => {
      setModels(rows);
      setSelectedModelId((id) => (rows.some((m) => m.id === id) ? id : null));
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Active categories only — an archived one shouldn't be pickable here
  // even though its past models/product_models rows are untouched.
  useEffect(() => {
    getAllCategories().then((rows) => {
      const active = rows.filter((c) => c.active).map((c) => c.name);
      setCategories(active);
      setCategory((current) => (current && active.includes(current) ? current : active[0] || ""));
    });
  }, []);

  const notify = () => {
    load();
    onChanged?.();
  };

  const modelsInCategory = models.filter((m) => m.category === category);
  const selectedModel = models.find((m) => m.id === selectedModelId);

  const handleAddModel = async () => {
    if (!newModelName.trim()) return;
    setError("");
    setBusy(true);
    try {
      await addProductModel({ category, name: newModelName.trim() });
      setNewModelName("");
      notify();
    } catch (err) {
      setError(err.code === "23505" ? "That model already exists in this category." : err.message || "Failed to add model.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveModel = async (model) => {
    if (!window.confirm(`Remove "${model.name}" from the catalog? Existing inventory already using it is unaffected — this only stops it from being offered in Add Device going forward.`)) return;
    setError("");
    setBusy(true);
    try {
      await removeProductModel(model.id);
      notify();
    } catch (err) {
      setError(err.message || "Failed to remove model.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddColor = async () => {
    if (!newColor.trim() || !selectedModel) return;
    setError("");
    setBusy(true);
    try {
      await addModelColor(selectedModel.id, selectedModel.colors, newColor);
      setNewColor("");
      notify();
    } catch (err) {
      setError(err.message || "Failed to add color.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveColor = async (color) => {
    if (!selectedModel) return;
    setError("");
    setBusy(true);
    try {
      await removeModelColor(selectedModel.id, selectedModel.colors, color);
      notify();
    } catch (err) {
      setError(err.message || "Failed to remove color.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSelectedModelId(null); }}
          className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Models list */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Models</p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {modelsInCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No models in this category yet.</p>
            ) : (
              modelsInCategory.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModelId(m.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    selectedModelId === m.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="truncate">{m.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleRemoveModel(m); }}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              placeholder="New model name"
              className="flex-1 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddModel}
              disabled={busy || !newModelName.trim()}
              className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Colors for selected model */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">
            Colors {selectedModel ? `— ${selectedModel.name}` : ""}
          </p>
          {!selectedModel ? (
            <p className="text-sm text-gray-400 border border-gray-100 rounded-lg py-6 text-center">
              Select a model to manage its colors.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 border border-gray-100 rounded-lg p-2 min-h-[3rem]">
                {selectedModel.colors.length === 0 ? (
                  <p className="text-sm text-gray-400 px-1 py-1">No colors yet.</p>
                ) : (
                  selectedModel.colors.map((c) => (
                    <span key={c} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full pl-2.5 pr-1.5 py-1">
                      {c}
                      <button onClick={() => handleRemoveColor(c)} className="text-gray-400 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddColor()}
                  placeholder="New color"
                  className="flex-1 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddColor}
                  disabled={busy || !newColor.trim()}
                  className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  <Plus size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Lets an admin add a brand-new category/brand (e.g. a new Android brand)
// without a code deploy — mirrors the archive-not-delete pattern already
// used for suppliers, since devices/product_models reference a category by
// name as free text rather than a foreign key.
function CategoriesTab({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newStorages, setNewStorages] = useState("");
  const [newIsAccessoryLike, setNewIsAccessoryLike] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getAllCategories()
      .then(setCategories)
      .catch((err) => setError(err.message || "Failed to load categories."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const notify = () => {
    load();
    onChanged?.();
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newBrand.trim() || !newPrefix.trim()) return;
    // Letters only — batch codes are built as <PREFIX><MMDDYY>-<seq>, so a
    // prefix containing digits could visually run into the date that
    // immediately follows it, and a scanned/typed code would be genuinely
    // ambiguous to re-split back into prefix vs. date by eye.
    if (!/^[A-Z]{1,4}$/.test(newPrefix.trim().toUpperCase())) {
      setError("Prefix must be 1-4 letters (A-Z), no numbers or symbols.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const storages = newStorages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await addCategory({
        name: newName.trim(),
        brand: newBrand.trim(),
        prefix: newPrefix.trim(),
        storages: storages.length > 0 ? storages : ["N/A"],
        isAccessoryLike: newIsAccessoryLike,
      });
      setNewName("");
      setNewBrand("");
      setNewPrefix("");
      setNewStorages("");
      setNewIsAccessoryLike(false);
      notify();
    } catch (err) {
      setError(
        err.code === "23505"
          ? "A category with this name or prefix already exists."
          : err.message || "Failed to add category."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (category) => {
    setError("");
    setBusy(true);
    try {
      await setCategoryActive(category.id, !category.active);
      notify();
    } catch (err) {
      setError(err.message || "Failed to update category.");
    } finally {
      setBusy(false);
    }
  };

  const active = categories.filter((c) => c.active);
  const archived = categories.filter((c) => !c.active);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Category / Brand Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Huawei"
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Brand (display)</label>
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="e.g. Huawei"
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Batch Code Prefix
            </label>
            <input
              type="text"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. HW"
              maxLength={4}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Storage Options (comma-separated)
            </label>
            <input
              type="text"
              value={newStorages}
              onChange={(e) => setNewStorages(e.target.value)}
              placeholder="64GB, 128GB, 256GB"
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsAccessoryLike}
              onChange={(e) => setNewIsAccessoryLike(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Accessory-like (no Color/Storage, different condition options)
          </label>
          <button
            onClick={handleAdd}
            disabled={busy || !newName.trim() || !newBrand.trim() || !newPrefix.trim()}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Active Categories</p>
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
          {active.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No active categories.</p>
          ) : (
            active.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">
                    {c.name} <span className="text-gray-400 text-xs">— {c.brand}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Prefix {c.prefix} · {c.storages.join(", ")}
                    {c.isAccessoryLike ? " · Accessory-like" : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleActive(c)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 disabled:opacity-60 flex-shrink-0"
                  title="Archive — hides it from future Add Device picks without touching past records"
                >
                  <Trash2 size={13} />
                  Archive
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {archived.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Archived</p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {archived.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <p className="text-sm text-gray-400">
                  {c.name} — {c.brand}
                </p>
                <button
                  onClick={() => handleToggleActive(c)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-60"
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const supplierTypeLabel = {
  Device: "Phones / iPads / Watches / MacBooks",
  Accessory: "Accessories / Repair Parts",
};

function SupplierTypeBadge({ type, onClick, disabled }) {
  const label = type ? supplierTypeLabel[type] : "Both (universal)";
  const style = type === "Accessory" ? "bg-purple-50 text-purple-600" : type === "Device" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Click to switch which category list this supplier shows up in"
      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${style} hover:opacity-75 disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

function SuppliersTab({ onChanged }) {
  const [suppliers, setSuppliers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newType, setNewType] = useState("Device");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getAllSuppliers()
      .then(setSuppliers)
      .catch((err) => setError(err.message || "Failed to load suppliers."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const notify = () => {
    load();
    onChanged?.();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError("");
    setBusy(true);
    try {
      await addSupplier({ name: newName.trim(), contactInfo: newContact.trim(), supplierType: newType });
      setNewName("");
      setNewContact("");
      notify();
    } catch (err) {
      setError(err.code === "23505" ? "A supplier with this name already exists." : err.message || "Failed to add supplier.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (supplier) => {
    setError("");
    setBusy(true);
    try {
      await setSupplierActive(supplier.id, !supplier.active);
      notify();
    } catch (err) {
      setError(err.message || "Failed to update supplier.");
    } finally {
      setBusy(false);
    }
  };

  // Device -> Accessory -> Both (null, shows for every category, like
  // "Walk-in") -> back to Device.
  const nextSupplierType = (current) => {
    if (current === "Device") return "Accessory";
    if (current === "Accessory") return null;
    return "Device";
  };

  const handleCycleType = async (supplier) => {
    setError("");
    setBusy(true);
    try {
      await setSupplierType(supplier.id, nextSupplierType(supplier.supplierType));
      notify();
    } catch (err) {
      setError(err.message || "Failed to update supplier type.");
    } finally {
      setBusy(false);
    }
  };

  const active = suppliers.filter((s) => s.active);
  const archived = suppliers.filter((s) => !s.active);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Supplier Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact Info</label>
            <input
              type="text"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Supplies</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Device">Phones / iPads / Watches / MacBooks</option>
              <option value="Accessory">Accessories / Repair Parts</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={busy || !newName.trim()}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Active Suppliers</p>
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
          {active.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No active suppliers.</p>
          ) : (
            active.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">{s.name}</p>
                  {s.contactInfo && <p className="text-xs text-gray-400">{s.contactInfo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <SupplierTypeBadge type={s.supplierType} onClick={() => handleCycleType(s)} disabled={busy} />
                  <button
                    onClick={() => handleToggleActive(s)}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 disabled:opacity-60"
                    title="Archive — hides it from future Supplier selections without touching past records"
                  >
                    <Trash2 size={13} />
                    Archive
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {archived.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Archived</p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <p className="text-sm text-gray-400">{s.name}</p>
                <button
                  onClick={() => handleToggleActive(s)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-60"
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageCatalogModal;
