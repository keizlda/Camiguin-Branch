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
