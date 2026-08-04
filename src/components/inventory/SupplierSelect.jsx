import { useState, useEffect, useCallback } from "react";
import { getSuppliers } from "../../services/referenceService";
import { isAccessoryLikeCategory } from "../../data/referenceData";
import AddSupplierModal from "./AddSupplierModal";

const ADD_NEW = "__add_new__";

// Shared supplier <select> — lets staff add a brand-new supplier inline
// (owner picks up new suppliers occasionally) without leaving the form.
//
// category (optional): the current form's product category. When given,
// the list is filtered to suppliers of the matching type (Accessories/
// Repair Parts draw from a different supplier list than phones/iPads/
// Watches/MacBooks). Omit it where there's no category context — every
// active supplier shows instead of risking an empty, wrongly-filtered list.
function SupplierSelect({ value, onChange, required = false, placeholder = "Select supplier", category }) {
  const supplierType = category ? (isAccessoryLikeCategory(category) ? "Accessory" : "Device") : undefined;

  const [suppliers, setSuppliers] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadSuppliers = useCallback(() => {
    setLoadError(false);
    getSuppliers(supplierType)
      .then(setSuppliers)
      .catch(() => setLoadError(true));
  }, [supplierType]);
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleChange = (e) => {
    if (e.target.value === ADD_NEW) {
      setShowAddModal(true);
      return;
    }
    onChange(e.target.value);
  };

  const handleAdded = (name) => {
    setShowAddModal(false);
    loadSuppliers();
    onChange(name);
  };

  return (
    <>
      <select
        value={value}
        onChange={handleChange}
        required={required}
        className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{placeholder}</option>
        {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value={ADD_NEW}>+ Add New Supplier</option>
      </select>

      {loadError && (
        <p className="text-xs text-red-500 mt-1">
          Couldn't load suppliers — try refreshing the page. If this keeps happening, a database migration may be missing.
        </p>
      )}

      {showAddModal && (
        <AddSupplierModal
          defaultType={supplierType || "Device"}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  );
}

export default SupplierSelect;
