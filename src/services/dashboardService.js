import { supabase } from "../lib/supabaseClient";
import { formatTime } from "../utils/datetime";

export async function getRecentActivity() {
  const { data, error } = await supabase
    .from("recent_device_activity_view")
    .select("*")
    .order("date_added", { ascending: false })
    .limit(10);

  if (error) throw error;

  return data.map((d) => ({
    batchCode: d.batch_code,
    device: d.device_name,
    storage: d.storage,
    status: d.status,
    customer: d.customer_name || "",
    phone: d.customer_phone || "",
    time: formatTime(d.date_added),
  }));
}
