-- Add Google review URL to company settings
ALTER TABLE "company_settings" ADD COLUMN "google_review_url" TEXT;

-- Feedback requests sent after invoices
CREATE TABLE "feedback_requests" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "rating" INTEGER,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedback_requests_invoice_id_key" ON "feedback_requests"("invoice_id");
CREATE UNIQUE INDEX "feedback_requests_token_key" ON "feedback_requests"("token");
CREATE INDEX "feedback_requests_email_created_at_idx" ON "feedback_requests"("email", "created_at");

ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
