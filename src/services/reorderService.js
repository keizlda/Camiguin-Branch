import { supabase } from "../lib/supabaseClient";
import { getProductCatalog } from "./referenceService";

export async function getReorderSettings() {
  const { data, error } = await supabase
    .from("reorder_settings")
    .select("id, device_name, reorder_level, enabled")
    .order("device_name");

  if (error) throw error;

  return data.map((r) => ({
    id: r.id,
    deviceName: r.device_name,
    reorderLevel: r.reorder_level,
    enabled: r.enabled,
  }));
}

// Every model name a reorder threshold could apply to — the full Add
// Device catalog (so it's not limited to models already in stock) plus any
// distinct device names actually in inventory (covers custom "Other" models
// staff typed in manually that aren't in the catalog).
// Same unbounded-fetch risk as getAllDevices in inventoryService.js — a
// plain .select() on the full devices table silently truncates once it
// outgrows Supabase's per-request row cap, so this paginates too.
async function getAllDeviceNames() {
  const names = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await supabase
      .from("devices")
      .select("device_name")
      .range(from, from + 199);
    if (error) throw error;
    names.push(...data.map((d) => d.device_name));
    if (data.length < 200) break;
  }
  return names;
}

export async function getDeviceModelNames() {
  const [catalog, inventoryModels] = await Promise.all([getProductCatalog(), getAllDeviceNames()]);

  const catalogModels = Object.values(catalog).flatMap((c) => c.models);
  return [...new Set([...catalogModels, ...inventoryModels])].sort();
}

export async function addReorderSetting({ deviceName, reorderLevel }) {
  const { error } = await supabase.from("reorder_settings").insert({
    device_name: deviceName,
    reorder_level: reorderLevel,
    enabled: true,
  });
  if (error) throw error;
}

export async function updateReorderSetting(id, { reorderLevel, enabled }) {
  const { error } = await supabase
    .from("reorder_settings")
    .update({ reorder_level: reorderLevel, enabled })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReorderSetting(id) {
  const { error } = await supabase.from("reorder_settings").delete().eq("id", id);
  if (error) throw error;
}
