-- Dedicated password-reset token storage so a reset request no longer
-- overwrites the user's real password_hash, and tokens can actually expire.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "reset_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_token_expires_at" TIMESTAMP(3);
