import { useState, useEffect } from "react";
import { useToast } from "./useToast";

/**
 * Calls an async service function on mount and stores the resolved result.
 * Services currently resolve instantly (mock data), but keeping this async
 * from the start means swapping a service's internals for a real API call
 * later won't require touching the components that consume it.
 *
 * A failed fetch used to leave `data` at its initial value forever with no
 * indication anything went wrong — a transient network/RLS error read to
 * the user as "the data is gone" (empty list/blank field), not "a query
 * failed." Every caller of this hook sits under ToastProvider (it wraps
 * the whole app in App.jsx), so surfacing the failure here covers every
 * page that uses it without needing each one to handle it separately.
 */
export function useServiceData(fetcher, initialValue) {
  const [data, setData] = useState(initialValue);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || "Failed to load data. Please refresh and try again.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, showToast]);

  return data;
}
