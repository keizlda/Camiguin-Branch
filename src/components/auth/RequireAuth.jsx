import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getSession, onAuthStateChange } from "../../services/authService";

function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    getSession().then(setSession);
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
