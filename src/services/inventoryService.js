import { supabase } from "../lib/supabaseClient";
import { formatDate, formatTime } from "../utils/datetime";
import { expireOverdueReservations } from "./reservationsService";

const DEVICE_SELECT =
  "id, batch_code, device_name, category, storage, color, brand, status, supplier_id, purchase_price, selling_price, condition, notes, date_added, bulk_order_shell_id, date_arrived, suppliers:supplier_id ( name )";

function mapDevice(d) {
  return {
    id: d.id,
    batchCode: d.batch_code,
    device: d.device_name,
    category: d.category,
    storage: d.storage,
    color: d.color,
    brand: d.brand,
    status: d.status,
    supplier: d.suppliers?.name,
    purchasePrice: d.purchase_price,
    price: d.selling_price,
    condition: d.condition,
    notes: d.notes,
    dateAdded: formatDate(d.date_added),
    time: formatTime(d.date_added),
    bulkOrderShellId: d.bulk_order_shell_id,
    dateArrived: d.date_arrived,
  };
}

export async function getAllDevices() {
  await expireOverdueReservations();

  const { data, error } = await supabase.from("devices").select(DEVICE_SELECT);

  if (error) throw error;

  return data
    .slice()
    .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
    .map(mapDevice);
}

// Full device record for a single unit — used by Sales History's "Unit Info"
// action to show arrival date, original price, etc. for the specific unit
// that was sold, reusing the same modal as All Devices.
export async function getDeviceById(id) {
  const { data, error } = await supabase.from("devices").select(DEVICE_SELECT).eq("id", id).single();
  if (error) throw error;
  return mapDevice(data);
}

// Also creates the matching Supplier Defective record in the same atomic
// call when device.issueDescription is set and this is a genuine transition
// into that status (see update_device in schema.sql) — a dropped connection
// between "flip the status" and "create the record" used to be able to leave
// a device marked Supplier Defective with no record to show for it.
export async function updateDevice(id, device) {
  const { error } = await supabase.rpc("update_device", {
    p_id: id,
    p_batch_code: device.batchCode,
    p_device_name: device.deviceName,
    p_category: device.category,
    p_storage: device.storage,
    p_color: device.color,
    p_status: device.status,
    p_supplier_name: device.supplierName || null,
    p_price: device.price,
    p_notes: device.notes || null,
    p_issue_description: device.issueDescription || null,
    p_purchase_price: device.purchasePrice ?? null,
    p_condition: device.condition || null,
    p_brand: device.brand || null,
  });
  if (error) throw error;
}

// Admin-only, from All Devices — cleans up any sale/reservation/defective
// history first, then removes the device itself. Refuses (with a clear
// message) to touch a unit that's a live customer-return replacement,
// since deleting it would break traceability elsewhere (see
// admin_delete_device in schema.sql).
export async function deleteDevice(id) {
  const { error } = await supabase.rpc("admin_delete_device", { p_device_id: id });
  if (error) throw error;
}

// Available units of a given model — used to pick a replacement device
// when approving a customer return as an exchange rather than a refund.
export async function getAvailableDevicesForReplacement(deviceName) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, batch_code, device_name, storage, color, brand")
    .eq("status", "Available")
    .eq("device_name", deviceName);

  if (error) throw error;

  return data.map((d) => ({
    id: d.id,
    batchCode: d.batch_code,
    device: d.device_name,
    storage: d.storage,
    color: d.color,
    brand: d.brand,
  }));
}

// Every available unit, individually — New Sale sells specific serialized
// devices, not "quantity of a product", so each row here is one real unit.
export async function getAvailableDevicesForSale() {
  const { data, error } = await supabase
    .from("devices")
    .select("id, batch_code, device_name, category, storage, color, brand, selling_price, purchase_price")
    .eq("status", "Available");

  if (error) throw error;

  return data.map((d) => ({
    id: d.id,
    batchCode: d.batch_code,
    product: d.device_name,
    category: d.category,
    storage: d.storage,
    color: d.color,
    brand: d.brand,
    price: d.selling_price,
    purchasePrice: d.purchase_price,
  }));
}

// Finds the next unused sequence number for a batch code prefix (e.g.
// "073126-004" when 001-003 already exist for today) — auto-filling the
// whole code, not just the date part, removes the chance of two staff
// entries colliding on the same number.
export async function getNextBatchSequence(prefix) {
  const { data, error } = await supabase.from("devices").select("batch_code").like("batch_code", `${prefix}%`);
  if (error) throw error;

  const maxSeq = data.reduce((max, d) => {
    const n = parseInt(d.batch_code.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return maxSeq + 1;
}

// Also creates the matching Supplier Defective record in the same atomic
// call when device.issueDescription is set (see add_device in schema.sql) —
// a dropped connection between "insert the device" and "create the record"
// used to be able to leave a brand-new device marked Supplier Defective
// with no record to show for it.
//
// device.quantity (default 1) inserts that many identical rows sharing one
// batch code in the same atomic call — for bulk-identical accessories
// (headsets, cases) where every unit is interchangeable. Returns just the
// first row's id, which is all the "Print Label" prompt after saving
// needs (the whole batch prints as one shared label, not one per unit).
export async function addDevice(device) {
  const { data, error } = await supabase.rpc("add_device", {
    p_batch_code: device.batchCode,
    p_device_name: device.deviceName,
    p_category: device.category,
    p_storage: device.storage,
    p_color: device.color,
    p_status: device.status,
    p_supplier_name: device.supplierName || null,
    p_price: device.price,
    p_notes: device.notes || null,
    p_date_added: device.dateAdded,
    p_issue_description: device.issueDescription || null,
    p_bulk_order_shell_id: device.bulkOrderShellId || null,
    p_date_arrived: device.dateArrived || null,
    p_purchase_price: device.purchasePrice ?? null,
    p_condition: device.condition || null,
    p_quantity: device.quantity || 1,
    p_brand: device.brand || null,
  });

  if (error) throw error;
  return { id: data };
}

export async function getLowStockItems() {
  const { data, error } = await supabase.from("low_stock_view").select("*");

  if (error) throw error;

  return data
    .slice()
    .sort((a, b) => a.available - b.available)
    .map((r) => ({
      device: r.device_name,
      category: r.category,
      available: r.available,
      reorderLevel: r.reorder_level,
      estimatedValue: r.estimated_value,
      // A model with a reorder setting but zero units ever added has no
      // date_added to read last_updated from — formatDate(null) would
      // otherwise print the 1970 epoch instead of admitting there's no
      // date to show.
      lastUpdated: r.last_updated ? formatDate(r.last_updated) : "—",
      time: r.last_updated ? formatTime(r.last_updated) : "",
    }));
}

export async function getSupplierDefectiveRecords() {
  const { data, error } = await supabase.from("supplier_defective_records").select(`
    id,
    issue_description,
    status,
    action_taken,
    date_detected,
    device_id,
    devices:device_id ( batch_code, device_name, storage, color, brand ),
    suppliers:supplier_id ( name )
  `);

  if (error) throw error;

  return data
    .slice()
    .sort((a, b) => new Date(b.date_detected) - new Date(a.date_detected))
    .map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      batchCode: r.devices?.batch_code,
      device: r.devices?.device_name,
      storage: r.devices?.storage,
      color: r.devices?.color,
      brand: r.devices?.brand,
      supplier: r.suppliers?.name,
      dateDetected: formatDate(r.date_detected),
      dateDetectedRaw: r.date_detected,
      time: formatTime(r.date_detected),
      issue: r.issue_description,
      status: r.status,
      actionTaken: r.action_taken,
    }));
}

// Resolving a defective record means the unit is fixed and back in stock —
// this puts the device itself back to Available so it's no longer stuck
// showing "Supplier Defective" on All Devices and everywhere else. Runs as a
// single atomic RPC (see update_supplier_defective_status in schema.sql).
export async function updateSupplierDefectiveStatus(id, { status, actionTaken, deviceId }) {
  const { error } = await supabase.rpc("update_supplier_defective_status", {
    p_id: id,
    p_status: status,
    p_action_taken: actionTaken || null,
    p_device_id: deviceId || null,
  });
  if (error) throw error;
}

// Admin-only correction of the record's own fields (issue description,
// supplier, date detected) — batch code/device details are edited via the
// existing Edit Device flow instead.
export async function editSupplierDefectiveRecord(id, { issueDescription, supplierName, dateDetected }) {
  const { error } = await supabase.rpc("edit_supplier_defective_record", {
    p_id: id,
    p_issue_description: issueDescription,
    p_supplier_name: supplierName || null,
    p_date_detected: dateDetected,
  });
  if (error) throw error;
}
