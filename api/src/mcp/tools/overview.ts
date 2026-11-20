import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '../../lib/prisma';
import { computeInvoiceTotals } from '../../lib/invoiceTotals';
import { callApi, ApiError, appUrl } from '../api';
import { defineTool, READ, EXTERNAL } from '../define';

type Items = Array<{ qty: number; unit_price: number; taxable?: boolean }>;

// Kept by hand next to the route files; update when routes change.
const ROUTE_CATALOG = `
Paths are relative to /api/v1. List endpoints accept page & limit.
settings: GET /settings, PATCH /settings, POST /settings/logo (multipart, not usable here)
contacts: GET /contacts?search&type&tag&subscribed, POST /contacts, GET|PATCH|DELETE /contacts/:id, POST /contacts/:id/convert
contact-lists: GET|POST /contact-lists, PATCH|DELETE /contact-lists/:id, POST|DELETE /contact-lists/:id/members {contact_ids}
companies: GET /companies?search, POST /companies, GET|PATCH|DELETE /companies/:id
customers: GET /customers?search, POST /customers, GET|PATCH /customers/:id
leads: GET /leads?stage&source&assigned_to, POST /leads, GET|PATCH|DELETE /leads/:id, POST /leads/:id/activities, POST /leads/:id/convert
jobs: GET /jobs?status&customer_id, POST /jobs, GET|PATCH|DELETE /jobs/:id, POST /jobs/:id/complete, GET /jobs/:id/profitability,
  POST /jobs/:id/labor, DELETE /jobs/:id/labor/:entryId, POST /jobs/:id/expenses, DELETE /jobs/:id/expenses/:expenseId
labor: GET /labor?job_id, POST /labor
expenses: GET /expenses?job_id&category, POST /expenses
estimates: GET /estimates?job_id&status, POST /estimates, PATCH|DELETE /estimates/:id, POST /estimates/:id/send, POST /estimates/:id/convert
invoices: GET /invoices?status&job_id&start&end, POST /invoices, PATCH /invoices/:id, POST /invoices/:id/send, GET /invoices/:id/pdf (binary),
  POST /invoices/:id/payments, DELETE /invoices/:id/payments/:paymentId, POST /invoices/:id/stripe-link
material-items: GET /material-items?search&category&active, POST /material-items, PATCH|DELETE /material-items/:id, GET /material-items/export (CSV)
vendors: GET /vendors?search&category, POST /vendors, GET|PATCH|DELETE /vendors/:id
tax-profiles: GET|POST /tax-profiles, PATCH|DELETE /tax-profiles/:id
contract-templates: GET|POST /contract-templates, GET|PATCH|DELETE /contract-templates/:id, POST /contract-templates/:id/preview
email-templates: GET|POST /email-templates, PATCH|DELETE /email-templates/:id
campaigns: GET|POST /campaigns, PATCH /campaigns/:id, POST /campaigns/:id/send|schedule|cancel|test, GET /campaigns/:id/analytics
reports: GET /reports/tax|tax/export|tax/outstanding|profit|profit/export|materials|materials/export ?start&end
scheduler: GET|PATCH /scheduler/settings, GET|POST /scheduler/availability-rules, PATCH|DELETE /scheduler/availability-rules/:id,
  GET|POST /scheduler/appointment-types, PATCH /scheduler/appointment-types/:id, GET|POST /scheduler/appointments, PATCH /scheduler/appointments/:id
users: GET /users, POST /users/invite, PATCH /users/:id, POST /users/:id/reset
imports: GET /imports/:id, GET /imports/:id/errors
`.trim();

function centralToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export function registerOverviewTools(server: McpServer) {
  defineTool(server, 'business_snapshot', {
    title: 'Business snapshot',
    description:
      'One-call overview of the business right now: open leads by stage, active jobs, estimates awaiting approval, ' +
      'unpaid and overdue invoices with balances, upcoming appointments, and cash collected this month and year. ' +
      'A good first call for "how are we doing" or "what needs attention".',
    input: {},
    annotations: READ,
  }, async () => {
    const now = new Date();
    const [y, m] = centralToday().split('-');
    const monthStart = new Date(`${y}-${m}-01T00:00:00-06:00`);
    const yearStart = new Date(`${y}-01-01T00:00:00-06:00`);
    const twoWeeks = new Date(now.getTime() + 14 * 86_400_000);

    const [leadStages, newLeads, jobStatuses, activeJobs, pendingEstimates, openInvoices, appointments, monthPaid, yearPaid] =
      await Promise.all([
        prisma.lead.groupBy({ by: ['stage'], where: { deleted_at: null }, _count: true }),
        prisma.lead.findMany({
          where: { deleted_at: null, stage: 'NEW' },
          orderBy: { created_at: 'desc' },
          take: 10,
          include: { contact: { select: { first_name: true, last_name: true, phone: true, email: true } } },
        }),
        prisma.job.groupBy({ by: ['status'], where: { deleted_at: null }, _count: true }),
        prisma.job.findMany({
          where: { deleted_at: null, status: { in: ['ACTIVE', 'ESTIMATING'] } },
          orderBy: { start_date: 'asc' },
          take: 25,
          select: { id: true, name: true, status: true, address: true, start_date: true, customer: { select: { name: true } } },
        }),
        prisma.estimate.findMany({
          where: { deleted_at: null, status: 'SENT' },
          orderBy: { sent_at: 'asc' },
          select: {
            id: true, estimate_number: true, sent_at: true, approval_token_expires_at: true, email_opened_at: true,
            job: { select: { id: true, name: true, customer: { select: { name: true } } } },
          },
        }),
        prisma.invoice.findMany({
          where: { deleted_at: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
          include: {
            payments: true,
            tax_profile: true,
            customer: { select: { name: true } },
            job: { select: { name: true, customer: { select: { name: true } } } },
          },
        }),
        prisma.appointment.findMany({
          where: { status: 'SCHEDULED', scheduled_at: { gte: now, lte: twoWeeks } },
          orderBy: { scheduled_at: 'asc' },
          include: { appointment_type: { select: { name: true } } },
        }),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { paid_at: { gte: monthStart } } }),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { paid_at: { gte: yearStart } } }),
      ]);

    const receivables = openInvoices
      .map((inv) => {
        const { total, balance } = computeInvoiceTotals({
          line_items: inv.line_items as Items,
          discount_type: inv.discount_type,
          discount_value: inv.discount_value ? Number(inv.discount_value) : null,
          state_rate: Number(inv.tax_profile.state_rate),
          local_rate: Number(inv.tax_profile.local_rate),
          amount_paid: inv.payments.reduce((s, p) => s + Number(p.amount), 0),
        });
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          type: inv.type,
          status: inv.status,
          customer: inv.customer?.name ?? inv.job?.customer?.name ?? null,
          job: inv.job?.name ?? null,
          total: Math.round(total * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          due_date: inv.due_date,
          overdue: inv.due_date < now,
          opened_by_customer: !!inv.email_opened_at,
        };
      })
      .filter((r) => r.balance > 0.005)
      .sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));

    const sum = (xs: { balance: number }[]) => Math.round(xs.reduce((s, x) => s + x.balance, 0) * 100) / 100;
    const overdue = receivables.filter((r) => r.overdue);

    return {
      as_of: now.toISOString(),
      leads: {
        by_stage: Object.fromEntries(leadStages.map((g) => [g.stage, g._count])),
        newest_uncontacted: newLeads.map((l) => ({
          id: l.id,
          name: `${l.contact.first_name} ${l.contact.last_name}`,
          phone: l.contact.phone,
          email: l.contact.email,
          service_needed: l.service_needed,
          created_at: l.created_at,
        })),
      },
      jobs: {
        by_status: Object.fromEntries(jobStatuses.map((g) => [g.status, g._count])),
        in_progress_or_estimating: activeJobs,
      },
      estimates_awaiting_approval: pendingEstimates,
      receivables: {
        outstanding_total: sum(receivables),
        overdue_total: sum(overdue),
        overdue_count: overdue.length,
        invoices: receivables,
      },
      upcoming_appointments_14_days: appointments.map((a) => ({
        id: a.id,
        type: a.appointment_type.name,
        name: `${a.first_name} ${a.last_name}`,
        phone: a.phone,
        scheduled_at: a.scheduled_at,
        notes: a.notes,
      })),
      cash_collected: {
        this_month: Number(monthPaid._sum.amount ?? 0),
        this_year: Number(yearPaid._sum.amount ?? 0),
      },
    };
  });

  defineTool(server, 'search', {
    title: 'Search everything',
    description:
      'Find anything by name, email, phone, address, or number across contacts, companies, billing customers, ' +
      'jobs, estimates (EST-0001), and invoices (INV-0001). Use this to get ids before acting.',
    input: { query: z.string().min(1) },
    annotations: READ,
  }, async ({ query }) => {
    const q = query.trim();
    const has = (field: string) => ({ [field]: { contains: q, mode: 'insensitive' as const } });
    const [first, ...restTokens] = q.split(/\s+/);
    const last = restTokens.join(' ');

    const [contacts, companies, customers, jobs, estimates, invoices] = await Promise.all([
      prisma.contact.findMany({
        where: {
          deleted_at: null,
          OR: [
            has('first_name'), has('last_name'), has('email'), has('phone'), has('company'), has('address'),
            ...(last
              ? [{
                  first_name: { contains: first, mode: 'insensitive' as const },
                  last_name: { contains: last, mode: 'insensitive' as const },
                }]
              : []),
          ],
        },
        take: 10,
        select: { id: true, first_name: true, last_name: true, email: true, phone: true, company: true, type: true, address: true },
      }),
      prisma.company.findMany({
        where: { deleted_at: null, OR: [has('name'), has('email'), has('phone'), has('address')] },
        take: 10,
        select: { id: true, name: true, email: true, phone: true, city: true },
      }),
      prisma.customer.findMany({
        where: { deleted_at: null, OR: [has('name'), has('email'), has('phone'), has('address')] },
        take: 10,
        select: { id: true, name: true, email: true, phone: true, address: true, contact_id: true },
      }),
      prisma.job.findMany({
        where: { deleted_at: null, OR: [has('name'), has('address'), { customer: { name: { contains: q, mode: 'insensitive' } } }] },
        take: 10,
        select: { id: true, name: true, status: true, address: true, customer: { select: { id: true, name: true } } },
      }),
      prisma.estimate.findMany({
        where: { deleted_at: null, OR: [has('estimate_number'), { job: { name: { contains: q, mode: 'insensitive' } } }] },
        take: 10,
        select: { id: true, estimate_number: true, status: true, job: { select: { id: true, name: true } } },
      }),
      prisma.invoice.findMany({
        where: {
          deleted_at: null,
          OR: [
            has('invoice_number'),
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { job: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 10,
        select: { id: true, invoice_number: true, status: true, type: true, due_date: true, job: { select: { id: true, name: true } } },
      }),
    ]);

    return { contacts, companies, customers, jobs, estimates, invoices };
  });

  defineTool(server, 'api_request', {
    title: 'Raw BrushPro API request',
    description:
      'Call any BrushPro REST endpoint directly, as the owner. Use this for anything the other tools do not cover ' +
      '(availability rules, appointment types, tax profiles, contract/email template edits, user invites, CSV exports). ' +
      'Prefer a dedicated tool when one exists. Bodies are passed to the database as-is, so DateTime fields need full ' +
      'ISO timestamps. Endpoints that email customers (send, complete, invite, reset) must be confirmed with the user first.\n\n' +
      ROUTE_CATALOG,
    input: {
      method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
      path: z.string().describe('Path relative to /api/v1, e.g. /tax-profiles or /scheduler/availability-rules/abc123'),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      body: z.any().optional(),
    },
    annotations: EXTERNAL,
  }, async ({ method, path, query, body }) => {
    const clean = '/' + path.replace(/^\/?(api\/v1\/?)?/, '');
    if (clean.includes('..')) throw new ApiError(400, 'Invalid path');
    // Login, password, and token flows have no business being driven by an agent.
    if (/^\/auth(\/|$)/.test(clean)) throw new ApiError(403, 'Auth endpoints are not available over MCP');
    return callApi(method, clean, { query, body });
  });

  defineTool(server, 'app_links', {
    title: 'App links',
    description: 'URLs for the BrushPro admin pages so the user can open something in the browser.',
    input: {},
    annotations: READ,
  }, async () => {
    const base = appUrl();
    return {
      dashboard: `${base}/admin/dashboard`,
      leads: `${base}/admin/leads`,
      contacts: `${base}/admin/contacts`,
      companies: `${base}/admin/companies`,
      jobs: `${base}/admin/jobs`,
      job: `${base}/admin/jobs/{job_id}`,
      invoices: `${base}/admin/invoices`,
      customer_invoice: `${base}/invoices/{invoice_id}`,
      marketing: `${base}/admin/marketing`,
      reports: `${base}/admin/reports`,
      settings: `${base}/admin/settings`,
    };
  });
}
