"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Check, Loader2, X, Star } from "lucide-react";
import { api } from "@/lib/api";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  sector?: string;
  industry?: string;
  isin?: string;
  isPrimary?: boolean;
}

interface SelectedAsset {
  id: string;
  symbol: string;
  name: string;
  type: string;
}

interface AddHoldingDialogProps {
  onAdd: (data: { assetId: string; quantity: number; avgBuyPrice: number }) => void;
}

export function AddHoldingDialog({ onAdd }: AddHoldingDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [shares, setShares] = useState("");
  const [amount, setAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [lastEdited, setLastEdited] = useState<"shares" | "amount">("shares");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs to always access latest values in handlers (avoids stale closures)
  const sharesRef = useRef(shares);
  const amountRef = useRef(amount);
  const buyPriceRef = useRef(buyPrice);
  const lastEditedRef = useRef(lastEdited);
  sharesRef.current = shares;
  amountRef.current = amount;
  buyPriceRef.current = buyPrice;
  lastEditedRef.current = lastEdited;

  const searchAssets = useCallback(async (search: string) => {
    if (search.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchAssets(search);
      setResults(res.results || []);
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || selectedAsset) return;
    const timeout = setTimeout(() => searchAssets(query), 300);
    return () => clearTimeout(timeout);
  }, [query, selectedAsset, searchAssets]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectAsset = async (result: SearchResult) => {
    setShowDropdown(false);
    setImporting(true);
    try {
      const asset = await api.importAsset({
        symbol: result.symbol,
        name: result.name,
        type: result.type,
        exchange: result.exchange,
        sector: result.sector,
        industry: result.industry,
      });
      setSelectedAsset({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
      });
      setQuery(asset.symbol);
    } catch {
      setSelectedAsset(null);
    } finally {
      setImporting(false);
    }
  };

  const clearAsset = () => {
    setSelectedAsset(null);
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const handleSharesChange = (value: string) => {
    setShares(value);
    setLastEdited("shares");
    const s = parseFloat(value);
    const p = parseFloat(buyPriceRef.current);
    if (s > 0 && p > 0) {
      setAmount((s * p).toFixed(2));
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setLastEdited("amount");
    const a = parseFloat(value);
    const p = parseFloat(buyPriceRef.current);
    if (a > 0 && p > 0) {
      setShares((a / p).toFixed(6));
    }
  };

  const handleBuyPriceChange = (value: string) => {
    setBuyPrice(value);
    const p = parseFloat(value);
    if (p > 0) {
      if (lastEditedRef.current === "shares") {
        const s = parseFloat(sharesRef.current);
        if (s > 0) setAmount((s * p).toFixed(2));
      } else {
        const a = parseFloat(amountRef.current);
        if (a > 0) setShares((a / p).toFixed(6));
      }
    }
  };

  const parsedShares = parseFloat(shares);
  const parsedPrice = parseFloat(buyPrice);
  const finalQty = parsedShares > 0 ? parsedShares : 0;

  const handleSubmit = () => {
    if (!selectedAsset || finalQty <= 0 || !(parsedPrice > 0)) return;

    onAdd({
      assetId: selectedAsset.id,
      quantity: finalQty,
      avgBuyPrice: parsedPrice,
    });
    resetForm();
    setOpen(false);
  };

  const resetForm = () => {
    setQuery("");
    setResults([]);
    setSelectedAsset(null);
    setShowDropdown(false);
    setShares("");
    setAmount("");
    setBuyPrice("");
    setLastEdited("shares");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Aggiungi Posizione
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi Posizione</DialogTitle>
          <DialogDescription>Cerca un asset su Yahoo Finance e aggiungilo al tuo portafoglio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Asset search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Asset</label>
            {selectedAsset ? (
              <div className="rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium">{selectedAsset.symbol}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedAsset.type}
                  </Badge>
                  <button onClick={clearAsset} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5 pl-6">{selectedAsset.name}</p>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="Cerca simbolo o nome (es. AAPL, Tesla, Bitcoin)..."
                    className="pl-9"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedAsset(null);
                    }}
                    onFocus={() => {
                      if (results.length > 0) setShowDropdown(true);
                    }}
                  />
                  {(searching || importing) && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showDropdown && results.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
                    {results.map((r) => (
                      <button
                        key={r.symbol}
                        type="button"
                        className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors overflow-hidden ${r.isPrimary ? "bg-primary/5" : ""}`}
                        onClick={() => selectAsset(r)}
                      >
                        {r.isPrimary && (
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        <span className="font-medium text-sm shrink-0">{r.symbol}</span>
                        <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">{r.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.isPrimary && (
                            <Badge variant="default" className="text-xs bg-yellow-500/90 hover:bg-yellow-500">
                              Principale
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {r.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{r.exchange}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && query.length >= 1 && !searching && results.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground text-center">
                    Nessun asset trovato
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Prezzo di acquisto per unità (EUR)</label>
            <Input
              type="number"
              placeholder="0.00"
              value={buyPrice}
              onChange={(e) => handleBuyPriceChange(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantità</label>
              <Input
                type="number"
                placeholder="0"
                value={shares}
                onChange={(e) => handleSharesChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Importo Investito (EUR)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAsset || finalQty <= 0 || !(parsedPrice > 0) || importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Aggiungi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
