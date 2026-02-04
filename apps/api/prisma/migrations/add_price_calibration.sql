-- Add price calibration fields to user_settings
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "reference_portfolio_value" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "eur_price_adjustment_factor" DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
ADD COLUMN IF NOT EXISTS "last_calibration_at" TIMESTAMP;

-- Add comment
COMMENT ON COLUMN "user_settings"."reference_portfolio_value" IS 'Reference portfolio value from external source (e.g., Trade Republic) for calibration';
COMMENT ON COLUMN "user_settings"."eur_price_adjustment_factor" IS 'Auto-calculated factor to adjust EUR prices to match reference source';
COMMENT ON COLUMN "user_settings"."last_calibration_at" IS 'Last time calibration was performed';
