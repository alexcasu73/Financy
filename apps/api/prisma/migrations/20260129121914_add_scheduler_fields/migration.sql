-- AlterTable
ALTER TABLE "trading_profiles" ADD COLUMN     "last_analysis_at" TIMESTAMP(3),
ADD COLUMN     "last_suggestion_at" TIMESTAMP(3),
ADD COLUMN     "suggestion_interval" INTEGER NOT NULL DEFAULT 360,
ALTER COLUMN "analysis_interval" SET DEFAULT 30;
