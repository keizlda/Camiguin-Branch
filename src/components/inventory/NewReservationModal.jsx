import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";
import { getAvailableDevicesForSale } from "../../services/inventoryService";
import { createReservation } from "../../services/reservationsService";
import { useToast } from "../../hooks/useToast";
import { searchMatches } from "../../utils/search";

function toISODate(d) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function defaultReservedUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toISODate(d);
}

function NewReservationModal({ onClose, onCreated }) {
  const showToast = useToast();
  const [devices, setDevices] = useState([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reservedUntil, setReservedUntil] = useState(defaultReservedUntil());
  const [totalPrice, setTotalPrice] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvailableDevicesForSale()
      .then(setDevices)
      .catch((err) => showToast(err.message || "Failed to load available devices. Please try again.", "error"));
  }, [showToast]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => searchMatches(deviceSearch, d.product, d.batchCode, d.brand));
  }, [devices, deviceSearch]);

  const selectedDevice = devices.find((d) => d.id === selectedId);

  const handleSelect = (device) => {
    setSelectedId(device.id);
    setTotalPrice(String(device.price));
  };

  const handleConfirm = async () => {
    if (!selectedId) {
      setError("Select a device to reserve.");
      return;
    }
    if (!customerName.trim()) {
      setError("Enter the customer's name.");
      return;
    }
    if (!reservedUntil) {
      setError("Set a reserved-until date.");
      return;
    }
    const resolvedTotalPrice = Number(totalPrice) || selectedDevice?.price || 0;
    const resolvedDownPayment = Number(downPayment) || 0;
    if (resolvedDownPayment > resolvedTotalPrice) {
      setError("Down payment can't be more than the total price.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createReservation({
        deviceId: selectedId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        reservedUntil,
        totalPrice: resolvedTotalPrice,
        downPayment: resolvedDownPayment,
      });
      onCreated();
    } catch (err) {
      setError(err.message || "Failed to create reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">New Reservation</p>
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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Device to Reserve</label>
            {selectedDevice ? (
              <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{selectedDevice.product}</p>
                  <p className="text-xs text-gray-500">
                    {selectedDevice.batchCode} · {selectedDevice.storage} · ₱
                    {selectedDevice.price.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId("")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder="Search available devices..."
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {filteredDevices.length === 0 ? (
                    <p className="text-sm text-gray-400 px-3 py-3">No available devices found.</p>
                  ) : (
                    filteredDevices.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleSelect(d)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      >
                        <p className="text-sm text-gray-800">{d.product}</p>
                        <p className="text-xs text-gray-400">
                          {d.batchCode} · {d.storage} · ₱{d.price.toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone (Optional)</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0917 123 4567"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Reserved Until</label>
              <input
                type="date"
                value={reservedUntil}
                onChange={(e) => setReservedUntil(e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Down Payment (Optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
              <input
                type="number"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Balance due: ₱{Math.max(0, (Number(totalPrice) || selectedDevice?.price || 0) - (Number(downPayment) || 0)).toLocaleString()}
            </p>
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
            {submitting ? "Saving..." : "Create Reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewReservationModal;
