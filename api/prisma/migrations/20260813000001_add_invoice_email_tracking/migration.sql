-- Track delivery/open/click on the customer-facing copy of an invoice email.
-- Populated by the Resend webhook, which matches on the invoice_id tag.
ALTER TABLE "invoices" ADD COLUMN "resend_email_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN "email_delivered_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "email_opened_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "email_clicked_at" TIMESTAMP(3);

-- Guard so the internal "invoice opened" alert fires once per send, not per open.
ALTER TABLE "invoices" ADD COLUMN "open_notified_at" TIMESTAMP(3);
