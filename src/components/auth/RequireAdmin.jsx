import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentProfile } from "../../services/authService";

// The first admin-only route in the app — bounces non-admins back to the
// dashboard rather than letting them see supplier payment amounts.
//
// Unlike RequireAuth (which reacts live to onAuthStateChange), a role
// demotion doesn't fire any auth event — profiles.role is an ordinary
// database row, not part of the session/token Supabase's auth listener
// watches, so an admin already sitting on this page would otherwise keep
// full access until they navigate away and back or reload, no matter how
// their role changed underneath them. Re-checking on an interval instead
// of only on mount closes most of that window without needing a realtime
// subscription just for this.
const RECHECK_INTERVAL_MS = 60_000;

function RequireAdmin({ children }) {
  const [profile, setProfile] = useState(undefined); // undefined = still checking

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      // A failed fetch (network blip, etc.) must not leave this stuck on
      // "undefined" forever — that would render a blank page with no
      // feedback instead of either granting or denying access. Default to
      // denied, same as any other role mismatch.
      getCurrentProfile()
        .then((p) => {
          if (!cancelled) setProfile(p);
        })
        .catch(() => {
          if (!cancelled) setProfile(null);
        });
    };
    check();
    const interval = setInterval(check, RECHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (profile === undefined) {
    return null;
  }

  if (profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default RequireAdmin;
