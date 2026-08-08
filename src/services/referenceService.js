import { deviceStorages, paymentMethods, returnReasons, returnTypes } from "../data/referenceData";
import { supabase } from "../lib/supabaseClient";

// devices.category values (db_value) — what's actually stored on a device
// row. Differs from getProductCatalog()'s keys only for the four original
// Apple categories, which kept their historical plural spelling (see
// categories.db_value in schema.sql).
export async function getDeviceCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("db_value")
    .eq("active", true)
    .order("db_value");
  if (error) throw error;
  return data.map((c) => c.db_value);
}

// New Sale's category sidebar — same db_value list as getDeviceCategories,
// just with the "All Categories" option prepended.
export async function getPosCategories() {
  const categories = await getDeviceCategories();
  return ["All Categories", ...categories];
}

export async function getDeviceStorages() {
  return deviceStorages;
}

// Shapes the database-backed categories + models into the same
// { [category]: { brand, storages, models, prefix, dbValue, isAccessoryLike
// } } structure every consumer (Add Device, Quick Add, Log Shipment
// Arrival, batch-code generation) expects, keyed by categories.name (the
// singular/canonical form — matches product_models.category).
export async function getProductCatalog() {
  const [{ data: categories, error: catError }, { data: models, error: modelError }] = await Promise.all([
    supabase.from("categories").select("name, brand, storages, prefix, db_value, is_accessory_like").eq("active", true),
    supabase.from("product_models").select("category, name").order("name"),
  ]);
  if (catError) throw catError;
  if (modelError) throw modelError;

  const catalog = {};
  for (const c of categories) {
    const categoryModels = models.filter((m) => m.category === c.name);
    catalog[c.name] = {
      brand: c.brand,
      storages: c.storages,
      prefix: c.prefix,
      dbValue: c.db_value,
      isAccessoryLike: c.is_accessory_like,
      models: categoryModels.map((m) => m.name),
    };
  }
  return catalog;
}

// The admin's Manage Catalog → Categories tab needs every category
// (including archived ones, to restore them) — getProductCatalog() above
// deliberately excludes archived and doesn't carry the id needed to
// archive/restore.
export async function getAllCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, db_value, brand, prefix, storages, is_accessory_like, active")
    .order("name");
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    dbValue: c.db_value,
    brand: c.brand,
    prefix: c.prefix,
    storages: c.storages,
    isAccessoryLike: c.is_accessory_like,
    active: c.active,
  }));
}

// New brands/categories are always added with name === dbValue — the
// plural db_value quirk only applies to the four original Apple categories
// seeded directly in schema.sql, which already exist by the time this runs.
export async function addCategory({ name, brand, prefix, storages, isAccessoryLike }) {
  const trimmedName = name.trim();
  const { error } = await supabase.from("categories").insert({
    name: trimmedName,
    db_value: trimmedName,
    brand: brand.trim(),
    prefix: prefix.trim().toUpperCase(),
    storages,
    is_accessory_like: isAccessoryLike,
  });
  if (error) throw error;
}

// Archived instead of deleted — devices/product_models reference a category
// by name as free text, so this only hides it from future picks in Add
// Device without touching anything already on file under that category.
export async function setCategoryActive(categoryId, active) {
  const { error } = await supabase.from("categories").update({ active }).eq("id", categoryId);
  if (error) throw error;
}

// The admin management view needs each model's id (to remove it), which the
// shaped getProductCatalog() result above doesn't carry.
export async function getCatalogModels() {
  const { data, error } = await supabase
    .from("product_models")
    .select("id, category, name")
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

export async function getReturnReasons() {
  return returnReasons;
}

export async function getReturnTypes() {
  return returnTypes;
}
