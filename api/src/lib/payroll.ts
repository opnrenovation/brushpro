import { Prisma, PayFrequency } from '@prisma/client';
import { prisma } from './prisma';

// Payroll math for a small crew. Withholding here is an estimate built from
// flat percentages the owner sets per employee; it is not a tax engine. Check
// figures against IRS Pub 15-T / Iowa withholding tables or a payroll provider
// before filing.

export const SOCIAL_SECURITY_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
// 2026 Social Security wage base. Update each January.
export const SOCIAL_SECURITY_WAGE_BASE = 184_500;
export const OVERTIME_THRESHOLD_HOURS = 40;
export const OVERTIME_MULTIPLIER = 1.5;

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMIMONTHLY: 24,
  MONTHLY: 12,
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (d: Prisma.Decimal | number | string | null | undefined) => Number(d ?? 0);

// Start of the FLSA workweek (Sunday, UTC date) for a work date.
function weekKey(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.toISOString().slice(0, 10);
}

// Splits hours into regular and overtime by workweek (over 40 in a week).
export function splitHours(
  entries: Array<{ work_date: Date; hours: Prisma.Decimal | number }>,
  overtimeEligible: boolean,
): { regular: number; overtime: number } {
  const byWeek = new Map<string, number>();
  for (const e of entries) {
    const k = weekKey(e.work_date);
    byWeek.set(k, (byWeek.get(k) || 0) + num(e.hours));
  }
  let regular = 0;
  let overtime = 0;
  for (const hours of byWeek.values()) {
    if (overtimeEligible && hours > OVERTIME_THRESHOLD_HOURS) {
      regular += OVERTIME_THRESHOLD_HOURS;
      overtime += hours - OVERTIME_THRESHOLD_HOURS;
    } else {
      regular += hours;
    }
  }
  return { regular: round2(regular), overtime: round2(overtime) };
}

export interface StubInputs {
  worker_type: 'W2' | 'CONTRACTOR_1099';
  pay_type: 'HOURLY' | 'SALARY';
  pay_rate: number;
  frequency: PayFrequency;
  regular_hours: number;
  overtime_hours: number;
  bonus: number;
  reimbursement: number;
  other_deductions: number;
  federal_withholding_pct: number;
  state_withholding_pct: number;
  // Social Security wages already paid this calendar year, for the wage cap
  ytd_ss_wages: number;
}

export function computeStub(i: StubInputs) {
  let regular_pay: number;
  let overtime_pay = 0;
  if (i.pay_type === 'SALARY') {
    regular_pay = round2(i.pay_rate / PERIODS_PER_YEAR[i.frequency]);
  } else {
    regular_pay = round2(i.regular_hours * i.pay_rate);
    overtime_pay = round2(i.overtime_hours * i.pay_rate * OVERTIME_MULTIPLIER);
  }
  const gross_pay = round2(regular_pay + overtime_pay + i.bonus);

  let federal_withholding = 0;
  let state_withholding = 0;
  let social_security = 0;
  let medicare = 0;
  let employer_social_security = 0;
  let employer_medicare = 0;

  if (i.worker_type === 'W2') {
    federal_withholding = round2(gross_pay * (i.federal_withholding_pct / 100));
    state_withholding = round2(gross_pay * (i.state_withholding_pct / 100));
    const ssRoom = Math.max(0, SOCIAL_SECURITY_WAGE_BASE - i.ytd_ss_wages);
    const ssWages = Math.min(gross_pay, ssRoom);
    social_security = round2(ssWages * SOCIAL_SECURITY_RATE);
    medicare = round2(gross_pay * MEDICARE_RATE);
    employer_social_security = social_security;
    employer_medicare = medicare;
  }

  const total_deductions = round2(
    federal_withholding + state_withholding + social_security + medicare + i.other_deductions,
  );
  const net_pay = round2(gross_pay - total_deductions + i.reimbursement);

  return {
    regular_pay,
    overtime_pay,
    gross_pay,
    federal_withholding,
    state_withholding,
    social_security,
    medicare,
    net_pay,
    employer_social_security,
    employer_medicare,
    total_deductions,
  };
}

// Gross wages already paid to an employee this calendar year, excluding one
// pay run (the one being calculated).
async function ytdGross(employeeId: string, payDate: Date, excludeRunId: string): Promise<number> {
  const yearStart = new Date(Date.UTC(payDate.getUTCFullYear(), 0, 1));
  const agg = await prisma.payStub.aggregate({
    _sum: { gross_pay: true },
    where: {
      employee_id: employeeId,
      pay_run_id: { not: excludeRunId },
      pay_run: { pay_date: { gte: yearStart, lt: payDate } },
    },
  });
  return num(agg._sum.gross_pay);
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

// Recomputes one stub from its stored inputs (hours, bonus, deductions) and
// the employee's current withholding settings.
export async function recalcStub(stubId: string) {
  const stub = await prisma.payStub.findUniqueOrThrow({
    where: { id: stubId },
    include: { pay_run: true, employee: true },
  });
  const ytd = await ytdGross(stub.employee_id, stub.pay_run.pay_date, stub.pay_run_id);
  const c = computeStub({
    worker_type: stub.worker_type,
    pay_type: stub.pay_type,
    pay_rate: num(stub.pay_rate),
    frequency: stub.pay_run.frequency,
    regular_hours: num(stub.regular_hours),
    overtime_hours: num(stub.overtime_hours),
    bonus: num(stub.bonus),
    reimbursement: num(stub.reimbursement),
    other_deductions: num(stub.other_deductions),
    federal_withholding_pct: num(stub.employee.federal_withholding_pct),
    state_withholding_pct: num(stub.employee.state_withholding_pct),
    ytd_ss_wages: ytd,
  });
  const { total_deductions: _ignored, ...fields } = c;
  return prisma.payStub.update({ where: { id: stubId }, data: fields });
}

// Builds (or rebuilds) a draft pay run's stubs from time entries. Bonus,
// reimbursement, other deductions, payment method and notes the owner already
// entered are kept; hours, rates and taxes are refreshed.
export async function generateStubs(payRunId: string) {
  const run = await prisma.payRun.findUniqueOrThrow({ where: { id: payRunId } });
  const from = run.period_start;
  const to = endOfDay(run.period_end);

  const employees = await prisma.employee.findMany({
    where: {
      deleted_at: null,
      OR: [
        { status: 'ACTIVE' },
        { time_entries: { some: { work_date: { gte: from, lte: to }, status: 'APPROVED' } } },
        { pay_stubs: { some: { pay_run_id: payRunId } } },
      ],
    },
    // Only approved time is paid; crew clock-ins wait for the owner's review.
    include: { time_entries: { where: { work_date: { gte: from, lte: to }, status: 'APPROVED' } } },
  });

  for (const emp of employees) {
    const { regular, overtime } = splitHours(emp.time_entries, emp.overtime_eligible);
    const isSalary = emp.pay_type === 'SALARY';
    const base = {
      worker_type: emp.worker_type,
      pay_type: emp.pay_type,
      pay_rate: emp.pay_rate,
      regular_hours: isSalary ? regular + overtime : regular,
      overtime_hours: isSalary ? 0 : overtime,
    };
    const stub = await prisma.payStub.upsert({
      where: { pay_run_id_employee_id: { pay_run_id: payRunId, employee_id: emp.id } },
      create: { pay_run_id: payRunId, employee_id: emp.id, ...base },
      update: base,
    });
    await recalcStub(stub.id);
  }

  // Drop stubs for employees with no hours who are no longer active (and have
  // no manual amounts), so a rebuild doesn't leave empty rows behind.
  await prisma.payStub.deleteMany({
    where: {
      pay_run_id: payRunId,
      pay_type: 'HOURLY',
      regular_hours: 0,
      overtime_hours: 0,
      bonus: 0,
      reimbursement: 0,
      employee: { status: { not: 'ACTIVE' } },
    },
  });

  return refreshRunTotals(payRunId);
}

export async function refreshRunTotals(payRunId: string) {
  const stubs = await prisma.payStub.findMany({ where: { pay_run_id: payRunId } });
  let gross = 0;
  let deductions = 0;
  let net = 0;
  let employer = 0;
  for (const s of stubs) {
    gross += num(s.gross_pay);
    deductions +=
      num(s.federal_withholding) + num(s.state_withholding) + num(s.social_security) +
      num(s.medicare) + num(s.other_deductions);
    net += num(s.net_pay);
    employer += num(s.employer_social_security) + num(s.employer_medicare);
  }
  return prisma.payRun.update({
    where: { id: payRunId },
    data: {
      total_gross: round2(gross),
      total_deductions: round2(deductions),
      total_net: round2(net),
      total_employer_taxes: round2(employer),
    },
  });
}
