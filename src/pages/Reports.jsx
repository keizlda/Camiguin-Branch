import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart3,
  Printer,
  Search,
  ShoppingBag,
  Receipt,
  Package,
  TrendingUp,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useServiceData } from "../hooks/useServiceData";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { getSalesHistory } from "../services/salesService";
import { getExpenses, addExpense, deleteExpense } from "../services/expensesService";
import DateRangePicker from "../components/common/DateRangePicker";
import ExpenseCategoryModal from "../components/financial/ExpenseCategoryModal";
import { useToast } from "../hooks/useToast";

const REPORT_TYPES = ["Daily", "Weekly", "Monthly", "Custom Range"];

const peso = (n) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toISODate = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

// Returns null for "Custom Range" — the user picks the dates manually in that case.
function getPresetRange(type) {
  const today = new Date();
  if (type === "Daily") {
    return { from: toISODate(today), to: toISODate(today) };
  }
  if (type === "Weekly") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: toISODate(weekAgo), to: toISODate(today) };
  }
  if (type === "Monthly") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISODate(monthStart), to: toISODate(today) };
  }
  return null;
}

function SummaryCard({ icon: Icon, iconBg, label, value, sub, valueClass }) {
  return (
    <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5">
      <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 tracking-wide">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${valueClass}`}>{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

const initialRange = getPresetRange("Daily");

// A Bulk order starts Pending until someone confirms payment (see
// process_sale) — Pending is otherwise never used, every non-bulk sale is
// Paid immediately. An unpaid bulk order still shows as a row (so staff can
// see it happened) but doesn't count toward the day's totals until it's
// actually paid — the report shouldn't claim revenue/profit that hasn't
// been confirmed yet.
function isPendingBulk(row) {
  return row.orderType === "Bulk" && row.paymentStatus === "Pending";
}

function computeTotals(rows) {
  const countedRows = rows.filter((r) => !isPendingBulk(r));
  const totalSales = countedRows.reduce((sum, r) => sum + r.amount, 0);
  const totalTransactions = countedRows.length;
  const totalItems = countedRows.reduce((sum, r) => sum + r.items, 0);
  const avgSale = totalTransactions ? totalSales / totalTransactions : 0;
  // Units added before purchase_price was captured have no netProfit (null)
  // rather than a false 0 — treated as 0 here same as Financial's totals,
  // so this stays a lower bound rather than pretending those units are free.
  const totalProfit = countedRows.reduce((sum, r) => sum + (r.netProfit ?? 0), 0);
  return { totalSales, totalTransactions, totalItems, avgSale, totalProfit };
}

function Reports() {
  const salesHistory = useServiceData(getSalesHistory, []);
  const isAdmin = useIsAdmin();
  const showToast = useToast();

  const [reportType, setReportType] = useState("Daily");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [generatedRange, setGeneratedRange] = useState(initialRange);
  const [viewMode, setViewMode] = useState("all"); // "all" | "cash" | "expenses"

  const [expenses, setExpenses] = useState([]);
  const loadExpenses = useCallback(() => {
    getExpenses()
      .then(setExpenses)
      .catch((err) => showToast(err.message || "Failed to load expenses. Please refresh and try again.", "error"));
  }, [showToast]);
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const [expenseDate, setExpenseDate] = useState(toISODate(new Date()));
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("General");
  const [expenseError, setExpenseError] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseModalCategory, setExpenseModalCategory] = useState(null); // null | "General" | "Cargo"

  const rows = useMemo(() => {
    const from = generatedRange.from ? new Date(generatedRange.from + "T00:00:00") : null;
    const to = generatedRange.to ? new Date(generatedRange.to + "T00:00:00") : null;
    return salesHistory
      .filter((s) => {
        const saleDate = new Date(s.date);
        return (!from || saleDate >= from) && (!to || saleDate <= to);
      })
      .map((s) => ({
        txn: s.batchCode,
        date: s.date,
        time: s.time,
        customer: s.customer,
        orderType: s.orderType,
        paymentStatus: s.paymentStatus,
        device: s.device,
        storage: s.storage,
        color: s.color,
        items: 1,
        amount: s.total,
        netProfit: s.netProfit,
        payment: s.payment,
      }));
  }, [generatedRange, salesHistory]);

  const [buyerFilter, setBuyerFilter] = useState("All");

  // Only buyers with at least one Bulk order, scoped to the current report
  // period — lets a same-day bulk order be isolated from the regular
  // walk-in sales it'd otherwise be mixed in with.
  const bulkBuyerNames = useMemo(() => {
    const names = new Set();
    rows.forEach((r) => {
      if (r.orderType === "Bulk" && r.customer && r.customer.trim()) {
        names.add(r.customer.trim());
      }
    });
    return [...names].sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (buyerFilter === "All") return rows;
    return rows.filter((r) => r.customer && r.customer.trim() === buyerFilter);
  }, [rows, buyerFilter]);

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows]);

  const cashRows = useMemo(() => filteredRows.filter((r) => r.payment === "Cash"), [filteredRows]);
  const cashTotals = useMemo(() => computeTotals(cashRows), [cashRows]);

  const displayedRows = viewMode === "cash" ? cashRows : filteredRows;
  const displayedTotals = viewMode === "cash" ? cashTotals : totals;

  const filteredExpenses = useMemo(() => {
    const from = generatedRange.from ? new Date(generatedRange.from) : null;
    const to = generatedRange.to ? new Date(generatedRange.to) : null;
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return (!from || d >= from) && (!to || d <= to);
    });
  }, [expenses, generatedRange]);

  // Reports only ever offers General/Cargo — Prulife/Personal are
  // Financial-only (admin) categories, so any stray Prulife/Personal entry
  // just falls back into General here rather than getting its own bucket.
  const expensesByCategory = useMemo(() => {
    const buckets = { General: [], Cargo: [] };
    for (const e of filteredExpenses) {
      (buckets[e.category] || buckets.General).push(e);
    }
    return buckets;
  }, [filteredExpenses]);

  const categoryTotals = useMemo(
    () => ({
      General: expensesByCategory.General.reduce((sum, e) => sum + e.amount, 0),
      Cargo: expensesByCategory.Cargo.reduce((sum, e) => sum + e.amount, 0),
    }),
    [expensesByCategory]
  );

  // Net Profit is margin (revenue minus capital) minus expenses — not
  // revenue minus expenses, which ignores what the units actually cost.
  const netProfit = totals.totalProfit - categoryTotals.General - categoryTotals.Cargo;

  const handleReportTypeChange = (type) => {
    setReportType(type);
    const preset = getPresetRange(type);
    if (preset) {
      setDateFrom(preset.from);
      setDateTo(preset.to);
      setGeneratedRange(preset);
    }
  };

  const handleGenerate = () => {
    setGeneratedRange({ from: dateFrom, to: dateTo });
  };

  // DateRangePicker works in real Date objects; this page's report-type
  // presets and generated range are all plumbed as ISO date strings, so this
  // bridges the two without rewriting the preset/print logic below.
  const customRange = {
    from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
    to: dateTo ? new Date(`${dateTo}T00:00:00`) : undefined,
  };

  const handleCustomRangeChange = (range) => {
    setDateFrom(range?.from ? toISODate(range.from) : "");
    setDateTo(range?.to ? toISODate(range.to) : "");
    setReportType("Custom Range");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;
    setExpenseError("");
    setSubmittingExpense(true);
    try {
      await addExpense({
        date: expenseDate,
        description: expenseDesc.trim(),
        amount: Number(expenseAmount),
        category: expenseCategory,
      });
      setExpenseDesc("");
      setExpenseAmount("");
      setExpenseCategory("General");
      loadExpenses();
    } catch (err) {
      setExpenseError(err.message || "Failed to add expense. Please try again.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Lets admin add straight from the Expenses/Cargo breakdown modal, already
  // scoped to that category — General/Cargo entries are staff-visible no
  // matter where they're added from, same as the main Add Expense form on
  // this page.
  const handleAddExpenseFromModal = async ({ date, description, amount, category }) => {
    await addExpense({ date, description, amount, category });
    loadExpenses();
  };

  const handleRemoveExpense = async (id) => {
    try {
      await deleteExpense(id);
      loadExpenses();
    } catch (err) {
      showToast(err.message || "Failed to remove expense. Please try again.", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Print-only header — replaces the sidebar/topbar context that's hidden when printing */}
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold text-gray-900">MARK Gadgets & Accessories Shop — Sales Report</h1>
        <p className="text-sm text-gray-600">
          {reportType} · {generatedRange.from} to {generatedRange.to}
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={22} className="text-gray-700" />
          <h1 className="text-xl font-bold text-gray-800">Reports</h1>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 bg-white px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          <Printer size={15} />
          Print Report
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => handleReportTypeChange(e.target.value)}
              className="w-44 border border-gray-200 rounded-lg text-sm px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Range</label>
            <DateRangePicker value={customRange} onChange={handleCustomRangeChange} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Bulk Buyer</label>
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className="w-44 border border-gray-200 rounded-lg text-sm px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Sales</option>
              {bulkBuyerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Search size={15} />
            Generate Report
          </button>
        </div>
      </div>

      {/* Summary cards — icons/colored boxes are screen-only decoration; the
          same numbers already appear in the printed table's totals row. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <SummaryCard
          icon={ShoppingBag}
          iconBg="bg-green-50 text-green-600"
          label="TOTAL SALES"
          value={peso(totals.totalSales)}
          sub="Total Sales Amount"
          valueClass="text-green-600"
        />
        <SummaryCard
          icon={Receipt}
          iconBg="bg-blue-50 text-blue-600"
          label="TOTAL TRANSACTIONS"
          value={totals.totalTransactions}
          sub="Total Transactions"
          valueClass="text-blue-600"
        />
        <SummaryCard
          icon={Package}
          iconBg="bg-purple-50 text-purple-600"
          label="TOTAL ITEMS SOLD"
          value={totals.totalItems}
          sub="Total Items Sold"
          valueClass="text-purple-600"
        />
        <SummaryCard
          icon={TrendingUp}
          iconBg="bg-orange-50 text-orange-600"
          label="AVERAGE SALE"
          value={peso(totals.avgSale)}
          sub="Average per Transaction"
          valueClass="text-orange-500"
        />
      </div>

      {/* Report table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <p className="font-bold text-gray-800">Sales Report</p>
          <div className="flex gap-2 print:hidden">
            {[
              { id: "all", label: "All" },
              { id: "cash", label: "Cash Sales Only" },
              { id: "expenses", label: "Expenses Only" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  viewMode === opt.id
                    ? "border-blue-500 bg-blue-50 text-blue-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode !== "expenses" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50">
                  <th className="px-3 py-2.5 font-medium rounded-l-lg">#</th>
                  <th className="px-3 py-2.5 font-medium">Date &amp; Time</th>
                  <th className="px-3 py-2.5 font-medium">Batch Code</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Unit Sold</th>
                  <th className="px-3 py-2.5 font-medium text-right">Total Amount</th>
                  <th className="px-3 py-2.5 font-medium text-right">Profit</th>
                  <th className="px-3 py-2.5 font-medium rounded-r-lg">Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      No transactions found for the selected date range.
                    </td>
                  </tr>
                ) : displayedRows.map((row, index) => (
                  <tr key={row.txn} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-3 text-gray-500">{index + 1}</td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                      {row.date} {row.time}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{row.txn}</td>
                    <td className="px-3 py-3 text-gray-700">{row.customer || "—"}</td>
                    <td className="px-3 py-3 text-gray-800 font-medium">
                      {[row.device, row.storage, row.color].filter(Boolean).join(" · ")}
                      {isPendingBulk(row) && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-600 align-middle">
                          Bulk · Pending
                        </span>
                      )}
                    </td>
                    {isPendingBulk(row) ? (
                      <>
                        <td className="px-3 py-3 text-right text-orange-500 italic">Pending</td>
                        <td className="px-3 py-3 text-right text-orange-500 italic">Pending</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-gray-800 text-right">{peso(row.amount)}</td>
                        <td
                          className={`px-3 py-3 text-right font-medium ${
                            row.netProfit == null ? "text-gray-400" : row.netProfit < 0 ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {row.netProfit != null ? peso(row.netProfit) : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3 text-gray-700">{row.payment}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-800">
                  <td className="px-3 py-3 rounded-l-lg" colSpan={4}>
                    {viewMode === "cash" ? "TOTAL (CASH)" : "TOTAL"}
                  </td>
                  <td className="px-3 py-3 text-center">{displayedTotals.totalItems}</td>
                  <td className="px-3 py-3 text-right">{peso(displayedTotals.totalSales)}</td>
                  <td className={`px-3 py-3 text-right ${displayedTotals.totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>
                    {peso(displayedTotals.totalProfit)}
                  </td>
                  <td className="px-3 py-3 rounded-r-lg"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {viewMode !== "cash" && (
          <div className={viewMode === "expenses" ? "" : "mt-6 pt-6 border-t border-gray-100"}>
            <p className="font-semibold text-gray-700 mb-3">Expenses</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="px-3 py-2.5 font-medium rounded-l-lg">Date</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                    {isAdmin && (
                      <th className="px-3 py-2.5 font-medium rounded-r-lg text-right print:hidden">Remove</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className="py-6 text-center text-gray-400">
                        No expenses recorded for this period.
                      </td>
                    </tr>
                  ) : filteredExpenses.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{e.date}</td>
                      <td className="px-3 py-3 text-gray-800 font-medium">
                        {e.description}
                        {e.category === "Cargo" && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 align-middle">
                            Cargo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-red-500 text-right">-{peso(e.amount)}</td>
                      {isAdmin && (
                        <td className="px-3 py-3 text-right print:hidden">
                          <button
                            onClick={() => handleRemoveExpense(e.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold text-gray-800">
                    <td className="px-3 py-3 rounded-l-lg" colSpan={2}>TOTAL EXPENSES</td>
                    <td className={`px-3 py-3 text-right text-red-500 ${isAdmin ? "" : "rounded-r-lg"}`}>
                      -{peso(categoryTotals.General + categoryTotals.Cargo)}
                    </td>
                    {isAdmin && <td className="px-3 py-3 rounded-r-lg"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="font-semibold text-gray-700 mt-6 mb-3">Add Expense</p>

            {expenseError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 print:hidden">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{expenseError}</p>
              </div>
            )}

            <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-3 print:hidden">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-40 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Electricity bill"
                  className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-32 border border-gray-200 rounded-lg text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-32 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="General">General</option>
                  <option value="Cargo">Cargo</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={submittingExpense}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus size={14} />
                {submittingExpense ? "Adding..." : "Add Expense"}
              </button>
            </form>

            {/* Vertical breakdown, below the form — same layout as Financial's:
                a fixed-width column keeps every value flush regardless of
                label length. Expenses/Cargo open the same breakdown modal. */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end print:hidden">
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-sm text-gray-600 px-2 py-1.5">
                  <span>Store Profit</span>
                  <span className="font-medium tabular-nums">{peso(totals.totalProfit)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpenseModalCategory("General")}
                  className="flex justify-between w-full text-sm text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50"
                >
                  <span>Expenses</span>
                  <span className="font-medium tabular-nums">-{peso(categoryTotals.General)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalCategory("Cargo")}
                  className="flex justify-between w-full text-sm text-amber-600 px-2 py-1.5 rounded-lg hover:bg-amber-50"
                >
                  <span>Cargo</span>
                  <span className="font-medium tabular-nums">-{peso(categoryTotals.Cargo)}</span>
                </button>
                <div
                  className={`flex justify-between text-base font-bold px-2 py-2 mt-1 border-t border-gray-100 ${
                    netProfit < 0 ? "text-red-500" : "text-gray-800"
                  }`}
                >
                  <span>Net Profit</span>
                  <span className="tabular-nums">{peso(netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 print:hidden">
        <span className="font-medium">Note:</span>
        <span>
          This report is based on the selected date range. An unpaid Bulk order shows as a row but its amount
          and profit stay out of the totals until it's marked Paid (Supplier Payables → Bulk Buyers).
        </span>
      </div>

      {expenseModalCategory && (
        <ExpenseCategoryModal
          category={expenseModalCategory}
          entries={expensesByCategory[expenseModalCategory]}
          isAdmin={isAdmin}
          onRemove={handleRemoveExpense}
          onAdd={handleAddExpenseFromModal}
          onClose={() => setExpenseModalCategory(null)}
        />
      )}
    </div>
  );
}

export default Reports;
