-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "telegram_chat_id" TEXT,
ADD COLUMN     "telegram_enabled" BOOLEAN NOT NULL DEFAULT false;
