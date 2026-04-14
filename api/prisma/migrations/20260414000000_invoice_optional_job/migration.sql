-- Make job_id optional on invoices (standalone invoices)
ALTER TABLE "invoices" ALTER COLUMN "job_id" DROP NOT NULL;

-- Add customer_id for standalone invoices
ALTER TABLE "invoices" ADD COLUMN "customer_id" TEXT;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
