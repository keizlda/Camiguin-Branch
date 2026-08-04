import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import {
  getReorderSettings,
  getDeviceModelNames,
  addReorderSetting,
  updateReorderSetting,
  deleteReorderSetting,
} from "../../services/reorderService";

function ReorderSettingsModal({ onClose, onChanged }) {
  const [settings, setSettings] = useState([]);
  const [modelNames, setModelNames] = useState([]);
  const [levelDrafts, setLevelDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const [newModel, setNewModel] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    getReorderSettings().then((rows) => {
      setSettings(rows);
      setLevelDrafts(Object.fromEntries(rows.map((r) => [r.id, String(r.reorderLevel)])));
    });
    getDeviceModelNames().then(setModelNames);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unconfiguredModels = modelNames.filter((m) => !settings.some((s) => s.deviceName === m));

  const notifyChanged = () => {
    load();
    onChanged?.();
  };

  const handleAdd = async () => {
    if (!newModel || !newLevel) return;
    setError("");
    setAdding(true);
    try {
      await addReorderSetting({ deviceName: newModel, reorderLevel: Number(newLevel) });
      setNewModel("");
      setNewLevel("");
      notifyChanged();
    } catch (err) {
      setError(err.message || "Failed to add reorder setting.");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveLevel = async (setting) => {
    const level = Number(levelDrafts[setting.id]);
    if (!level || level === setting.reorderLevel) return;
    setError("");
    setSavingId(setting.id);
    try {
      await updateReorderSetting(setting.id, { reorderLevel: level, enabled: setting.enabled });
      notifyChanged();
    } catch (err) {
      setError(err.message || "Failed to update reorder level.");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleEnabled = async (setting) => {
    setError("");
    setSavingId(setting.id);
    try {
      await updateReorderSetting(setting.id, { reorderLevel: setting.reorderLevel, enabled: !setting.enabled });
      notifyChanged();
    } catch (err) {
      setError(err.message || "Failed to update reorder setting.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (setting) => {
    if (!window.confirm(`Remove the reorder setting for ${setting.deviceName}?`)) return;
    setError("");
    setSavingId(setting.id);
    try {
      await deleteReorderSetting(setting.id);
      notifyChanged();
    } catch (err) {
      setError(err.message || "Failed to remove reorder setting.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">Reorder Level Settings</p>
            <p className="text-xs text-gray-400">
              Set a minimum stock threshold per model. Disable a model to hide it from Low Stock without losing its setting.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Add new model */}
          <div className="bg-gray-50 rounded-lg p-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select model</option>
                {unconfiguredModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
              <input
                type="number"
                min="1"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                placeholder="5"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newModel || !newLevel}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>

          {/* Existing settings */}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {settings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No reorder settings configured yet.</p>
            ) : (
              settings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <p className={`flex-1 text-sm font-medium ${s.enabled ? "text-gray-800" : "text-gray-400"}`}>
                    {s.deviceName}
                  </p>
                  <input
                    type="number"
                    min="1"
                    value={levelDrafts[s.id] ?? ""}
                    onChange={(e) => setLevelDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                    onBlur={() => handleSaveLevel(s)}
                    disabled={savingId === s.id}
                    className="w-20 border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleToggleEnabled(s)}
                    disabled={savingId === s.id}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      s.enabled ? "bg-blue-600" : "bg-gray-300"
                    }`}
                    title={s.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        s.enabled ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={savingId === s.id}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReorderSettingsModal;
