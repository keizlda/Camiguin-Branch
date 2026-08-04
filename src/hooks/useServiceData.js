import { useState, useEffect } from "react";

/**
 * Calls an async service function on mount and stores the resolved result.
 * Services currently resolve instantly (mock data), but keeping this async
 * from the start means swapping a service's internals for a real API call
 * later won't require touching the components that consume it.
 */
export function useServiceData(fetcher, initialValue) {
  const [data, setData] = useState(initialValue);

  useEffect(() => {
    let cancelled = false;
    fetcher().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return data;
}
