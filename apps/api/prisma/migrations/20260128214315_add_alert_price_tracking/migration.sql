-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "is_tracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tracking_started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "alert_price_tracks" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_price_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_price_tracks_alert_id_recorded_at_idx" ON "alert_price_tracks"("alert_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "alert_price_tracks" ADD CONSTRAINT "alert_price_tracks_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
