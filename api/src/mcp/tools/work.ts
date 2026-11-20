import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '../../lib/prisma';
import { computeInvoiceTotals } from '../../lib/invoiceTotals';
import { callApi, ApiError, toDateTime, rangeStart, rangeEnd, appUrl, resolveCustomerId } from '../api';
import {
  defineTool, READ, WRITE, DELETE, EXTERNAL, id, date, page, limit, lineItems, customerRef, compact,
} from '../define';

const jobStatus = z.enum(['ESTIMATING', 'ACTIVE', 'INVOICED', 'COMPLETE', 'CANCELLED']);
const estimateStatus = z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED']);
const invoiceStatus = z.enum(['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']);
const invoiceType = z.enum(['DEPOSIT', 'PROGRESS', 'FINAL']);
const discountType = z.enum(['NONE', 'PERCENT', 'FIXED']);
const paymentMethod = z.enum(['CARD', 'CHECK', 'CASH', 'TRANSFER']);
const expenseCategory = z.enum(['MATERIALS', 'SUBCONTRACTOR', 'EQUIPMENT_RENTAL', 'SUPPLIES', 'OTHER']);

type Items = Array<{ qty: number; unit_price: number; taxable?: boolean }>;

// The crew works in Iowa; a UTC date would roll over to tomorrow at 7pm.
function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

async function defaultTaxProfileId(): Promise<string> {
  const profile =
    (await prisma.taxProfile.findFirst({ where: { is_default: true } })) ?? (await prisma.taxProfile.findFirst());
  if (!profile) throw new ApiError(400, 'No tax profile exists; create one or pass tax_profile_id');
  return profile.id;
}

const jobFields = {
  name: z.string().optional(),
  address: z.string().optional(),
  municipality: z.string().optional().describe('City, e.g. Des Moines, Ankeny. Drives the tax profile on estimates.'),
  status: jobStatus.optional(),
  tax_exempt: z.boolean().optional(),
  start_date: date('Start date').optional(),
  end_date: date('End date').optional(),
  labor_rate: z.number().optional().describe('Hourly labor rate; defaults to the company default'),
  notes: z.string().optional(),
};

const estimateFields = {
  line_items: lineItems.optional(),
  notes: z.string().optional().describe('Shown on the proposal'),
  client_notes: z.string().optional(),
  expiry_days: z.number().int().optional().describe('Days the approval link stays valid; default from settings (30)'),
  tax_profile_id: z.string().optional().describe('Auto-picked from the job municipality when omitted'),
  contract_template_id: z.string().optional(),
  paint_codes: z.any().optional().describe('Paint colors/codes, free-form JSON'),
};

const invoiceFields = {
  line_items: lineItems.optional(),
  type: invoiceType.optional(),
  tax_profile_id: z.string().optional(),
  discount_type: discountType.optional(),
  discount_value: z.number().optional().describe('Percent (PERCENT) or dollars (FIXED)'),
  due_date: date('Due date').optional(),
  notes: z.string().optional(),
};

export function registerWorkTools(server: McpServer) {
  // ─── Jobs ──────────────────────────────────────────────────────────────────

  defineTool(server, 'list_jobs', {
    title: 'List jobs',
    description: 'List jobs, newest first, with their customer.',
    input: { status: jobStatus.optional(), customer_id: z.string().optional(), page, limit: limit() },
    annotations: READ,
  }, (a) => callApi('GET', '/jobs', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'get_job', {
    title: 'Get job',
    description: 'Get a job with its customer, estimates, invoices (with payments), labor, and expenses.',
    input: { job_id: id('Job') },
    annotations: READ,
  }, ({ job_id }) => callApi('GET', `/jobs/${job_id}`));

  defineTool(server, 'create_job', {
    title: 'Create job',
    description:
      'Create a job for a client. Identify the client with customer_id, contact_id, or company_id ' +
      '(a billing customer is created from the contact/company if needed). name, address, municipality are required.',
    input: { ...customerRef, ...jobFields, name: z.string(), address: z.string(), municipality: z.string() },
    annotations: WRITE,
  }, async ({ customer_id, contact_id, company_id, start_date, end_date, ...rest }) => {
    const cid = await resolveCustomerId({ customer_id, contact_id, company_id });
    return callApi('POST', '/jobs', {
      body: compact({ ...rest, customer_id: cid, start_date: toDateTime(start_date), end_date: toDateTime(end_date) }),
    });
  });

  defineTool(server, 'update_job', {
    title: 'Update job',
    description: 'Change job fields such as status, dates, address, labor rate, or notes.',
    input: { job_id: id('Job'), ...jobFields },
    annotations: WRITE,
  }, ({ job_id, start_date, end_date, ...rest }) =>
    callApi('PATCH', `/jobs/${job_id}`, {
      body: compact({ ...rest, start_date: toDateTime(start_date), end_date: toDateTime(end_date) }),
    }));

  defineTool(server, 'complete_job', {
    title: 'Complete job and email final invoice',
    description:
      'Marks the job COMPLETE and EMAILS THE CUSTOMER the final invoice for the remaining balance (creating it from ' +
      'the approved estimate if no invoice exists). Confirm with the user before calling.',
    input: { job_id: id('Job') },
    annotations: EXTERNAL,
  }, ({ job_id }) => callApi('POST', `/jobs/${job_id}/complete`));

  defineTool(server, 'delete_job', {
    title: 'Delete job',
    description: 'Soft-delete a job.',
    input: { job_id: id('Job') },
    annotations: DELETE,
  }, ({ job_id }) => callApi('DELETE', `/jobs/${job_id}`));

  defineTool(server, 'job_profitability', {
    title: 'Job profitability',
    description: 'Revenue collected vs. labor, expenses, and material cost for a job, with gross profit and margin.',
    input: { job_id: id('Job') },
    annotations: READ,
  }, ({ job_id }) => callApi('GET', `/jobs/${job_id}/profitability`));

  // ─── Labor & expenses ──────────────────────────────────────────────────────

  defineTool(server, 'list_labor', {
    title: 'List labor entries',
    description: 'List labor hours logged, optionally for one job.',
    input: { job_id: z.string().optional(), page, limit: limit(50) },
    annotations: READ,
  }, (a) => callApi('GET', '/labor', { query: a }));

  defineTool(server, 'log_labor', {
    title: 'Log labor hours',
    description: 'Record hours worked on a job. rate defaults to the job labor rate; work_date defaults to today.',
    input: {
      job_id: id('Job'),
      description: z.string(),
      hours: z.number(),
      rate: z.number().optional(),
      work_date: date('Work date').optional(),
      user_id: z.string().optional().describe('Crew member user id; defaults to the MCP acting user'),
    },
    annotations: WRITE,
  }, ({ work_date, ...rest }) =>
    callApi('POST', '/labor', { body: compact({ ...rest, work_date: toDateTime(work_date ?? today()) }) }));

  defineTool(server, 'delete_labor', {
    title: 'Delete labor entry',
    description: 'Permanently remove a labor entry.',
    input: { job_id: id('Job'), entry_id: id('Labor entry') },
    annotations: DELETE,
  }, ({ job_id, entry_id }) => callApi('DELETE', `/jobs/${job_id}/labor/${entry_id}`));

  defineTool(server, 'list_expenses', {
    title: 'List expenses',
    description: 'List job expenses, optionally for one job or category.',
    input: { job_id: z.string().optional(), category: expenseCategory.optional(), page, limit: limit(50) },
    annotations: READ,
  }, (a) => callApi('GET', '/expenses', { query: a }));

  defineTool(server, 'add_expense', {
    title: 'Add job expense',
    description: 'Record a job expense (materials, subcontractor, rental, supplies). expense_date defaults to today.',
    input: {
      job_id: id('Job'),
      vendor: z.string(),
      description: z.string(),
      amount: z.number(),
      category: expenseCategory,
      expense_date: date('Expense date').optional(),
      notes: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ job_id, expense_date, ...rest }) =>
    callApi('POST', `/jobs/${job_id}/expenses`, { body: { ...rest, expense_date: toDateTime(expense_date ?? today()) } }));

  defineTool(server, 'delete_expense', {
    title: 'Delete expense',
    description: 'Permanently remove an expense.',
    input: { job_id: id('Job'), expense_id: id('Expense') },
    annotations: DELETE,
  }, ({ job_id, expense_id }) => callApi('DELETE', `/jobs/${job_id}/expenses/${expense_id}`));

  // ─── Estimates ─────────────────────────────────────────────────────────────

  defineTool(server, 'list_estimates', {
    title: 'List estimates',
    description: 'List estimates, optionally for one job or status.',
    input: { job_id: z.string().optional(), status: estimateStatus.optional(), page, limit: limit() },
    annotations: READ,
  }, (a) => callApi('GET', '/estimates', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'get_estimate', {
    title: 'Get estimate',
    description: 'Get an estimate with job, customer, computed totals (incl. tax), contract status, email tracking, and approval link.',
    input: { estimate_id: id('Estimate') },
    annotations: READ,
  }, async ({ estimate_id }) => {
    const est = await prisma.estimate.findUnique({
      where: { id: estimate_id },
      include: {
        job: { include: { customer: true } },
        tax_profile: true,
        contract_template: { select: { id: true, name: true } },
        contracts: { select: { id: true, status: true, signed_at: true, customer_name_signed: true, pdf_url: true } },
        invoices: { where: { deleted_at: null }, select: { id: true, invoice_number: true, type: true, status: true } },
      },
    });
    if (!est || est.deleted_at) throw new ApiError(404, 'Estimate not found');
    const totals = computeInvoiceTotals({
      line_items: est.line_items as Items,
      state_rate: Number(est.tax_profile.state_rate),
      local_rate: Number(est.tax_profile.local_rate),
    });
    return {
      ...est,
      totals: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
      approval_url: est.approval_token ? `${appUrl()}/approve/${est.approval_token}` : null,
    };
  });

  defineTool(server, 'create_estimate', {
    title: 'Create estimate',
    description: 'Create a DRAFT estimate on a job. Numbering and tax profile are handled automatically. Does not send anything.',
    input: { job_id: id('Job'), ...estimateFields, line_items: lineItems },
    annotations: WRITE,
  }, (a) => callApi('POST', '/estimates', { body: compact(a) }));

  defineTool(server, 'update_estimate', {
    title: 'Update estimate',
    description: 'Edit an estimate (line items, notes, validity, status). Replacing line_items replaces the full list.',
    input: { estimate_id: id('Estimate'), ...estimateFields, status: estimateStatus.optional() },
    annotations: WRITE,
  }, ({ estimate_id, ...rest }) => callApi('PATCH', `/estimates/${estimate_id}`, { body: compact(rest) }));

  defineTool(server, 'send_estimate', {
    title: 'Send estimate to customer',
    description:
      'EMAILS THE CUSTOMER the proposal PDF and an approval/signature link, and marks the estimate SENT. ' +
      'Re-sending issues a new link. Confirm with the user before calling. Returns approval_url.',
    input: { estimate_id: id('Estimate') },
    annotations: EXTERNAL,
  }, ({ estimate_id }) => callApi('POST', `/estimates/${estimate_id}/send`));

  defineTool(server, 'convert_estimate_to_invoice', {
    title: 'Convert estimate to invoice',
    description: 'Create a DRAFT FINAL invoice from an APPROVED estimate. Does not email anything.',
    input: { estimate_id: id('Estimate') },
    annotations: WRITE,
  }, ({ estimate_id }) => callApi('POST', `/estimates/${estimate_id}/convert`));

  defineTool(server, 'delete_estimate', {
    title: 'Delete estimate',
    description: 'Soft-delete an estimate.',
    input: { estimate_id: id('Estimate') },
    annotations: DELETE,
  }, ({ estimate_id }) => callApi('DELETE', `/estimates/${estimate_id}`));

  // ─── Invoices & payments ───────────────────────────────────────────────────

  defineTool(server, 'list_invoices', {
    title: 'List invoices',
    description: 'List invoices with payments, job, and customer. start/end filter by created date.',
    input: {
      status: invoiceStatus.optional(),
      job_id: z.string().optional(),
      start: date('Created on/after').optional(),
      end: date('Created on/before').optional(),
      page,
      limit: limit(),
    },
    annotations: READ,
  }, ({ start, end, ...a }) =>
    callApi('GET', '/invoices', { query: { ...a, start: rangeStart(start), end: rangeEnd(end), limit: a.limit ?? 25 } }));

  defineTool(server, 'get_invoice', {
    title: 'Get invoice',
    description: 'Get an invoice with payments, computed totals and balance, email tracking, and the customer-facing link.',
    input: { invoice_id: id('Invoice') },
    annotations: READ,
  }, async ({ invoice_id }) => {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoice_id },
      include: {
        job: { include: { customer: true } },
        customer: true,
        tax_profile: true,
        payments: { orderBy: { paid_at: 'asc' } },
        exemptions: true,
        estimate: { select: { id: true, estimate_number: true } },
      },
    });
    if (!inv || inv.deleted_at) throw new ApiError(404, 'Invoice not found');
    const totals = computeInvoiceTotals({
      line_items: inv.line_items as Items,
      discount_type: inv.discount_type,
      discount_value: inv.discount_value ? Number(inv.discount_value) : null,
      state_rate: Number(inv.tax_profile.state_rate),
      local_rate: Number(inv.tax_profile.local_rate),
      amount_paid: inv.payments.reduce((s, p) => s + Number(p.amount), 0),
    });
    return { ...inv, totals, customer_url: `${appUrl()}/invoices/${inv.id}` };
  });

  defineTool(server, 'create_invoice', {
    title: 'Create invoice',
    description:
      'Create a DRAFT invoice. Identify the client with job_id, customer_id, contact_id, or company_id. ' +
      'tax_profile_id defaults to the default profile; due_date defaults to the company payment terms. Does not email.',
    input: {
      job_id: z.string().optional(),
      estimate_id: z.string().optional(),
      ...customerRef,
      ...invoiceFields,
      line_items: lineItems,
    },
    annotations: WRITE,
  }, async ({ job_id, customer_id, contact_id, company_id, due_date, tax_profile_id, type, ...rest }) => {
    let cid: string | undefined;
    if (customer_id || contact_id || company_id) {
      cid = await resolveCustomerId({ customer_id, contact_id, company_id });
    } else if (job_id) {
      const job = await prisma.job.findUnique({ where: { id: job_id } });
      if (!job) throw new ApiError(404, 'Job not found');
      cid = job.customer_id;
    } else {
      throw new ApiError(400, 'Provide job_id, customer_id, contact_id, or company_id');
    }
    const settings = await prisma.companySettings.findFirst();
    const due = due_date
      ? toDateTime(due_date)
      : new Date(Date.now() + (settings?.payment_terms_days ?? 7) * 86_400_000).toISOString();
    return callApi('POST', '/invoices', {
      body: compact({
        ...rest,
        job_id,
        customer_id: cid,
        type: type ?? 'FINAL',
        tax_profile_id: tax_profile_id ?? (await defaultTaxProfileId()),
        due_date: due,
      }),
    });
  });

  defineTool(server, 'update_invoice', {
    title: 'Update invoice',
    description: 'Edit an invoice (line items, discount, due date, notes, status such as VOID). Replacing line_items replaces the full list.',
    input: { invoice_id: id('Invoice'), ...invoiceFields, status: invoiceStatus.optional() },
    annotations: WRITE,
  }, ({ invoice_id, due_date, ...rest }) =>
    callApi('PATCH', `/invoices/${invoice_id}`, { body: compact({ ...rest, due_date: toDateTime(due_date) }) }));

  defineTool(server, 'delete_invoice', {
    title: 'Delete invoice',
    description: 'Soft-delete an invoice. Prefer update_invoice with status VOID for invoices already sent to a customer.',
    input: { invoice_id: id('Invoice') },
    annotations: DELETE,
  }, ({ invoice_id }) => callApi('PATCH', `/invoices/${invoice_id}`, { body: { deleted_at: new Date().toISOString() } }));

  defineTool(server, 'send_invoice', {
    title: 'Send invoice to customer',
    description: 'EMAILS THE CUSTOMER the invoice PDF and payment link. Confirm with the user before calling.',
    input: { invoice_id: id('Invoice') },
    annotations: EXTERNAL,
  }, ({ invoice_id }) => callApi('POST', `/invoices/${invoice_id}/send`));

  defineTool(server, 'record_payment', {
    title: 'Record payment',
    description: 'Record a payment received (check, cash, transfer, card). Invoice status updates to PARTIAL or PAID automatically.',
    input: {
      invoice_id: id('Invoice'),
      amount: z.number(),
      method: paymentMethod,
      paid_at: date('Payment date').optional().describe('Defaults to today'),
      notes: z.string().optional().describe('e.g. check number'),
    },
    annotations: WRITE,
  }, ({ invoice_id, paid_at, ...rest }) =>
    callApi('POST', `/invoices/${invoice_id}/payments`, {
      body: compact({ ...rest, paid_at: toDateTime(paid_at) ?? new Date().toISOString() }),
    }));

  defineTool(server, 'delete_payment', {
    title: 'Delete payment',
    description: 'Remove a recorded payment and recompute invoice status.',
    input: { invoice_id: id('Invoice'), payment_id: id('Payment') },
    annotations: DELETE,
  }, ({ invoice_id, payment_id }) => callApi('DELETE', `/invoices/${invoice_id}/payments/${payment_id}`));

  defineTool(server, 'create_payment_link', {
    title: 'Create Stripe payment link',
    description: 'Create a Stripe Checkout link for the remaining invoice balance. Returns the URL; does not email it.',
    input: { invoice_id: id('Invoice') },
    annotations: EXTERNAL,
  }, ({ invoice_id }) => callApi('POST', `/invoices/${invoice_id}/stripe-link`));
}
