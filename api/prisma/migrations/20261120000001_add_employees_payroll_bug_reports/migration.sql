-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('W2', 'CONTRACTOR_1099');

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'SALARY');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID');

-- CreateEnum
CREATE TYPE "BugReportType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'QUESTION');

-- CreateEnum
CREATE TYPE "BugReportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "position" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "worker_type" "WorkerType" NOT NULL DEFAULT 'W2',
    "pay_type" "PayType" NOT NULL DEFAULT 'HOURLY',
    "pay_rate" DECIMAL(10,2) NOT NULL,
    "overtime_eligible" BOOLEAN NOT NULL DEFAULT true,
    "federal_withholding_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "state_withholding_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hire_date" TIMESTAMP(3),
    "termination_date" TIMESTAMP(3),
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "job_id" TEXT,
    "work_date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_runs" (
    "id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "frequency" "PayFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "total_gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_employer_taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalized_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_stubs" (
    "id" TEXT NOT NULL,
    "pay_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "worker_type" "WorkerType" NOT NULL,
    "pay_type" "PayType" NOT NULL,
    "pay_rate" DECIMAL(10,2) NOT NULL,
    "regular_hours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "regular_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtime_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reimbursement" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gross_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "federal_withholding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "state_withholding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "social_security" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "medicare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_deductions_note" TEXT,
    "net_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "employer_social_security" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "employer_medicare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod",
    "check_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_stubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "type" "BugReportType" NOT NULL DEFAULT 'BUG',
    "priority" "BugReportPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page_url" TEXT,
    "user_agent" TEXT,
    "screenshot" TEXT,
    "reported_by" TEXT,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_employee_id_work_date_idx" ON "time_entries"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "pay_stubs_pay_run_id_employee_id_key" ON "pay_stubs"("pay_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "bug_reports_status_created_at_idx" ON "bug_reports"("status", "created_at");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_stubs" ADD CONSTRAINT "pay_stubs_pay_run_id_fkey" FOREIGN KEY ("pay_run_id") REFERENCES "pay_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_stubs" ADD CONSTRAINT "pay_stubs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

