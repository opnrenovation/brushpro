-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('OWNER', 'CREW');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "app_access" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failed_pin_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_app_login_at" TIMESTAMP(3),
ADD COLUMN     "pin_hash" TEXT,
ADD COLUMN     "pin_locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "crew_notes" TEXT;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "break_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clock_in" TIMESTAMP(3),
ADD COLUMN     "clock_out" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "source" "TimeEntrySource" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "status" "TimeEntryStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_crew_updates" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_crew_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_assignments_job_id_employee_id_key" ON "job_assignments"("job_id", "employee_id");

-- CreateIndex
CREATE INDEX "job_crew_updates_job_id_created_at_idx" ON "job_crew_updates"("job_id", "created_at");

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_crew_updates" ADD CONSTRAINT "job_crew_updates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_crew_updates" ADD CONSTRAINT "job_crew_updates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

