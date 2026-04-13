-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "resend_email_id" TEXT,
ADD COLUMN "email_delivered_at" TIMESTAMP(3),
ADD COLUMN "email_opened_at" TIMESTAMP(3),
ADD COLUMN "email_clicked_at" TIMESTAMP(3);
