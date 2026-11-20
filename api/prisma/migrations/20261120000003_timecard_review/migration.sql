-- AlterEnum
ALTER TYPE "TimeEntrySource" ADD VALUE 'CREW_MANUAL';

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "office_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewed_by" TEXT;

