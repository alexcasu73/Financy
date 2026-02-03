/*
  Warnings:

  - You are about to drop the column `resuggest_after_days` on the `trading_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "trading_profiles" DROP COLUMN "resuggest_after_days",
ADD COLUMN     "resuggest_accepted_after_days" INTEGER,
ADD COLUMN     "resuggest_dismissed_after_days" INTEGER;
