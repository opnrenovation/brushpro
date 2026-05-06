-- Fix estimate and invoice number counters to be higher than any existing document number.
-- The previous seed used COUNT WHERE deleted_at IS NULL, which under-counts when soft-deletes
-- exist, causing unique constraint violations on subsequent creates.

UPDATE "company_settings"
SET "next_estimate_number" = GREATEST(
  "next_estimate_number",
  COALESCE(
    (SELECT MAX(
       CAST(SPLIT_PART(estimate_number, '-', 2) AS INTEGER)
     ) + 1
     FROM "estimates"
     WHERE estimate_number ~ '^[A-Z]+-[0-9]+$'
    ),
    1
  )
);

UPDATE "company_settings"
SET "next_invoice_number" = GREATEST(
  "next_invoice_number",
  COALESCE(
    (SELECT MAX(
       CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER)
     ) + 1
     FROM "invoices"
     WHERE invoice_number ~ '^[A-Z]+-[0-9]+$'
    ),
    1
  )
);
