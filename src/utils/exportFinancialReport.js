import writeXlsxFile from "write-excel-file/browser";

const HEADER_STYLE = { fontWeight: "bold", backgroundColor: "#f3f4f6" };

// Mirrors Financial.jsx's own isPendingBulk — a Bulk order starts
// payment_status='Pending' until confirmed paid (see process_sale), and
// the Summary sheet's totals exclude those rows the same way the on-screen
// ledger does. Without a way to tell which Sales-sheet rows are Pending
// Bulk, the two sheets silently don't add up to each other; this labels
// them so the gap is traceable instead of a surprise.
function isPendingBulk(row) {
  return row.orderType === "Bulk" && row.paymentStatus === "Pending";
}

// columns: [{ label, key, type, width, format }]. Builds one sheet's worth
// of { value, type }-shaped rows from a header row + plain data objects —
// write-excel-file wants every cell explicitly typed, so this is the one
// place that boilerplate lives instead of repeating it per sheet.
function buildSheet(columns, rows) {
  const header = columns.map((c) => ({ value: c.label, ...HEADER_STYLE }));
  const body = rows.map((row) =>
    columns.map((c) => {
      const raw = row[c.key];
      return {
        value: raw ?? (c.type === Number ? 0 : ""),
        type: c.type || String,
        format: c.format,
      };
    })
  );
  return {
    data: [header, ...body],
    columns: columns.map((c) => ({ width: c.width || 16 })),
  };
}

// Financial's own Summary sheet doesn't come from a list of rows — just a
// flat set of label/value pairs, so it's built directly rather than through
// buildSheet's per-column shape.
function buildSummarySheet({ reportType, generatedRange, totals, expenseTotals, netProfit, unsoldTotals }) {
  const rows = [
    ["MARK Gadgets & Accessories Shop — Financial Report", ""],
    ["Report Type", reportType],
    ["Date Range", `${generatedRange.from || "—"} to ${generatedRange.to || "—"}`],
    ["Generated", new Date().toLocaleString("en-PH")],
    ["", ""],
    ["Store Capital", totals.totalCapital],
    ["Store Disposal", totals.totalDisposal],
    ["Store Net Profit", totals.totalNetProfit],
    ["", ""],
    ["Expenses", -expenseTotals.expenses],
    ["Cargo", -expenseTotals.cargo],
    ["Prulife", -expenseTotals.prulife],
    ["Personal", -expenseTotals.personal],
    ["", ""],
    ["NET PROFIT (after expenses)", netProfit],
    ["", ""],
    ["Units In Stock (on hand, current)", unsoldTotals.count],
    ["Capital Tied Up (on hand, current)", unsoldTotals.totalCapital],
  ];
  const data = rows.map(([label, value]) => [
    { value: label, fontWeight: label && !label.includes(" ") ? undefined : "bold" },
    typeof value === "number"
      ? { value, type: Number, format: "#,##0.00" }
      : { value: value ?? "", type: String },
  ]);
  return { data, columns: [{ width: 34 }, { width: 22 }] };
}

export async function exportFinancialReport({
  reportType,
  generatedRange,
  storeRows,
  expenses,
  unsoldUnits,
  totals,
  expenseTotals,
  netProfit,
  unsoldTotals,
}) {
  const summarySheet = buildSummarySheet({
    reportType,
    generatedRange,
    totals,
    expenseTotals,
    netProfit,
    unsoldTotals,
  });

  const storeSheet = buildSheet(
    [
      { label: "Date", key: "date", width: 14 },
      { label: "Batch Code", key: "batchCode", width: 14 },
      { label: "Unit", key: "unit", width: 30 },
      { label: "Capital", key: "capital", type: Number, format: "#,##0.00" },
      { label: "Disposal Price", key: "disposal", type: Number, format: "#,##0.00" },
      { label: "Net Profit", key: "profit", type: Number, format: "#,##0.00" },
      { label: "Payment Method", key: "payment", width: 16 },
      { label: "Salesperson", key: "salesperson", width: 16 },
      { label: "Supplier", key: "supplier", width: 16 },
      { label: "Status", key: "rowStatus", width: 16 },
    ],
    storeRows.map((r) => ({
      date: r.date,
      batchCode: r.batchCode,
      unit: [r.device, r.storage].filter(Boolean).join(" · "),
      capital: r.purchasePrice ?? 0,
      disposal: r.total,
      profit: r.netProfit ?? 0,
      payment: r.payment,
      salesperson: r.salesperson,
      supplier: r.supplier,
      // Not in the Summary sheet's totals below — same rule as the
      // on-screen ledger (isPendingBulk), called out here so the two
      // sheets' totals not matching is traceable, not a silent gap.
      rowStatus: isPendingBulk(r) ? "Pending (Bulk, excluded from totals)" : r.status === "Returned" ? "Returned" : "",
    }))
  );

  const expensesSheet = buildSheet(
    [
      { label: "Date", key: "date", width: 14 },
      { label: "Description", key: "description", width: 30 },
      { label: "Category", key: "category", width: 14 },
      { label: "Amount", key: "amount", type: Number, format: "#,##0.00" },
      { label: "Admin Only", key: "adminOnly", width: 12 },
    ],
    expenses.map((e) => ({
      date: e.date,
      description: e.description,
      category: e.category,
      amount: e.amount,
      adminOnly: e.adminOnly ? "Yes" : "",
    }))
  );

  const onHandSheet = buildSheet(
    [
      { label: "Batch Code", key: "batchCode", width: 14 },
      { label: "Device", key: "device", width: 22 },
      { label: "Storage", key: "storage", width: 10 },
      { label: "Status", key: "status", width: 16 },
      { label: "Supplier", key: "supplier", width: 16 },
      { label: "Purchase Price", key: "purchasePrice", type: Number, format: "#,##0.00" },
      { label: "Date Added", key: "dateAdded", width: 14 },
    ],
    unsoldUnits.map((d) => ({
      batchCode: d.batchCode,
      device: d.device,
      storage: d.storage,
      status: d.status,
      supplier: d.supplier,
      purchasePrice: d.purchasePrice ?? 0,
      dateAdded: d.dateAdded,
    }))
  );

  const names = ["Summary", "Sales", "Expenses", "On Hand"];
  const sheets = [summarySheet, storeSheet, expensesSheet, onHandSheet].map((s, i) => ({
    sheet: names[i],
    data: s.data,
    columns: s.columns,
  }));
  const label = `${generatedRange.from || "all"}_to_${generatedRange.to || "all"}`;

  // v4's writeXlsxFile() returns { toBlob, toFile } rather than triggering
  // the download itself — the fileName goes to .toFile(), not the options.
  await writeXlsxFile(sheets, {}).toFile(`MARK Gadgets & Accessories Shop Financial Report - ${reportType} - ${label}.xlsx`);
}
