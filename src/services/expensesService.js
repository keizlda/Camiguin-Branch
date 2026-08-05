import { supabase } from "../lib/supabaseClient";

function mapExpense(e) {
  return {
    id: e.id,
    date: e.expense_date,
    description: e.description,
    amount: e.amount,
    adminOnly: e.admin_only,
    category: e.category,
  };
}

// Reports is reachable by any role, so it only ever shows General/Cargo —
// the two categories staff are meant to see, regardless of whether the
// entry was logged here or from Financial by an admin. Prulife/Personal
// stay out entirely; they're Financial-only categories.
export async function getExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, description, amount, admin_only, category")
    .in("category", ["General", "Cargo"])
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return data.map(mapExpense);
}

// Financial (admin-only) sees everything — both what staff logged on
// Reports and what admin logged here — for a complete picture.
export async function getAllExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, description, amount, admin_only, category")
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return data.map(mapExpense);
}

export async function addExpense({ date, description, amount, adminOnly = false, category = "General" }) {
  const { error } = await supabase.from("expenses").insert({
    expense_date: date,
    description,
    amount,
    admin_only: adminOnly,
    category,
  });
  if (error) throw error;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
