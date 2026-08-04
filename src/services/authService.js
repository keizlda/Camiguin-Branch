import { supabase, setRememberMe } from "../lib/supabaseClient";

export async function signIn(email, password, remember = true) {
  setRememberMe(remember);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// The logged-in user's own name/role — RequireAuth guarantees a session
// exists by the time anything using this actually mounts.
export async function getCurrentProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return { ...data, email: session.user.email };
}

// Calls `callback(session)` immediately and on every future auth change.
// Returns an unsubscribe function for effect cleanup.
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
