"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPortfolios();
      setPortfolios(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { portfolios, loading, error, refetch: fetch };
}

export function usePortfolio(id: string) {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPortfolio(id);
      setPortfolio(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { portfolio, loading, error, refetch: fetch };
}

export function useHoldings(portfolioId: string) {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHoldings(portfolioId);
      setHoldings(data);
    } catch {
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { holdings, loading, refetch: fetch };
}
