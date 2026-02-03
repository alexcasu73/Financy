-- AlterTable
ALTER TABLE "holdings" ADD COLUMN     "trading_asset_id" TEXT;

-- AlterTable
ALTER TABLE "trading_profiles" ADD COLUMN     "cash_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "trading_style" TEXT NOT NULL DEFAULT 'swing';

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_trading_asset_id_fkey" FOREIGN KEY ("trading_asset_id") REFERENCES "trading_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
