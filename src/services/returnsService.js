import { supabase } from "../lib/supabaseClient";
import { formatDate, formatTime } from "../utils/datetime";

export async function getCustomerReturns() {
  const { data, error } = await supabase.from("customer_returns").select(`
    id,
    reason,
    status,
    returned_at,
    sale_items:sale_item_id (
      device_id,
      sales:sale_id ( customer_name, customer_phone, sold_at ),
      devices:device_id ( batch_code, device_name, category, storage, color )
    ),
    replacement:replacement_device_id ( batch_code, device_name )
  `);

  if (error) throw error;

  return data
    .slice()
    .sort((a, b) => new Date(b.returned_at) - new Date(a.returned_at))
    .map((r) => ({
      id: r.id,
      deviceId: r.sale_items?.device_id,
      batchCode: r.sale_items?.devices?.batch_code,
      customer: r.sale_items?.sales?.customer_name,
      phone: r.sale_items?.sales?.customer_phone,
      device: r.sale_items?.devices?.device_name,
      storage: r.sale_items?.devices?.storage,
      color: r.sale_items?.devices?.color,
      category: r.sale_items?.devices?.category,
      reason: r.reason,
      purchaseDate: r.sale_items?.sales?.sold_at ? formatDate(r.sale_items.sales.sold_at) : null,
      returnDate: formatDate(r.returned_at),
      time: formatTime(r.returned_at),
      status: r.status,
      replacementBatchCode: r.replacement?.batch_code || null,
      replacementDevice: r.replacement?.device_name || null,
    }));
}

// Starts a return for a sold item — status starts Pending until it's
// resolved (replaced or rejected) on the Customer Returns page. Also moves
// the device to Customer Returned (see create_return in schema.sql) so it
// doesn't keep showing as a plain completed Sold unit while the return
// is pending.
export async function createReturn({ saleItemId, reason }) {
  const { error } = await supabase.rpc("create_return", {
    p_sale_item_id: saleItemId,
    p_reason: reason,
  });
  if (error) throw error;
}

// Resolves a return by handing the customer a replacement unit of the same
// model. The original (broken) unit is transferred straight to Supplier
// Defective — rather than sitting around as "Customer Returned" — with the
// return reason carried over as the issue description. The replacement is
// marked Sold and linked on the return record. No cash refunds. Runs as a
// single atomic RPC (see replace_return in schema.sql) so this 4-write
// sequence can't be left half-applied by a dropped connection.
export async function replaceReturn(returnId, originalDeviceId, replacementDeviceId, reason) {
  const { error } = await supabase.rpc("replace_return", {
    p_return_id: returnId,
    p_original_device_id: originalDeviceId,
    p_replacement_device_id: replacementDeviceId,
    p_reason: reason,
  });
  if (error) throw error;
}

// Customer keeps the unit after a rejected return, so the device goes
// back to Sold (see reject_return in schema.sql) instead of staying stuck
// at Customer Returned.
export async function rejectReturn(returnId) {
  const { error } = await supabase.rpc("reject_return", { p_return_id: returnId });
  if (error) throw error;
}
