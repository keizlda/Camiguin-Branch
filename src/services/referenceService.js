import {
  deviceCategories,
  deviceStorages,
  productCatalogMeta,
  paymentMethods,
  posCategories,
  returnReasons,
  returnTypes,
} from "../data/referenceData";
import { supabase } from "../lib/supabaseClient";

export async function getDeviceCategories() {
  return deviceCategories;
}

export async function getDeviceStorages() {
  return deviceStorages;
}

// Shapes the database-backed models/colors into the same
// { [category]: { brand, models, modelColors, storages } } structure every
// consumer (Add Device, Quick Add, Log Shipment Arrival) already expects.
export async function getProductCatalog() {
  const { data, error } = await supabase
    .from("product_models")
    .select("category, name, colors")
    .order("name");
  if (error) throw error;

  const catalog = {};
  for (const category of Object.keys(productCatalogMeta)) {
    const models = data.filter((m) => m.category === category);
    catalog[category] = {
      brand: productCatalogMeta[category].brand,
      storages: productCatalogMeta[category].storages,
      models: models.map((m) => m.name),
      modelColors: Object.fromEntries(models.map((m) => [m.name, m.colors])),
    };
  }
  return catalog;
}

// The admin management view needs each model's id (to remove it or edit its
// colors), which the shaped getProductCatalog() result above doesn't carry.
export async function getCatalogModels() {
  const { data, error } = await supabase
    .from("product_models")
    .select("id, category, name, colors")
    .order("category")
    .order("name");
  if (error) throw error;
  return data;
}

export async function addProductModel({ category, name }) {
  const { error } = await supabase.from("product_models").insert({ category, name: name.trim(), colors: [] });
  if (error) throw error;
}

export async function removeProductModel(modelId) {
  const { error } = await supabase.from("product_models").delete().eq("id", modelId);
  if (error) throw error;
}

export async function addModelColor(modelId, colors, color) {
  const trimmed = color.trim();
  if (!trimmed || colors.includes(trimmed)) return;
  const { error } = await supabase
    .from("product_models")
    .update({ colors: [...colors, trimmed] })
    .eq("id", modelId);
  if (error) throw error;
}

export async function removeModelColor(modelId, colors, color) {
  const { error } = await supabase
    .from("product_models")
    .update({ colors: colors.filter((c) => c !== color) })
    .eq("id", modelId);
  if (error) throw error;
}

// type: "Device" or "Accessory" — omit to get every active supplier
// regardless of type (used where there's no category context to filter by).
// A supplier with no type set (e.g. "Walk-in") always shows, for either
// type — it's a generic source, not a vendor dedicated to one category.
export async function getSuppliers(type) {
  let query = supabase.from("suppliers").select("name").eq("active", true).order("name");
  if (type) query = query.or(`supplier_type.eq.${type},supplier_type.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((s) => s.name);
}

// The admin management view needs archived suppliers too (to restore them),
// which the active-only getSuppliers() above deliberately excludes.
export async function getAllSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, contact_info, active, supplier_type")
    .order("name");
  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.name, contactInfo: s.contact_info, active: s.active, supplierType: s.supplier_type }));
}

export async function addSupplier({ name, contactInfo, supplierType }) {
  const { error } = await supabase.from("suppliers").insert({
    name,
    contact_info: contactInfo || null,
    supplier_type: supplierType || "Device",
  });
  if (error) throw error;
}

// Archived instead of deleted — suppliers are referenced by id from past
// devices/shipments/defective records, so this only hides it from future
// picks in SupplierSelect rather than touching anything already on file.
export async function setSupplierActive(supplierId, active) {
  const { error } = await supabase.from("suppliers").update({ active }).eq("id", supplierId);
  if (error) throw error;
}

// Corrects which category list a supplier shows up in — for a supplier
// added under the wrong type, or "Walk-in"-style entries the admin wants
// to narrow from universal to one specific type.
export async function setSupplierType(supplierId, supplierType) {
  const { error } = await supabase.from("suppliers").update({ supplier_type: supplierType }).eq("id", supplierId);
  if (error) throw error;
}

export async function getSalespersons() {
  const { data, error } = await supabase.from("profiles").select("name").order("name");
  if (error) throw error;
  return data.map((p) => p.name);
}

export async function getPaymentMethods() {
  return paymentMethods;
}

export async function getPosCategories() {
  return posCategories;
}

export async function getReturnReasons() {
  return returnReasons;
}

export async function getReturnTypes() {
  return returnTypes;
}
