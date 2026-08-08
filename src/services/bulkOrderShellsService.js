import { supabase } from "../lib/supabaseClient";

// A shipment placeholder — logged the night a bulk shipment arrives (before
// staff have time to enter every individual unit), then linked from Add
// Device the next morning as each unit gets its own batch code. Returns the
// new shell's id — LogShipmentArrivalModal's direct-add path (bulk-identical
// accessories) immediately links every unit it inserts back to this same
// shell in the same submit, so the shipment still shows up for supplier
// payables tracking even though no one visits Add Device afterward.
export async function createBulkOrderShell({
  supplierName,
  deviceName,
  storage,
  color,
  quantityExpected,
  unitCost,
  dateArrived,
  notes,
}) {
  let supplierId = null;
  if (supplierName) {
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id")
      .eq("name", supplierName)
      .single();
    if (supplierError) throw supplierError;
    supplierId = supplier.id;
  }

  const { data, error } = await supabase
    .from("bulk_order_shells")
    .insert({
      supplier_id: supplierId,
      device_name: deviceName,
      storage: storage || null,
      color: color || null,
      quantity_expected: quantityExpected,
      unit_cost: unitCost ?? null,
      date_arrived: dateArrived,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function mapShellProgress(s) {
  return {
    id: s.id,
    supplierName: s.supplier_name,
    deviceName: s.device_name,
    storage: s.storage,
    color: s.color,
    quantityExpected: s.quantity_expected,
    dateArrived: s.date_arrived,
    linkedCount: s.linked_count,
    status: s.status,
  };
}

// Pending shells with how many units have been linked to each so far — for
// Add Device's "Link to Pending Shipment" dropdown and the All Devices
// progress display.
export async function getPendingShellsWithProgress() {
  const { data, error } = await supabase
    .from("bulk_order_shell_progress_view")
    .select("*")
    .eq("status", "Pending")
    .order("date_arrived", { ascending: false });

  if (error) throw error;
  return data.map(mapShellProgress);
}

// Every shell (Pending and Completed) with its progress — used to group the
// All Devices table into one row per shipment (supplier + day) instead of
// one row per unit, when the "Bulk shipment units only" filter is on.
export async function getAllShellsWithProgress() {
  const { data, error } = await supabase
    .from("bulk_order_shell_progress_view")
    .select("*")
    .order("date_arrived", { ascending: false });

  if (error) throw error;
  return data.map(mapShellProgress);
}

// What's owed to each supplier per shipment — amount_payable is computed in
// the view as unit_cost * quantity_expected (the agreed quantity), not how
// many units have actually been logged so far. Admin-only page.
export async function getSupplierPayables() {
  const { data, error } = await supabase
    .from("bulk_order_shell_progress_view")
    .select("*")
    .order("date_arrived", { ascending: false });

  if (error) throw error;

  return data.map((s) => ({
    ...mapShellProgress(s),
    unitCost: s.unit_cost,
    amountPayable: s.amount_payable,
    supplierPaymentStatus: s.supplier_payment_status,
    supplierPaidAt: s.supplier_paid_at,
  }));
}

export async function markShellPaid(shellId) {
  const { error } = await supabase.rpc("mark_bulk_order_shell_paid", { p_id: shellId });
  if (error) throw error;
}

export async function markShellUnpaid(shellId) {
  const { error } = await supabase.rpc("mark_bulk_order_shell_unpaid", { p_id: shellId });
  if (error) throw error;
}
