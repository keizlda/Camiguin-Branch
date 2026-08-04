import { useState } from "react";
import { X, Trash2, Plus, AlertTriangle } from "lucide-react";

const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });

const toISODate = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

// Line-item breakdown behind one of Financial's/Reports' Expenses/Cargo/
// Prulife summary rows — mirrors UnsoldUnitsModal's click-to-drill-in
// pattern, plus an inline Add form (everyone can add) so no one has to back
// out and re-pick the category from the main page's dropdown. Removing an
// entry stays admin-only.
function ExpenseCategoryModal({ category, entries, isAdmin, onRemove, onAdd, onClose }) {
  const displayLabel = category === "General" ? "Expenses" : category;
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const [date, setDate] = useState(toISODate(new Date()));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setError("");
    setSubmitting(true);
    try {
      await onAdd({ date, description: description.trim(), amount: Number(amount), category });
      setDescription("");
      setAmount("");
    } catch (err) {
      setError(err.message || "Failed to add expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">{displayLabel}</p>
            <p className="text-xs text-gray-400">Every {displayLabel.toLowerCase()} entry for the selected period</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[45vh] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No {displayLabel.toLowerCase()} entries for this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  {isAdmin && <th className="pb-2 font-medium text-right">Remove</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700 whitespace-nowrap">{e.date}</td>
                    <td className="py-2.5 text-gray-800 font-medium">
                      {e.description}
                      {e.adminOnly && <span className="ml-2 text-xs text-gray-300 font-normal">(Admin Only)</span>}
                    </td>
                    <td className="py-2.5 text-right text-red-500">-{peso(e.amount)}</td>
                    {isAdmin && (
                      <td className="py-2.5 text-right">
                        <button onClick={() => onRemove(e.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. ${displayLabel} entry`}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-28 border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus size={14} />
              {submitting ? "Adding..." : `Add ${displayLabel}`}
            </button>
          </form>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
          <p className="text-sm font-semibold text-gray-800">
            Total {displayLabel} <span className="text-red-500">-{peso(total)}</span>
          </p>
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

export default ExpenseCategoryModal;
