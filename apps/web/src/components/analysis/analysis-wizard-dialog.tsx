"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  TrendingUp,
  Search as SearchIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  PieChart,
  Globe,
  Target,
} from "lucide-react";
import { api, AnalysisType, UserPreferences } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface SelectedAsset {
  id: string;
  symbol: string;
  name: string;
}

interface AnalysisWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalysisCreated: (analysis: any) => void;
}

const SECTORS = [
  { id: "tech", label: "Tecnologia" },
  { id: "healthcare", label: "Salute" },
  { id: "finance", label: "Finanza" },
  { id: "energy", label: "Energia" },
  { id: "consumer", label: "Beni di Consumo" },
  { id: "industrial", label: "Industriale" },
  { id: "crypto", label: "Crypto" },
];

const analysisTypes = [
  {
    id: "portfolio_digest" as AnalysisType,
    label: "Portfolio Digest",
    description: "Analisi completa del tuo portafoglio con raccomandazioni personalizzate",
    icon: PieChart,
  },
  {
    id: "market_overview" as AnalysisType,
    label: "Market Overview",
    description: "Panoramica generale dei mercati e trend principali",
    icon: Globe,
  },
  {
    id: "asset_deep_dive" as AnalysisType,
    label: "Asset Deep Dive",
    description: "Analisi approfondita di un singolo asset con segnali tecnici",
    icon: Target,
  },
];

export function AnalysisWizardDialog({
  open,
  onOpenChange,
  onAnalysisCreated,
}: AnalysisWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("portfolio_digest");
  const [preferences, setPreferences] = useState<UserPreferences>({
    riskTolerance: "moderate",
    timeHorizon: "medium",
    goals: "growth",
    preferredSectors: [],
    baseCurrency: "EUR",
  });

  // Asset search state (for asset_deep_dive)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);

  // asset_deep_dive: Step 1 (type) → Step 2 (select asset) → Generate
  // portfolio_digest/market_overview: Step 1 (type) → Step 2 (preferences) → Generate
  const totalSteps = 2;

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

  useEffect(() => {
    if (!query || selectedAsset) return;
    const timeout = setTimeout(() => searchAssets(query), 300);
    return () => clearTimeout(timeout);
  }, [query, selectedAsset, searchAssets]);

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
      });
      setSelectedAsset({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
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

  const toggleSector = (sectorId: string) => {
    setPreferences((prev) => ({
      ...prev,
      preferredSectors: prev.preferredSectors.includes(sectorId)
        ? prev.preferredSectors.filter((s) => s !== sectorId)
        : [...prev.preferredSectors, sectorId],
    }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.requestAnalysis({
        type: analysisType,
        assetId: analysisType === "asset_deep_dive" ? selectedAsset?.id : undefined,
        preferences,
      });
      onAnalysisCreated(result);
      resetForm();
      onOpenChange(false);
    } catch {
      // Handle error
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setAnalysisType("portfolio_digest");
    setPreferences({
      riskTolerance: "moderate",
      timeHorizon: "medium",
      goals: "growth",
      preferredSectors: [],
      baseCurrency: "EUR",
    });
    setQuery("");
    setResults([]);
    setSelectedAsset(null);
    setShowDropdown(false);
  };

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) {
      if (analysisType === "asset_deep_dive") return !!selectedAsset;
      return true;
    }
    return true;
  };

  const canGenerate = () => {
    if (analysisType === "asset_deep_dive") {
      return step === 2 && !!selectedAsset;
    }
    return step === 2;
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova Analisi AI</DialogTitle>
          <DialogDescription>
            Configura le tue preferenze per un&apos;analisi personalizzata
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={cn(
                  "h-2 rounded-full flex-1 transition-colors",
                  i + 1 <= step ? "bg-primary" : "bg-muted"
                )}
              />
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {step}/{totalSteps}
          </span>
        </div>

        <div className="py-4 min-h-[280px]">
          {/* Step 1: Analysis Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Tipo di analisi</p>
              <div className="grid gap-3">
                {analysisTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAnalysisType(type.id)}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                        analysisType === type.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          analysisType === type.id ? "bg-primary/10" : "bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            analysisType === type.id ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      {analysisType === type.id && (
                        <Check className="h-5 w-5 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Preferences for portfolio_digest (full preferences) */}
          {step === 2 && analysisType === "portfolio_digest" && (
            <div className="space-y-5">
              {/* Risk Tolerance */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Tolleranza al rischio</p>
                <div className="flex gap-2">
                  {(["conservative", "moderate", "aggressive"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreferences((p) => ({ ...p, riskTolerance: value }))}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        preferences.riskTolerance === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {value === "conservative" && "Conservativo"}
                      {value === "moderate" && "Moderato"}
                      {value === "aggressive" && "Aggressivo"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Horizon */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Orizzonte temporale</p>
                <div className="flex gap-2">
                  {(["short", "medium", "long"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreferences((p) => ({ ...p, timeHorizon: value }))}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        preferences.timeHorizon === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {value === "short" && "Breve (<1a)"}
                      {value === "medium" && "Medio (1-5a)"}
                      {value === "long" && "Lungo (>5a)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Obiettivo</p>
                <div className="flex gap-2">
                  {(["growth", "income", "preservation"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreferences((p) => ({ ...p, goals: value }))}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        preferences.goals === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {value === "growth" && "Crescita"}
                      {value === "income" && "Rendita"}
                      {value === "preservation" && "Preservazione"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Sectors */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Settori preferiti (opzionale)</p>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => toggleSector(sector.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm transition-all",
                        preferences.preferredSectors.includes(sector.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {sector.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base Currency */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Valuta base</p>
                <div className="flex gap-2">
                  {(["EUR", "USD"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreferences((p) => ({ ...p, baseCurrency: value }))}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        preferences.baseCurrency === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preferences for market_overview (simplified) */}
          {step === 2 && analysisType === "market_overview" && (
            <div className="space-y-5">
              {/* Preferred Sectors */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Settori di interesse (opzionale)</p>
                <p className="text-xs text-muted-foreground">Seleziona i settori su cui vuoi focalizzare l&apos;analisi</p>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => toggleSector(sector.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm transition-all",
                        preferences.preferredSectors.includes(sector.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {sector.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base Currency */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Valuta</p>
                <div className="flex gap-2">
                  {(["EUR", "USD"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreferences((p) => ({ ...p, baseCurrency: value }))}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        preferences.baseCurrency === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Asset Selection (for asset_deep_dive) */}
          {step === 2 && analysisType === "asset_deep_dive" && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Seleziona l&apos;asset da analizzare</p>

              {selectedAsset ? (
                <div className="rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium">{selectedAsset.symbol}</span>
                    <button
                      onClick={clearAsset}
                      className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1 pl-6">
                    {selectedAsset.name}
                  </p>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
                      {results.map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                          onClick={() => selectAsset(r)}
                        >
                          <span className="font-medium text-sm shrink-0">{r.symbol}</span>
                          <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
                            {r.name}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {r.type}
                          </Badge>
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
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Indietro
          </Button>
          <div className="flex gap-2">
            {step < totalSteps ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Avanti
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleGenerate} disabled={!canGenerate() || generating}>
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Genera Analisi
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
