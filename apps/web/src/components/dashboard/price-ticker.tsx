"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent } from "@/lib/utils";

function TickerItem({ asset }: { asset: any }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap px-4">
      <span className="font-medium text-sm">{asset.symbol}</span>
      <span className="text-sm">
        {formatEur(asset.currentPriceEur ?? asset.currentPrice ?? 0)}
      </span>
      {asset.currency !== "EUR" && asset.currentPrice != null && (
        <span className="text-xs text-muted-foreground">
          {formatCurrency(asset.currentPrice)}
        </span>
      )}
      <span
        className={`text-xs font-medium ${
          (asset.changePercent || 0) >= 0 ? "text-green-500" : "text-red-500"
        }`}
      >
        {formatPercent(asset.changePercent || 0)}
      </span>
    </div>
  );
}

export function PriceTicker() {
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    const fetchPrices = () => {
      api
        .getAssets({ limit: 20 })
        .then((res) => setAssets(res.data || []))
        .catch(() => {});
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  if (assets.length === 0) return null;

  // Scale duration with number of items so speed feels consistent
  const duration = Math.max(20, assets.length * 3);

  return (
    <div className="overflow-hidden border-b bg-card">
      <div
        className="items-center py-2 animate-ticker"
        style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}
      >
        {/* First copy */}
        {assets.map((a) => (
          <TickerItem key={`a-${a.symbol}`} asset={a} />
        ))}
        {/* Duplicate for seamless loop */}
        {assets.map((a) => (
          <TickerItem key={`b-${a.symbol}`} asset={a} />
        ))}
      </div>
    </div>
  );
}
