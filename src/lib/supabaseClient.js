import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

const REMEMBER_ME_KEY = "mark-gadgets-cgn:remember-me";

// Call before signing in. Supabase persists sessions in localStorage by
// default (survives closing the browser) — this makes that opt-in via the
// Login page's "Remember me" checkbox instead of always-on.
export function setRememberMe(remember) {
  localStorage.setItem(REMEMBER_ME_KEY, remember ? "true" : "false");
}

function isRemembered() {
  return localStorage.getItem(REMEMBER_ME_KEY) !== "false";
}

// "Remember me" checked → session lives in localStorage (survives browser
// restarts). Unchecked → sessionStorage only, so it's gone once the tab
// closes. Clears the other storage on write so a stale session can't linger
// in the wrong place after the preference changes between logins.
const authStorage = {
  getItem: (key) => (isRemembered() ? localStorage.getItem(key) : sessionStorage.getItem(key)),
  setItem: (key, value) => {
    if (isRemembered()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
});

const FETCH_PAGE_SIZE = 200;

// Supabase/PostgREST caps rows per request — a plain .select() with no
// range silently truncates once a table grows past that cap (first seen on
// devices: 1839 real rows, only 419 returned, which then propagated into
// every page that listed them). Pages through in batches well under the
// observed cutoff so growth past any single request's limit can't quietly
// drop rows again. `fetchPage(from, to)` should run the query for that row
// range (via .range(from, to)) and return the usual Supabase {data, error}.
export async function fetchAllRows(fetchPage) {
  const allRows = [];
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    allRows.push(...data);
    if (data.length < FETCH_PAGE_SIZE) break;
  }
  return allRows;
}
