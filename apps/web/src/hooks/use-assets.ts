"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function useAssets(params?: { type?: string; sector?: string; search?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAssets(params);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [params?.type, params?.sector, params?.search]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useAsset(id: string) {
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAsset(id)
      .then(setAsset)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { asset, loading, error };
}

export function useAssetPrices(id: string, period?: string) {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getAssetPrices(id, period)
      .then(setPrices)
      .catch(() => setPrices([]))
      .finally(() => setLoading(false));
  }, [id, period]);

  return { prices, loading };
}

export function useAssetSignals(id: string) {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getAssetSignals(id)
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [id]);

  return { signals, loading };
}
