"use client";

import { useEffect, useState, useCallback } from "react";

const POLL_INTERVAL = 60000; // 1 minute

export function usePolling(fetchFn: () => void | Promise<void>) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wrappedFetch = useCallback(async () => {
    await fetchFn();
    setLastUpdate(new Date());
  }, [fetchFn]);

  useEffect(() => {
    wrappedFetch();
    const id = setInterval(wrappedFetch, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [wrappedFetch]);

  return { lastUpdate };
}
