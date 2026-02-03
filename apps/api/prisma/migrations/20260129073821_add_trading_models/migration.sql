-- CreateEnum
CREATE TYPE "TradingStatus" AS ENUM ('watching', 'bought', 'sold');

-- CreateEnum
CREATE TYPE "TradingAction" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateTable
CREATE TABLE "trading_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "risk_tolerance" TEXT NOT NULL,
    "target_profit_pct" DOUBLE PRECISION NOT NULL,
    "max_loss_pct" DOUBLE PRECISION NOT NULL,
    "preferred_sectors" TEXT[],
    "investment_per_trade" DOUBLE PRECISION,
    "analysis_interval" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_assets" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "status" "TradingStatus" NOT NULL DEFAULT 'watching',
    "entry_price" DOUBLE PRECISION,
    "entry_date" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "target_price" DOUBLE PRECISION,
    "stop_loss_price" DOUBLE PRECISION,
    "exit_price" DOUBLE PRECISION,
    "exit_date" TIMESTAMP(3),
    "realized_profit_pct" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_signals" (
    "id" TEXT NOT NULL,
    "trading_asset_id" TEXT NOT NULL,
    "action" "TradingAction" NOT NULL,
    "confidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "price_at_signal" DOUBLE PRECISION NOT NULL,
    "criteria" JSONB NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trading_profiles_user_id_key" ON "trading_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trading_assets_profile_id_asset_id_key" ON "trading_assets"("profile_id", "asset_id");

-- AddForeignKey
ALTER TABLE "trading_profiles" ADD CONSTRAINT "trading_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_assets" ADD CONSTRAINT "trading_assets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "trading_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_assets" ADD CONSTRAINT "trading_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_signals" ADD CONSTRAINT "trading_signals_trading_asset_id_fkey" FOREIGN KEY ("trading_asset_id") REFERENCES "trading_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
