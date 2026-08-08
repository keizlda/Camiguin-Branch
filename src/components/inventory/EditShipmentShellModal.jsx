import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { editBulkOrderShell } from "../../services/bulkOrderShellsService";
import { toDatetimeLocalString } from "../../utils/datetime";
import SupplierSelect from "./SupplierSelect";

// Corrects a shipment placeholder's own fields from the Pending Shipments
// card — e.g. the quantity was mistyped, or the wrong category got picked
// in Log Shipment Arrival so an accessory shipment ended up here instead of
// going straight into inventory. No category field — bulk_order_shells
// doesn't store one (see schema.sql), so there's nothing to reselect from
// the catalog the way Log Shipment Arrival itself does.
function EditShipmentShellModal({ shell, onClose, onSaved }) {
  const [supplierName, setSupplierName] = useState(shell.supplierName || "");
  const [deviceName, setDeviceName] = useState(shell.deviceName || "");
  const [storage, setStorage] = useState(shell.storage || "");
  const [color, setColor] = useState(shell.color || "");
  const [quantityExpected, setQuantityExpected] = useState(String(shell.quantityExpected ?? ""));
  const [unitCost, setUnitCost] = useState(shell.unitCost != null ? String(shell.unitCost) : "");
  // toDatetimeLocalString gives local YYYY-MM-DDTHH:mm — slicing to 10
  // chars reads off just the date part without a UTC-slice midnight bug.
  const [dateArrived, setDateArrived] = useState(toDatetimeLocalString(shell.dateArrived).slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError("Enter a model/device name.");
      return;
    }
    if (!(Number(quantityExpected) > 0)) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (Number(quantityExpected) < shell.linkedCount) {
      setError(`Quantity can't be less than the ${shell.linkedCount} unit(s) already logged against this shipment.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await editBulkOrderShell({
        id: shell.id,
        supplierName,
        deviceName: deviceName.trim(),
        storage: storage.trim(),
        color: color.trim(),
        quantityExpected: Number(quantityExpected),
        unitCost: unitCost === "" ? null : Number(unitCost),
        dateArrived: new Date(`${dateArrived}T00:00:00`).toISOString(),
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
          <p className="font-semibold text-gray-800">Edit Shipment</p>
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
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier</label>
              <SupplierSelect value={supplierName} onChange={setSupplierName} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Model / Device Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Color <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Storage <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Quantity Expected <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantityExpected}
                  onChange={(e) => setQuantityExpected(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {shell.linkedCount > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{shell.linkedCount} already logged against this shipment.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Unit Cost (Capital) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input
                    type="number"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Date Arrived <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateArrived}
                onChange={(e) => setDateArrived(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

export default EditShipmentShellModal;
