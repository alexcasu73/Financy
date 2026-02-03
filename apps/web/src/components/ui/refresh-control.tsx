"use client";

import { RefreshCw } from "lucide-react";

interface RefreshControlProps {
  lastUpdate: Date | null;
}

export function RefreshControl({ lastUpdate }: RefreshControlProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw
        className="h-3 w-3 animate-spin"
        style={{ animationDuration: "3s" }}
      />
      {lastUpdate && (
        <span className="hidden sm:inline">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
