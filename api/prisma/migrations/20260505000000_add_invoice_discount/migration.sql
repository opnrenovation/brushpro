-- Add discount fields to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_type" TEXT DEFAULT 'NONE';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(10,2) DEFAULT 0;
