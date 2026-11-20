import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi, rangeStart, rangeEnd } from '../api';
import { defineTool, READ, WRITE, DELETE, EXTERNAL, id, date, page, limit, compact } from '../define';

const appointmentStatus = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);
const campaignStatus = z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED']);
const vendorCategory = z.enum(['PAINT_SUPPLIER', 'EQUIPMENT', 'SUBCONTRACTOR', 'MATERIALS', 'OTHER']);

const timestamp = (what: string) =>
  z.string().describe(`${what} as ISO 8601 with offset, e.g. 2026-10-15T14:00:00-05:00 (Central time)`);

const campaignFields = {
  name: z.string().optional(),
  subject: z.string().optional(),
  preview_text: z.string().optional(),
  html_body: z.string().optional().describe('Full HTML email body'),
  template_id: z.string().optional(),
  list_ids: z.array(z.string()).optional().describe('Contact list ids. Empty means ALL subscribed contacts.'),
};

const materialFields = {
  name: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional().describe('e.g. gal, qt, roll, each'),
  our_cost: z.number().optional().describe('Internal cost per unit'),
  sku: z.string().optional(),
  vendor: z.string().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
};

const vendorFields = {
  name: z.string().optional(),
  category: vendorCategory.optional(),
  contact_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
};

export function registerOpsTools(server: McpServer) {
  // ─── Scheduling ────────────────────────────────────────────────────────────

  defineTool(server, 'list_appointments', {
    title: 'List appointments',
    description: 'List booked appointments (estimate visits, consultations), soonest first.',
    input: {
      status: appointmentStatus.optional(),
      from: date('From').optional(),
      to: date('To').optional(),
    },
    annotations: READ,
  }, ({ from, to, status }) =>
    callApi('GET', '/scheduler/appointments', { query: { status, from: rangeStart(from), to: rangeEnd(to) } }));

  defineTool(server, 'create_appointment', {
    title: 'Book appointment',
    description:
      'Book an appointment and sync it to Google Calendar. Get appointment_type_id from get_scheduler_config. ' +
      'Does not email the customer.',
    input: {
      appointment_type_id: id('Appointment type'),
      scheduled_at: timestamp('Start time'),
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      phone: z.string(),
      duration_minutes: z.number().int().optional(),
      notes: z.string().optional(),
      lead_id: z.string().optional(),
      contact_id: z.string().optional(),
    },
    annotations: WRITE,
  }, (a) => callApi('POST', '/scheduler/appointments', { body: compact(a) }));

  defineTool(server, 'update_appointment', {
    title: 'Update appointment',
    description: 'Reschedule, add notes, or set status (COMPLETED, CANCELLED, NO_SHOW). Google Calendar stays in sync.',
    input: {
      appointment_id: id('Appointment'),
      status: appointmentStatus.optional(),
      scheduled_at: timestamp('New start time').optional(),
      notes: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ appointment_id, ...rest }) => callApi('PATCH', `/scheduler/appointments/${appointment_id}`, { body: compact(rest) }));

  defineTool(server, 'get_scheduler_config', {
    title: 'Get scheduler config',
    description: 'Booking settings, weekly availability rules (0=Sunday), and appointment types.',
    input: {},
    annotations: READ,
  }, async () => {
    const [settings, rules, types] = await Promise.all([
      callApi<{ data: Record<string, unknown> }>('GET', '/scheduler/settings'),
      callApi('GET', '/scheduler/availability-rules'),
      callApi('GET', '/scheduler/appointment-types'),
    ]);
    // The OAuth refresh token is a credential; nothing here needs it.
    const { google_refresh_token, ...safeSettings } = settings.data;
    return {
      settings: { ...safeSettings, google_calendar_connected: !!google_refresh_token },
      availability_rules: rules,
      appointment_types: types,
    };
  });

  // ─── Marketing ─────────────────────────────────────────────────────────────

  defineTool(server, 'list_contact_lists', {
    title: 'List contact lists',
    description: 'Marketing contact lists with member and subscribed counts.',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/contact-lists'));

  defineTool(server, 'create_contact_list', {
    title: 'Create contact list',
    description: 'Create a marketing contact list.',
    input: { name: z.string(), description: z.string().optional() },
    annotations: WRITE,
  }, (a) => callApi('POST', '/contact-lists', { body: compact(a) }));

  defineTool(server, 'update_contact_list_members', {
    title: 'Add/remove list members',
    description: 'Add and/or remove contacts from a contact list.',
    input: {
      list_id: id('Contact list'),
      add_contact_ids: z.array(z.string()).optional(),
      remove_contact_ids: z.array(z.string()).optional(),
    },
    annotations: WRITE,
  }, async ({ list_id, add_contact_ids, remove_contact_ids }) => {
    const result: Record<string, unknown> = {};
    if (add_contact_ids?.length) {
      result.added = await callApi('POST', `/contact-lists/${list_id}/members`, { body: { contact_ids: add_contact_ids } });
    }
    if (remove_contact_ids?.length) {
      result.removed = await callApi('DELETE', `/contact-lists/${list_id}/members`, { body: { contact_ids: remove_contact_ids } });
    }
    return result;
  });

  defineTool(server, 'list_email_templates', {
    title: 'List email templates',
    description: 'Saved marketing email templates (without bodies).',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/email-templates'));

  defineTool(server, 'create_email_template', {
    title: 'Create email template',
    description: 'Save a reusable marketing email template.',
    input: {
      name: z.string(),
      subject: z.string(),
      html_body: z.string(),
      preview_text: z.string().optional(),
    },
    annotations: WRITE,
  }, (a) => callApi('POST', '/email-templates', { body: compact(a) }));

  defineTool(server, 'list_campaigns', {
    title: 'List campaigns',
    description: 'Email marketing campaigns, newest first.',
    input: { status: campaignStatus.optional(), page, limit: limit() },
    annotations: READ,
  }, (a) => callApi('GET', '/campaigns', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'create_campaign', {
    title: 'Create campaign draft',
    description: 'Create a DRAFT email campaign. Nothing is sent until send_campaign.',
    input: { ...campaignFields, name: z.string(), subject: z.string(), html_body: z.string() },
    annotations: WRITE,
  }, (a) => callApi('POST', '/campaigns', { body: compact(a) }));

  defineTool(server, 'update_campaign', {
    title: 'Update campaign',
    description: 'Edit a draft campaign.',
    input: { campaign_id: id('Campaign'), ...campaignFields },
    annotations: WRITE,
  }, ({ campaign_id, ...rest }) => callApi('PATCH', `/campaigns/${campaign_id}`, { body: compact(rest) }));

  defineTool(server, 'send_campaign_test', {
    title: 'Send campaign test',
    description: 'Email a [TEST] copy of a campaign to one address.',
    input: { campaign_id: id('Campaign'), email: z.string() },
    annotations: EXTERNAL,
  }, ({ campaign_id, email }) => callApi('POST', `/campaigns/${campaign_id}/test`, { body: { email } }));

  defineTool(server, 'send_campaign', {
    title: 'Send campaign now',
    description:
      'EMAILS EVERY SUBSCRIBED RECIPIENT on the campaign lists (or all subscribed contacts if no lists). ' +
      'Irreversible. Always confirm the recipient count and content with the user first.',
    input: { campaign_id: id('Campaign') },
    annotations: EXTERNAL,
  }, ({ campaign_id }) => callApi('POST', `/campaigns/${campaign_id}/send`));

  defineTool(server, 'schedule_campaign', {
    title: 'Schedule campaign',
    description: 'Mark a campaign SCHEDULED for a future time.',
    input: { campaign_id: id('Campaign'), scheduled_at: timestamp('Send time') },
    annotations: WRITE,
  }, ({ campaign_id, scheduled_at }) => callApi('POST', `/campaigns/${campaign_id}/schedule`, { body: { scheduled_at } }));

  defineTool(server, 'cancel_campaign', {
    title: 'Cancel campaign',
    description: 'Cancel a draft or scheduled campaign.',
    input: { campaign_id: id('Campaign') },
    annotations: WRITE,
  }, ({ campaign_id }) => callApi('POST', `/campaigns/${campaign_id}/cancel`));

  defineTool(server, 'campaign_analytics', {
    title: 'Campaign analytics',
    description: 'Delivered/opened/clicked/bounced counts, rates, and link clicks for a sent campaign.',
    input: { campaign_id: id('Campaign') },
    annotations: READ,
  }, async ({ campaign_id }) => {
    const res = await callApi<{ data: Record<string, unknown> }>('GET', `/campaigns/${campaign_id}/analytics`);
    // The raw event stream can be thousands of rows; the counts carry the signal.
    const { events_over_time, ...summary } = res.data;
    return { ...summary, event_count: Array.isArray(events_over_time) ? events_over_time.length : 0 };
  });

  // ─── Catalog ───────────────────────────────────────────────────────────────

  defineTool(server, 'list_material_items', {
    title: 'List materials',
    description: 'Material price book (paint, supplies) with internal cost.',
    input: {
      search: z.string().optional(),
      category: z.string().optional(),
      active: z.boolean().optional(),
      page,
      limit: limit(100),
    },
    annotations: READ,
  }, (a) => callApi('GET', '/material-items', { query: a }));

  defineTool(server, 'create_material_item', {
    title: 'Create material',
    description: 'Add an item to the material price book.',
    input: { ...materialFields, name: z.string(), category: z.string(), unit: z.string(), our_cost: z.number() },
    annotations: WRITE,
  }, (a) => callApi('POST', '/material-items', { body: compact(a) }));

  defineTool(server, 'update_material_item', {
    title: 'Update material',
    description: 'Change a material price book item (e.g. new cost, deactivate).',
    input: { material_item_id: id('Material item'), ...materialFields },
    annotations: WRITE,
  }, ({ material_item_id, ...rest }) => callApi('PATCH', `/material-items/${material_item_id}`, { body: compact(rest) }));

  defineTool(server, 'list_vendors', {
    title: 'List vendors',
    description: 'Suppliers and subcontractors.',
    input: { search: z.string().optional(), category: vendorCategory.optional() },
    annotations: READ,
  }, (a) => callApi('GET', '/vendors', { query: a }));

  defineTool(server, 'create_vendor', {
    title: 'Create vendor',
    description: 'Add a supplier or subcontractor.',
    input: { ...vendorFields, name: z.string() },
    annotations: WRITE,
  }, (a) => callApi('POST', '/vendors', { body: compact(a) }));

  defineTool(server, 'update_vendor', {
    title: 'Update vendor',
    description: 'Change vendor details.',
    input: { vendor_id: id('Vendor'), ...vendorFields },
    annotations: WRITE,
  }, ({ vendor_id, ...rest }) => callApi('PATCH', `/vendors/${vendor_id}`, { body: compact(rest) }));

  defineTool(server, 'delete_vendor', {
    title: 'Delete vendor',
    description: 'Soft-delete a vendor.',
    input: { vendor_id: id('Vendor') },
    annotations: DELETE,
  }, ({ vendor_id }) => callApi('DELETE', `/vendors/${vendor_id}`));

  defineTool(server, 'list_tax_profiles', {
    title: 'List tax profiles',
    description: 'Sales tax profiles by municipality (state + local rates as decimals, e.g. 0.06).',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/tax-profiles'));

  defineTool(server, 'list_contract_templates', {
    title: 'List contract templates',
    description: 'Contract templates attached to estimates for e-signature.',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/contract-templates'));

  // ─── Company & team ────────────────────────────────────────────────────────

  defineTool(server, 'get_company_settings', {
    title: 'Get company settings',
    description: 'Company profile, numbering, payment terms, deposit rules, default labor rate, and messages.',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/settings'));

  defineTool(server, 'update_company_settings', {
    title: 'Update company settings',
    description:
      'Change company settings. Pass only the fields to change, e.g. company_name, phone, email, address, website, ' +
      'license_number, default_labor_rate, payment_terms_days, payment_terms_label, estimate_expiry_days, ' +
      'deposit_required, deposit_percentage, deposit_min_job_total, disclaimer, invoice_notes, estimate_notes, google_review_url.',
    input: { changes: z.record(z.string(), z.any()) },
    annotations: WRITE,
  }, ({ changes }) => callApi('PATCH', '/settings', { body: changes }));

  defineTool(server, 'list_users', {
    title: 'List team users',
    description: 'BrushPro login users (owners and admins).',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/users'));

  // ─── Bug reports ───────────────────────────────────────────────────────────

  defineTool(server, 'list_bug_reports', {
    title: 'List bug reports',
    description:
      'Bug reports and change requests the team filed from the "Report a bug" button in BrushPro. ' +
      'Newest first. Use since to fetch only reports filed after a timestamp.',
    input: {
      status: z.string().optional().describe('Comma-separated: OPEN, IN_PROGRESS, RESOLVED, WONT_FIX'),
      type: z.enum(['BUG', 'FEATURE_REQUEST', 'QUESTION']).optional(),
      since: z.string().optional().describe('ISO 8601 timestamp; only reports created after it'),
    },
    annotations: READ,
  }, (args) => callApi('GET', '/bug-reports', { query: compact(args) }));

  defineTool(server, 'get_bug_report', {
    title: 'Get bug report',
    description: 'One bug report with its full description and screenshot (data URL, if attached).',
    input: { report_id: id('Bug report') },
    annotations: READ,
  }, ({ report_id }) => callApi('GET', `/bug-reports/${report_id}`));

  defineTool(server, 'update_bug_report', {
    title: 'Update bug report',
    description: 'Change status (OPEN, IN_PROGRESS, RESOLVED, WONT_FIX), priority, or the resolution notes the reporter sees.',
    input: {
      report_id: id('Bug report'),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).optional(),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
      resolution_notes: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ report_id, ...rest }) => callApi('PATCH', `/bug-reports/${report_id}`, { body: compact(rest) }));

  // ─── Employees & payroll ───────────────────────────────────────────────────

  defineTool(server, 'list_employees', {
    title: 'List employees',
    description: 'Crew and staff on payroll, with pay type, rate and withholding settings.',
    input: { status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(), search: z.string().optional() },
    annotations: READ,
  }, (args) => callApi('GET', '/employees', { query: compact(args) }));

  defineTool(server, 'log_employee_hours', {
    title: 'Log employee hours',
    description: 'Record hours an employee worked on a day, optionally against a job. Feeds the next pay run.',
    input: {
      employee_id: id('Employee'),
      work_date: date('Day worked'),
      hours: z.number().positive().max(24),
      job_id: id('Job').optional(),
      notes: z.string().optional(),
    },
    annotations: WRITE,
  }, (args) => callApi('POST', '/employees/time-entries', { body: compact(args) }));

  defineTool(server, 'list_time_entries', {
    title: 'List time entries',
    description:
      'Employee hours. status PENDING = crew-app shifts waiting for approval (only APPROVED time is paid). ' +
      'open=true lists who is on the clock right now.',
    input: {
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      employee_id: id('Employee').optional(),
      job_id: id('Job').optional(),
      from: date('From').optional(),
      to: date('To').optional(),
      open: z.boolean().optional(),
    },
    annotations: READ,
  }, ({ open, ...rest }) => callApi('GET', '/employees/time-entries', { query: compact({ ...rest, open: open ? '1' : undefined }) }));

  defineTool(server, 'review_time_entries', {
    title: 'Approve or reject time',
    description: 'Approve or reject crew time entries. A rejection note is shown to the employee in the crew app.',
    input: {
      ids: z.array(z.string()).min(1),
      action: z.enum(['approve', 'reject']),
      note: z.string().optional(),
    },
    annotations: WRITE,
  }, (args) => callApi('POST', '/employees/time-entries/review', { body: compact(args) }));

  defineTool(server, 'set_job_crew', {
    title: 'Assign crew to a job',
    description: 'Set exactly which employees are assigned to a job (they see it in the crew app), and optionally the crew instructions. Never put prices in crew_notes.',
    input: {
      job_id: id('Job'),
      employee_ids: z.array(z.string()),
      crew_notes: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ job_id, ...rest }) => callApi('PUT', `/job-crew/${job_id}`, { body: compact(rest) }));

  defineTool(server, 'list_pay_runs', {
    title: 'List pay runs',
    description: 'Payroll runs (DRAFT, FINALIZED, PAID) with totals.',
    input: {},
    annotations: READ,
  }, () => callApi('GET', '/payroll/runs'));

  defineTool(server, 'get_pay_run', {
    title: 'Get pay run',
    description: 'A pay run with every employee stub: hours, gross, withholding, net.',
    input: { pay_run_id: id('Pay run') },
    annotations: READ,
  }, ({ pay_run_id }) => callApi('GET', `/payroll/runs/${pay_run_id}`));

  defineTool(server, 'create_pay_run', {
    title: 'Create pay run',
    description: 'Start a DRAFT pay run for a period. Stubs are built from logged hours and salaries automatically.',
    input: {
      period_start: date('Pay period start'),
      period_end: date('Pay period end'),
      pay_date: date('Pay date'),
      frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY']).optional(),
    },
    annotations: WRITE,
  }, (args) => callApi('POST', '/payroll/runs', { body: compact(args) }));

  // ─── Reports ───────────────────────────────────────────────────────────────

  defineTool(server, 'get_report', {
    title: 'Run report',
    description:
      'Financial reports. tax: sales tax collected by county; tax_outstanding: tax on unpaid invoices; ' +
      'profit: per-job profit; materials: material usage and cost.',
    input: {
      report: z.enum(['tax', 'tax_outstanding', 'profit', 'materials']),
      start: date('Period start').optional(),
      end: date('Period end').optional(),
    },
    annotations: READ,
  }, ({ report, start, end }) => {
    const path = { tax: '/reports/tax', tax_outstanding: '/reports/tax/outstanding', profit: '/reports/profit', materials: '/reports/materials' }[report];
    return callApi('GET', path, { query: { start: rangeStart(start), end: rangeEnd(end) } });
  });
}
