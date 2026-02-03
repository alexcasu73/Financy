-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "alert_suggestion_interval" INTEGER NOT NULL DEFAULT 360,
ADD COLUMN     "last_alert_suggestion_at" TIMESTAMP(3);
