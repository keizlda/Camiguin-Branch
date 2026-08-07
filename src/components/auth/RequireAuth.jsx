import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getSession, onAuthStateChange } from "../../services/authService";

function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    // A rejected getSession() (rare, but possible — a corrupted local
    // session, a network blip) must not leave `session` stuck at
    // `undefined` forever, which renders a blank page with no redirect
    // and no error. Falls back to "not logged in," same as any other
    // failure to establish a session.
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
    return onAuthStateChange(setSession);
  }, []);

  if (session === undefined) {
    return null;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireAuth;
