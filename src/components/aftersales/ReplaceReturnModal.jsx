import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";
import { getAvailableDevicesForReplacement, getAvailableDevicesForSale } from "../../services/inventoryService";
import { replaceReturn } from "../../services/returnsService";

const OTHER_UNIT = "__other__";

function ReplaceReturnModal({ record, onClose, onReplaced }) {
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [replacementId, setReplacementId] = useState("");

  const [otherDevices, setOtherDevices] = useState([]);
  const [otherSearch, setOtherSearch] = useState("");
  const [otherDeviceId, setOtherDeviceId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvailableDevicesForReplacement(record.device).then((list) => {
      setCandidates(list);
      setCandidatesLoaded(true);
    });
  }, [record.device]);

  useEffect(() => {
    if (replacementId === OTHER_UNIT && otherDevices.length === 0) {
      getAvailableDevicesForSale().then(setOtherDevices);
    }
  }, [replacementId, otherDevices.length]);

  const filteredOtherDevices = useMemo(() => {
    if (!otherSearch) return otherDevices;
    const q = otherSearch.toLowerCase();
    return otherDevices.filter((d) => d.product.toLowerCase().includes(q) || d.batchCode.toLowerCase().includes(q));
  }, [otherDevices, otherSearch]);

  const selectedOtherDevice = otherDevices.find((d) => d.id === otherDeviceId);

  if (!record) return null;

  const resolvedReplacementId = replacementId === OTHER_UNIT ? otherDeviceId : replacementId;

  const handleConfirm = async () => {
    if (!resolvedReplacementId) {
      setError("Select a replacement unit.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await replaceReturn(record.id, record.deviceId, resolvedReplacementId, record.reason);
      onReplaced();
    } catch (err) {
      setError(err.message || "Failed to replace return. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Replace Return</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-600">
            {record.batchCode} · {record.device} · {record.customer}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Available {record.device} units
            </label>
            <select
              value={replacementId}
              onChange={(e) => {
                setReplacementId(e.target.value);
                setOtherDeviceId("");
              }}
              className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a unit</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.batchCode} — {c.storage} · {c.color}
                </option>
              ))}
              <option value={OTHER_UNIT}>Other unit (different model)</option>
            </select>
            {candidatesLoaded && candidates.length === 0 && replacementId !== OTHER_UNIT && (
              <p className="text-xs text-red-500 mt-1.5">
                No available {record.device} units in stock right now — pick "Other unit (different model)" instead.
              </p>
            )}
          </div>

          {replacementId === OTHER_UNIT && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Replace with a different model
              </label>
              {selectedOtherDevice ? (
                <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{selectedOtherDevice.product}</p>
                    <p className="text-xs text-gray-500">
                      {selectedOtherDevice.batchCode} · {selectedOtherDevice.storage} · {selectedOtherDevice.color} · ₱
                      {selectedOtherDevice.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setOtherDeviceId("")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={otherSearch}
                    onChange={(e) => setOtherSearch(e.target.value)}
                    placeholder="Search available devices..."
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {filteredOtherDevices.length === 0 ? (
                      <p className="text-sm text-gray-400 px-3 py-3">No available devices found.</p>
                    ) : (
                      filteredOtherDevices.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setOtherDeviceId(d.id)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <p className="text-sm text-gray-800">{d.product}</p>
                          <p className="text-xs text-gray-400">
                            {d.batchCode} · {d.storage} · {d.color} · ₱{d.price.toLocaleString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">
            The returned unit ({record.batchCode}) will be sent to Supplier Defective automatically.
          </p>
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
            disabled={submitting || !resolvedReplacementId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Replacing..." : "Replace Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplaceReturnModal;
