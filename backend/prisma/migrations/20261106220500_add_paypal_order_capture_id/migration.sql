-- AlterTable
ALTER TABLE "paypal_orders" ADD COLUMN IF NOT EXISTS "captureId" TEXT;
