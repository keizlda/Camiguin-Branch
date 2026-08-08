import { supabase } from "../lib/supabaseClient";
import { formatDate, formatTime } from "../utils/datetime";

// No backend cron in this app — expiration is swept client-side whenever
// reservations or devices are read, so it's always caught up to date
// regardless of which page the user opens first. A reservation is valid
// through the whole of its reserved_until day, so it only expires once
// we're a full day past that (local) midnight. Runs as a single atomic RPC
// (see expire_overdue_reservations in schema.sql) so a batch of reservations
// can't end up expired without their devices being freed, or vice versa.
export async function expireOverdueReservations() {
  const { error } = await supabase.rpc("expire_overdue_reservations");
  if (error) throw error;
}

// Converted reservations already live on elsewhere (as a completed sale in
// Sales History) — keeping them here too would just be a stale duplicate.
// Expired ones, unlike Converted, stay in this list (same as Cancelled)
// for history — Reserved.jsx's own "Expired Reservations" stat card and
// action-menu branch are both built expecting that.
export async function getReservedDevices() {
  await expireOverdueReservations();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
    id,
    customer_name,
    customer_phone,
    reserved_until,
    status,
    total_price,
    down_payment,
    created_at,
    devices:device_id ( id, batch_code, device_name, category, storage, color, brand ),
    profiles:salesperson_id ( name )
  `
    )
    .neq("status", "Converted");

  if (error) throw error;

  const now = new Date();
  // How close to reserved_until counts as "coming up soon" for the
  // Expiring Soon badge/stat card below.
  const EXPIRING_SOON_DAYS = 2;

  return data
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => {
      const reservedUntilDate = new Date(r.reserved_until);
      const daysLeft = Math.ceil((reservedUntilDate - now) / (1000 * 60 * 60 * 24));
      // "Expiring Soon" is a real value in the status check constraint and
      // Reserved.jsx's UI (badge color, stat card, action-menu condition)
      // is fully built around it, but nothing ever wrote it to the
      // database — reservations only ever moved Active -> Cancelled/
      // Converted/Expired. Computed here instead of stored: it's a
      // moving target (how many days are left changes every day without
      // anything else about the reservation changing), so deriving it at
      // read time avoids needing a cron/RPC to keep a stored value from
      // going stale. The underlying status in the database stays 'Active'
      // — only this display value changes.
      const displayStatus = r.status === "Active" && daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS ? "Expiring Soon" : r.status;
      return {
        id: r.id,
        deviceId: r.devices?.id,
        batchCode: r.devices?.batch_code,
        dateReserved: formatDate(r.created_at),
        time: formatTime(r.created_at),
        customer: r.customer_name,
        phone: r.customer_phone,
        salesperson: r.profiles?.name,
        device: r.devices?.device_name,
        category: r.devices?.category,
        storage: r.devices?.storage,
        color: r.devices?.color,
        brand: r.devices?.brand,
        reservedUntil: formatDate(r.reserved_until),
        daysLeft,
        status: displayStatus,
        totalPrice: r.total_price,
        downPayment: r.down_payment,
      };
    });
}

export async function createReservation({
  deviceId,
  customerName,
  customerPhone,
  reservedUntil,
  totalPrice,
  downPayment,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase.rpc("create_reservation", {
    p_device_id: deviceId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_salesperson_id: session?.user?.id || null,
    // A date-only value parses as midnight UTC, which prints as 8 AM in
    // Manila and would make the expiration sweep cut the day short.
    p_reserved_until: new Date(`${reservedUntil}T00:00:00`).toISOString(),
    p_total_price: totalPrice,
    p_down_payment: downPayment || 0,
  });
  if (error) throw error;
}

export async function cancelReservation(reservationId, deviceId) {
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
    p_device_id: deviceId,
  });
  if (error) throw error;
}

export async function convertReservationToSale(
  reservationId,
  { deviceId, customerName, customerPhone, totalPrice, downPayment, paymentMethod, referenceNumber }
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const notes = downPayment
    ? `Down payment of ₱${Number(downPayment).toLocaleString()} already collected at reservation.`
    : null;

  const { error } = await supabase.rpc("convert_reservation_to_sale", {
    p_reservation_id: reservationId,
    p_device_id: deviceId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_total_price: totalPrice,
    p_payment_method: paymentMethod,
    p_reference_number: referenceNumber || null,
    p_notes: notes,
    p_salesperson_id: session?.user?.id || null,
  });
  if (error) throw error;
}
