ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "payment_terms_label" TEXT NOT NULL DEFAULT 'Due on receipt';
