// Static reference constants — mirror fixed schema CHECK constraints and
// UI-only lookup lists rather than dynamic business data, so they don't come
// from Supabase. Business records live in the database; see src/services/.
//
// Models and their colors used to live here too, but the admin can now
// add/remove them at runtime (see product_models in the database and
// getProductCatalog in referenceService.js) — only the parts that never
// change without a schema update (brand, storage sizes) stay static.

export const deviceCategories = ["iPhones", "iPads", "Apple Watches", "MacBooks", "Accessories", "Repair Parts"];
export const deviceStorages = ["64GB", "128GB", "256GB", "512GB", "1TB"];

// Accessories/Repair Parts aren't serialized phone-like devices — no
// Color/Storage, a different condition vocabulary, and a different
// supplier list all key off this same check. Works with either the
// singular (Add Device's form) or plural/DB category spelling, since
// these two names don't have a singular/plural distinction.
export function isAccessoryLikeCategory(category) {
  return category === "Accessories" || category === "Repair Parts";
}

// productCatalog keys are singular ("iPhone") to match how product_models.category
// is stored; devices.category in the DB is plural ("iPhones") to match its
// own CHECK constraint — AddDevice's categoryToDbValue maps between them.
export const productCatalogMeta = {
  iPhone: { brand: "Apple", storages: ["128GB", "256GB", "512GB", "1TB"] },
  iPad: { brand: "Apple", storages: ["64GB", "128GB", "256GB", "512GB"] },
  "Apple Watch": { brand: "Apple", storages: ["-"] },
  MacBook: { brand: "Apple", storages: ["256GB", "512GB", "1TB", "2TB"] },
  Accessories: { brand: "Various", storages: ["N/A"] },
  "Repair Parts": { brand: "Various", storages: ["N/A"] },
};

export const posCategories = [
  "All Categories",
  "iPhones",
  "iPads",
  "MacBooks",
  "Apple Watches",
  "Accessories",
  "Repair Parts",
];

export const paymentMethods = [
  "Cash",
  "GCash",
  "Credit Card",
  "Bank Transfer",
  "Check",
  "Skyro",
  "Home Credit",
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
