"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Target, Shield, Clock, TrendingUp } from "lucide-react";

interface SurveyStep {
  type: "question" | "description";
  content?: {
    title: string;
    description: string;
  };
}

interface SurveyData {
  horizon: "short" | "medium" | "long";
  riskTolerance: "conservative" | "moderate" | "aggressive";
  targetProfitPct: number;
  maxLossPct: number;
  preferredSectors: string[];
  investmentPerTrade?: number;
  resuggestDismissedAfterDays?: number | null;
}

interface TradingSurveyProps {
  onComplete: (data: SurveyData) => void;
  loading?: boolean;
}

const SECTORS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Energy",
  "Consumer",
  "Industrial",
  "Materials",
  "Utilities",
  "Real Estate",
  "Crypto",
];

// Survey step configuration
const SURVEY_STEPS: Array<{ type: "question" | "description"; step: number; content?: { title: string; description: string } }> = [
  {
    type: "description",
    step: 0,
    content: {
      title: "Benvenuto nel Configuratore Trading",
      description: "Questo questionario ti aiuterà a personalizzare i segnali di trading in base alle tue preferenze e al tuo profilo di rischio. Rispondi con attenzione alle domande seguenti."
    }
  },
  { type: "question", step: 1 },
  { type: "question", step: 2 },
  { type: "question", step: 3 },
  { type: "question", step: 4 },
  { type: "question", step: 5 },
  { type: "question", step: 6 },
];

export function TradingSurvey({ onComplete, loading }: TradingSurveyProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<SurveyData>>({
    preferredSectors: [],
  });

  const totalSteps = SURVEY_STEPS.length - 1;
  const progress = (step / totalSteps) * 100;
  const currentStepConfig = SURVEY_STEPS[step];

  const canProceed = () => {
    // Description steps can always proceed
    if (currentStepConfig?.type === "description") return true;

    switch (step) {
      case 0:
        return true; // Description step
      case 1:
        return !!data.horizon;
      case 2:
        return !!data.riskTolerance;
      case 3:
        return !!data.targetProfitPct;
      case 4:
        return !!data.maxLossPct;
      case 5:
        return true; // Sectors are optional
      case 6:
        return data.resuggestDismissedAfterDays !== undefined;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(data as SurveyData);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleSector = (sector: string) => {
    const current = data.preferredSectors || [];
    if (current.includes(sector)) {
      setData({ ...data, preferredSectors: current.filter((s) => s !== sector) });
    } else {
      setData({ ...data, preferredSectors: [...current, sector] });
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Configura il tuo Profilo Trading
        </CardTitle>
        <CardDescription>
          Rispondi a queste domande per personalizzare i segnali di trading
        </CardDescription>
        <Progress value={progress} className="mt-4" />
        <p className="text-sm text-muted-foreground mt-2">
          Step {step} di {totalSteps}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 0: Description/Welcome */}
        {step === 0 && currentStepConfig?.type === "description" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{currentStepConfig.content?.title}</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {currentStepConfig.content?.description}
            </p>
          </div>
        )}

        {/* Step 1: Time Horizon */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Orizzonte Temporale</h3>
            </div>
            <p className="text-muted-foreground">
              Quanto tempo intendi mantenere le posizioni?
            </p>
            <div className="grid gap-3">
              {[
                { value: "short", label: "Breve termine", desc: "Giorni o settimane - Trading attivo" },
                { value: "medium", label: "Medio termine", desc: "1-6 mesi - Swing trading" },
                { value: "long", label: "Lungo termine", desc: "6+ mesi - Position trading" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, horizon: option.value as any })}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    data.horizon === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Risk Tolerance */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Tolleranza al Rischio</h3>
            </div>
            <p className="text-muted-foreground">
              Quale livello di rischio sei disposto ad accettare?
            </p>
            <div className="grid gap-3">
              {[
                { value: "conservative", label: "Conservativo", desc: "Preferisco guadagni piccoli ma sicuri", color: "text-green-600" },
                { value: "moderate", label: "Moderato", desc: "Accetto rischi moderati per guadagni medi", color: "text-yellow-600" },
                { value: "aggressive", label: "Aggressivo", desc: "Accetto alti rischi per alti guadagni", color: "text-red-600" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, riskTolerance: option.value as any })}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    data.riskTolerance === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className={`font-medium ${option.color}`}>{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Target Profit */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Obiettivo di Profitto</h3>
            </div>
            <p className="text-muted-foreground">
              Quale percentuale di guadagno vuoi raggiungere per operazione?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 5, label: "5%", desc: "Conservativo" },
                { value: 10, label: "10%", desc: "Moderato" },
                { value: 15, label: "15%", desc: "Ambizioso" },
                { value: 20, label: "20%", desc: "Aggressivo" },
                { value: 30, label: "30%", desc: "Molto aggressivo" },
                { value: 50, label: "50%+", desc: "Speculativo" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, targetProfitPct: option.value })}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    data.targetProfitPct === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-2xl font-bold text-green-600">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Max Loss */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold">Perdita Massima Accettabile</h3>
            </div>
            <p className="text-muted-foreground">
              Quale percentuale di perdita sei disposto ad accettare prima di vendere?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 5, label: "5%", desc: "Stop-loss stretto" },
                { value: 10, label: "10%", desc: "Stop-loss moderato" },
                { value: 15, label: "15%", desc: "Stop-loss ampio" },
                { value: 20, label: "20%", desc: "Stop-loss largo" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, maxLossPct: option.value })}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    data.maxLossPct === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-2xl font-bold text-red-600">-{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Preferred Sectors */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Settori Preferiti (opzionale)</h3>
            <p className="text-muted-foreground">
              Seleziona i settori su cui preferisci investire
            </p>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((sector) => (
                <Badge
                  key={sector}
                  variant={data.preferredSectors?.includes(sector) ? "default" : "outline"}
                  className="cursor-pointer text-sm py-2 px-3"
                  onClick={() => toggleSector(sector)}
                >
                  {sector}
                </Badge>
              ))}
            </div>

            <div className="pt-4">
              <Label htmlFor="investment">Budget per operazione (opzionale)</Label>
              <Input
                id="investment"
                type="number"
                placeholder="Es: 1000"
                className="mt-2"
                value={data.investmentPerTrade || ""}
                onChange={(e) =>
                  setData({ ...data, investmentPerTrade: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
          </div>
        )}

        {/* Step 6: Resuggest Settings */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Ri-suggerimento Asset Scartati</h3>
            </div>
            <p className="text-muted-foreground">
              Dopo quanti giorni un asset scartato può essere ri-suggerito? Gli asset accettati non vengono MAI riproposti.
            </p>
            <div className="grid gap-3">
              {[
                { value: 0, label: "Sempre", desc: "Gli asset scartati possono essere ri-suggeriti subito" },
                { value: 7, label: "7 giorni", desc: "Ri-suggerisci dopo una settimana" },
                { value: 30, label: "30 giorni", desc: "Ri-suggerisci dopo un mese" },
                { value: 90, label: "90 giorni", desc: "Ri-suggerisci dopo tre mesi" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({
                    ...data,
                    resuggestDismissedAfterDays: option.value
                  })}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    data.resuggestDismissedAfterDays === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleBack} disabled={step === 0 || loading}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || loading}>
            {step === totalSteps ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {loading ? "Salvataggio..." : "Completa"}
              </>
            ) : (
              <>
                Avanti
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
