import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentProfile } from "../../services/authService";

// The first admin-only route in the app — bounces non-admins back to the
// dashboard rather than letting them see supplier payment amounts.
function RequireAdmin({ children }) {
  const [profile, setProfile] = useState(undefined); // undefined = still checking

  useEffect(() => {
    // A failed fetch (network blip, etc.) must not leave this stuck on
    // "undefined" forever — that would render a blank page with no
    // feedback instead of either granting or denying access. Default to
    // denied, same as any other role mismatch.
    getCurrentProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
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
