import { supabase } from "../lib/supabaseClient";
import { formatDate, formatTime } from "../utils/datetime";

export async function getSalesHistory() {
  const { data, error } = await supabase.from("sale_items").select(`
    id,
    price_at_sale,
    quantity,
    sales:sale_id (
      id,
      customer_name,
      customer_phone,
      payment_method,
      notes,
      reference_number,
      status,
      order_type,
      payment_status,
      down_payment,
      balance,
      sold_at,
      profiles:salesperson_id ( name )
    ),
    devices:device_id (
      id,
      batch_code,
      device_name,
      category,
      storage,
      color,
      status,
      purchase_price,
      date_added,
      suppliers:supplier_id ( name )
    )
  `);

  if (error) throw error;

  return data
    .slice()
    .sort((a, b) => new Date(b.sales?.sold_at) - new Date(a.sales?.sold_at))
    .map((item) => {
      const total = item.price_at_sale * item.quantity;
      const purchasePrice = item.devices?.purchase_price;
      return {
        saleItemId: item.id,
        saleId: item.sales?.id,
        deviceId: item.devices?.id,
        batchCode: item.devices?.batch_code,
        date: formatDate(item.sales?.sold_at),
        time: formatTime(item.sales?.sold_at),
        // Raw timestamps, for prefilling Edit Sale's date inputs — date/time
        // above are already formatted for display only.
        soldAt: item.sales?.sold_at,
        dateAddedRaw: item.devices?.date_added,
        customer: item.sales?.customer_name,
        phone: item.sales?.customer_phone,
        notes: item.sales?.notes,
        referenceNumber: item.sales?.reference_number,
        device: item.devices?.device_name,
        category: item.devices?.category,
        storage: item.devices?.storage,
        color: item.devices?.color,
        salesperson: item.sales?.profiles?.name,
        payment: item.sales?.payment_method,
        total,
        // Capital/net profit are per-unit financial figures (Financial
        // page) — purchase_price wasn't captured for units added before
        // that field existed, so this stays null rather than pretending
        // profit is 0.
        purchasePrice: purchasePrice ?? null,
        netProfit: purchasePrice != null ? total - purchasePrice : null,
        supplier: item.devices?.suppliers?.name,
        dateReceived: formatDate(item.devices?.date_added),
        // orderType/paymentStatus live once per sale (not per unit) — every
        // row belonging to the same bulk order shares the same values here
        // simply because they all join in the same parent sales record.
        orderType: item.sales?.order_type,
        paymentStatus: item.sales?.payment_status,
        // Financing methods only (Skyro/Home Credit/Credit Card) — recorded
        // in place of a reference number, since a financed sale doesn't have one.
        downPayment: item.sales?.down_payment ?? null,
        balance: item.sales?.balance ?? null,
        // The device's own status wins when it's since been returned — the
        // sale itself is still "Completed" (no refund happened), but this
        // row represents that specific unit, which is no longer with the
        // customer. A replaced return sends the original unit straight to
        // Supplier Defective, so that status also counts as "Returned".
        status:
          item.devices?.status === "Customer Returned" || item.devices?.status === "Supplier Defective"
            ? "Returned"
            : item.sales?.status,
      };
    });
}

// Corrects a sale after the fact (Sales History's Edit action, admin-only).
// Customer/notes/reference/financing/sold-at live on the shared sales row,
// so editing them from any one unit of a Bulk order updates every sibling
// row in that order too — price and date added are per-device, scoped to
// just this one.
export async function editSale({
  saleItemId,
  customerName,
  customerPhone,
  notes,
  referenceNumber,
  downPayment,
  balance,
  priceAtSale,
  soldAt,
  dateAdded,
}) {
  const { error } = await supabase.rpc("edit_sale", {
    p_sale_item_id: saleItemId,
    p_customer_name: customerName || null,
    p_customer_phone: customerPhone || null,
    p_notes: notes || null,
    p_reference_number: referenceNumber || null,
    p_down_payment: downPayment ?? null,
    p_balance: balance ?? null,
    p_price_at_sale: priceAtSale,
    p_sold_at: soldAt,
    p_date_added: dateAdded,
  });
  if (error) throw error;
}

// Deletes this one unit's sale outright — same "undo the sale" operation
// as editing the device back to Available (see update_device), just
// triggered directly from Sales History. The unit goes back to Available;
// a Bulk order's other units are untouched; the parent sale itself is only
// removed if this was its last remaining item (see delete_sale_item).
export async function deleteSaleItem(saleItemId) {
  const { error } = await supabase.rpc("delete_sale_item", { p_sale_item_id: saleItemId });
  if (error) throw error;
}

// payment_status lives once on the sales row (one invoice), not per
// sale_item — updating it here is all that's needed for every unit in a
// bulk order to show Paid, since they all just join in this same row.
export async function updateSalePaymentStatus(saleId, paymentStatus) {
  const { error } = await supabase.from("sales").update({ payment_status: paymentStatus }).eq("id", saleId);
  if (error) throw error;
}

// cartItems: [{ id (device uuid), price }]. Each cart line is one specific
// serialized device, so quantity per line item is always 1. Runs as a single
// atomic RPC (see process_sale in schema.sql) so a dropped connection can't
// leave a sale recorded with its devices still "Available".
export async function processSale({
  customerName,
  paymentMethod,
  referenceNumber,
  notes,
  cartItems,
  downPayment,
  balance,
  forceBulk,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  // process_sale returns the new sale's id — used to print a receipt
  // (batch code barcode) right after checkout without a second round trip.
  const { data, error } = await supabase.rpc("process_sale", {
    p_customer_name: customerName || null,
    p_salesperson_id: session?.user?.id || null,
    p_payment_method: paymentMethod,
    p_reference_number: referenceNumber || null,
    p_notes: notes || null,
    p_total_amount: total,
    p_cart_items: cartItems.map((item) => ({ device_id: item.id, price: item.price })),
    p_down_payment: downPayment ?? null,
    p_balance: balance ?? null,
    p_force_bulk: forceBulk ?? false,
  });
  if (error) throw error;
  return data;
}

// Most recent sale date for a device, if it's ever been sold — used by
// Device Details to show "Date Sold" without joining sales onto every
// device in the main list.
export async function getDeviceSaleDate(deviceId) {
  const info = await getDeviceSaleInfo(deviceId);
  return info?.soldAt ?? null;
}

// Powers Device Details' "Date Sold" and "Sold To" rows — the customer name
// entered at checkout, so anyone looking a unit up by batch code (e.g. to
// process a replacement) can see who it went to without a separate lookup.
export async function getDeviceSaleInfo(deviceId) {
  const { data, error } = await supabase
    .from("sale_items")
    .select("sales:sale_id ( sold_at, customer_name )")
    .eq("device_id", deviceId);

  if (error) throw error;

  const sales = data.map((d) => d.sales).filter(Boolean);
  if (sales.length === 0) return null;
  const latest = sales.sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at))[0];
  return { soldAt: latest.sold_at, customerName: latest.customer_name };
}

export async function getSalesThisMonth() {
  const { data, error } = await supabase
    .from("sales_by_month_view")
    .select("month, sales, month_start")
    .order("month_start");

  if (error) throw error;

  return data.map(({ month, sales, month_start }) => ({ month, sales, monthStart: month_start }));
}
