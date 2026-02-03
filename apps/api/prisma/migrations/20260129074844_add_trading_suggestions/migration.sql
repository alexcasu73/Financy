-- CreateTable
CREATE TABLE "trading_suggestions" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "expected_profit" DOUBLE PRECISION,
    "risk_level" TEXT,
    "timeframe" TEXT,
    "criteria" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trading_suggestions_profile_id_asset_id_status_key" ON "trading_suggestions"("profile_id", "asset_id", "status");

-- AddForeignKey
ALTER TABLE "trading_suggestions" ADD CONSTRAINT "trading_suggestions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "trading_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_suggestions" ADD CONSTRAINT "trading_suggestions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
