import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { addSupplier } from "../../services/referenceService";

function AddSupplierModal({ onClose, onAdded, defaultType = "Device" }) {
  const [name, setName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [supplierType, setSupplierType] = useState(defaultType);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const trimmedName = name.trim();
      await addSupplier({ name: trimmedName, contactInfo: contactInfo.trim(), supplierType });
      onAdded(trimmedName);
    } catch (err) {
      if (err.code === "23505") {
        setError("A supplier with this name already exists.");
      } else {
        setError(err.message || "Failed to add supplier. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Add New Supplier</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <div className="px-5 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                required
                autoFocus
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Contact Info</label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Phone number or email"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplies</label>
              <div className="flex gap-2">
                {[
                  { value: "Device", label: "Phones / iPads / Watches / MacBooks" },
                  { value: "Accessory", label: "Accessories / Repair Parts" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSupplierType(opt.value)}
                    className={`flex-1 text-xs px-3 py-2 rounded-lg border text-left ${
                      supplierType === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Determines which forms this supplier shows up in.</p>
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
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add Supplier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddSupplierModal;
