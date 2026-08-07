// Static reference constants — UI-only lookup lists that don't come from
// Supabase. Business records live in the database; see src/services/.
//
// Categories/brands (and models/colors within them) used to live here too,
// but the admin can now add/remove both at runtime — see the categories and
// product_models tables in the database, and getProductCatalog/
// getDeviceCategories in referenceService.js.

export const deviceStorages = ["64GB", "128GB", "256GB", "512GB", "1TB"];

// Accessories/Repair Parts aren't serialized phone-like devices — no
// Color/Storage, a different condition vocabulary, and a different
// supplier list all key off this same check. Works with either the
// singular (Add Device's form) or plural/DB category spelling, since
// these two names don't have a singular/plural distinction. Every other
// category (all serialized-device brands, Apple or Android) is not
// accessory-like — this hardcoded pair is unaffected by new brands added
// through Manage Catalog, since a brand-new phone brand is never
// accessory-like by definition.
export function isAccessoryLikeCategory(category) {
  return category === "Accessories" || category === "Repair Parts";
}

// Home Credit is no longer offered for new sales (see NewSale.jsx's
// installmentOptions, replaced by PayJoy) but stays here so Sales History's
// payment-method filter can still find sales that used it.
export const paymentMethods = [
  "Cash",
  "GCash",
  "Credit Card",
  "Bank Transfer",
  "Check",
  "Skyro",
  "Home Credit",
  "PayJoy",
  "Swap",
];

export const returnReasons = [
  "Defective Unit",
  "Changed Mind",
  "Not as Described",
  "Not Compatible",
  "Wrong Item Ordered",
];

export const returnTypes = [
  "Defective Unit",
  "Changed Mind",
  "Not as Described",
  "Not Compatible",
];
