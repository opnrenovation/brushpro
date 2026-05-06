ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "next_invoice_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "next_estimate_number" INTEGER NOT NULL DEFAULT 1;

-- Seed counters from real counts so existing installs keep their numbering sequence
UPDATE "company_settings"
SET "next_invoice_number" = (SELECT COUNT(*) + 1 FROM "invoices");

UPDATE "company_settings"
SET "next_estimate_number" = (SELECT COUNT(*) + 1 FROM "estimates" WHERE "deleted_at" IS NULL);
