-- CreateEnum
CREATE TYPE "TimeOffKind" AS ENUM ('CALL_OFF', 'REQUEST');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "news_read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "in_accuracy_m" INTEGER,
ADD COLUMN     "in_lat" DOUBLE PRECISION,
ADD COLUMN     "in_lng" DOUBLE PRECISION,
ADD COLUMN     "out_accuracy_m" INTEGER,
ADD COLUMN     "out_lat" DOUBLE PRECISION,
ADD COLUMN     "out_lng" DOUBLE PRECISION,
ADD COLUMN     "synced_late" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "time_off_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" "TimeOffKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_on" TIMESTAMP(3) NOT NULL,
    "ends_on" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_off_requests_employee_id_starts_on_idx" ON "time_off_requests"("employee_id", "starts_on");

-- CreateIndex
CREATE INDEX "time_off_requests_status_starts_on_idx" ON "time_off_requests"("status", "starts_on");

-- CreateIndex
CREATE INDEX "announcements_published_at_idx" ON "announcements"("published_at");

-- AddForeignKey
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

