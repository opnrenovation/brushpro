-- The legacy "Iowa Standard" profile (municipality "Des Moines") predates the
-- seeded city list, so the county backfill missed it. Its work is Polk County.
UPDATE "tax_profiles"
SET "county" = 'Polk'
WHERE "county" IS NULL
  AND TRIM("municipality") = 'Des Moines';
