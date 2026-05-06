ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "disclaimer" TEXT;

-- Seed with default disclaimer text
UPDATE "company_settings"
SET "disclaimer" = 'Any changes to the scope of work or specifications based on the inspection we conducted, including paint color selection or extra work, may incur an additional charge.'
WHERE "disclaimer" IS NULL;
