import { useServiceData } from "./useServiceData";
import { getCurrentProfile } from "../services/authService";

// Shared by every page that hides (not just gates) a specific action from
// staff — unlike RequireAdmin, these pages themselves stay reachable, only
// individual buttons differ by role.
export function useIsAdmin() {
  const profile = useServiceData(getCurrentProfile, null);
  return profile?.role === "admin";
}
