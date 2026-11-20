import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '../../lib/prisma';
import { callApi, ApiError } from '../api';
import { defineTool, READ, WRITE, DELETE, id, page, limit, compact } from '../define';

const contactType = z.enum(['PROSPECT', 'CUSTOMER', 'BOTH']);
const leadStage = z.enum(['NEW', 'CONTACTED', 'APPOINTMENT', 'ESTIMATE_SENT', 'NEGOTIATING', 'WON', 'LOST']);
const leadSource = z.enum(['WEBSITE_FORM', 'MANUAL', 'REFERRAL', 'PHONE', 'OTHER']);

const contactFields = {
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional().describe('Company name; linked to (or creates) a Company record'),
  company_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  type: contactType.optional(),
  subscribed: z.boolean().optional().describe('Marketing email opt-in'),
};

const companyFields = {
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
};

export function registerCrmTools(server: McpServer) {
  // ─── Contacts ──────────────────────────────────────────────────────────────

  defineTool(server, 'list_contacts', {
    title: 'List contacts',
    description: 'Search the CRM contact list (people). Contacts are the master client list.',
    input: {
      search: z.string().optional().describe('Matches name, email, company, or tag'),
      type: contactType.optional(),
      tag: z.string().optional(),
      subscribed: z.boolean().optional(),
      page,
      limit: limit(),
    },
    annotations: READ,
  }, (a) => callApi('GET', '/contacts', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'get_contact', {
    title: 'Get contact',
    description: 'Get one contact with its leads, billing customer, and jobs.',
    input: { contact_id: id('Contact') },
    annotations: READ,
  }, async ({ contact_id }) => {
    const contact = await prisma.contact.findUnique({
      where: { id: contact_id },
      include: {
        company_rel: { select: { id: true, name: true } },
        leads: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } },
        customer: { include: { jobs: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } } } },
        list_members: { include: { list: { select: { id: true, name: true } } } },
      },
    });
    if (!contact || contact.deleted_at) throw new ApiError(404, 'Contact not found');
    return contact;
  });

  defineTool(server, 'create_contact', {
    title: 'Create contact',
    description: 'Add a person to the CRM. first_name, last_name, and email are required; email must be unique.',
    input: {
      ...contactFields,
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
    },
    annotations: WRITE,
  }, (a) => callApi('POST', '/contacts', { body: compact(a) }));

  defineTool(server, 'update_contact', {
    title: 'Update contact',
    description: 'Change fields on a contact. Only the fields you pass are changed.',
    input: { contact_id: id('Contact'), ...contactFields },
    annotations: WRITE,
  }, ({ contact_id, ...rest }) => callApi('PATCH', `/contacts/${contact_id}`, { body: compact(rest) }));

  defineTool(server, 'delete_contact', {
    title: 'Delete contact',
    description: 'Soft-delete a contact (hidden from lists, recoverable in the database).',
    input: { contact_id: id('Contact') },
    annotations: DELETE,
  }, ({ contact_id }) => callApi('DELETE', `/contacts/${contact_id}`));

  // ─── Companies ─────────────────────────────────────────────────────────────

  defineTool(server, 'list_companies', {
    title: 'List companies',
    description: 'Search CRM companies (businesses, property managers, GCs) with their contacts.',
    input: { search: z.string().optional(), page, limit: limit() },
    annotations: READ,
  }, (a) => callApi('GET', '/companies', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'get_company', {
    title: 'Get company',
    description: 'Get one company with its contacts.',
    input: { company_id: id('Company') },
    annotations: READ,
  }, ({ company_id }) => callApi('GET', `/companies/${company_id}`));

  defineTool(server, 'create_company', {
    title: 'Create company',
    description: 'Add a company to the CRM.',
    input: { ...companyFields, name: z.string() },
    annotations: WRITE,
  }, (a) => callApi('POST', '/companies', { body: compact(a) }));

  defineTool(server, 'update_company', {
    title: 'Update company',
    description: 'Change fields on a company.',
    input: { company_id: id('Company'), ...companyFields },
    annotations: WRITE,
  }, ({ company_id, ...rest }) => callApi('PATCH', `/companies/${company_id}`, { body: compact(rest) }));

  defineTool(server, 'delete_company', {
    title: 'Delete company',
    description: 'Soft-delete a company.',
    input: { company_id: id('Company') },
    annotations: DELETE,
  }, ({ company_id }) => callApi('DELETE', `/companies/${company_id}`));

  // ─── Billing customers ─────────────────────────────────────────────────────

  defineTool(server, 'list_customers', {
    title: 'List billing customers',
    description:
      'List billing customer records (created automatically when a job or invoice is made for a contact/company). ' +
      'To find a client, prefer list_contacts / list_companies or search.',
    input: { search: z.string().optional(), page, limit: limit() },
    annotations: READ,
  }, (a) => callApi('GET', '/customers', { query: { ...a, limit: a.limit ?? 25 } }));

  defineTool(server, 'get_customer', {
    title: 'Get billing customer',
    description: 'Get a billing customer with their jobs.',
    input: { customer_id: id('Customer') },
    annotations: READ,
  }, ({ customer_id }) => callApi('GET', `/customers/${customer_id}`));

  defineTool(server, 'update_customer', {
    title: 'Update billing customer',
    description: 'Change the name, email, phone, address, or notes on a billing customer.',
    input: {
      customer_id: id('Customer'),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ customer_id, ...rest }) => callApi('PATCH', `/customers/${customer_id}`, { body: compact(rest) }));

  // ─── Leads ─────────────────────────────────────────────────────────────────

  defineTool(server, 'list_leads', {
    title: 'List leads',
    description: 'List sales pipeline leads with contact, appointment, and estimate summaries.',
    input: {
      stage: leadStage.optional(),
      source: leadSource.optional(),
      assigned_to: z.string().optional().describe('User id'),
      open_only: z.boolean().optional().describe('Exclude WON and LOST'),
    },
    annotations: READ,
  }, async ({ open_only, ...q }) => {
    const res = await callApi<{ data: Array<{ stage: string }> }>('GET', '/leads', { query: q });
    return open_only ? { data: res.data.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST') } : res;
  });

  defineTool(server, 'get_lead', {
    title: 'Get lead',
    description: 'Get one lead with its full activity history, appointment, estimate, and job.',
    input: { lead_id: id('Lead') },
    annotations: READ,
  }, ({ lead_id }) => callApi('GET', `/leads/${lead_id}`));

  defineTool(server, 'create_lead', {
    title: 'Create lead',
    description:
      'Add a lead to the pipeline. Pass contact_id for an existing contact, or first_name/last_name/email ' +
      '(plus optional phone) to find-or-create the contact by email.',
    input: {
      contact_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      source: leadSource.optional().describe('Default MANUAL'),
      service_needed: z.string().optional().describe('e.g. Interior painting, Cabinet refinishing'),
      project_address: z.string().optional(),
      message: z.string().optional(),
      heard_from: z.string().optional(),
      assigned_to: z.string().optional().describe('User id'),
      notes: z.string().optional(),
    },
    annotations: WRITE,
  }, async ({ contact_id, first_name, last_name, email, phone, ...lead }) => {
    let contactId = contact_id;
    if (!contactId) {
      if (!email) throw new ApiError(400, 'Provide contact_id, or email (with first_name/last_name) to create the contact');
      const existing = await prisma.contact.findUnique({ where: { email } });
      if (existing && !existing.deleted_at) {
        contactId = existing.id;
      } else {
        if (!first_name || !last_name) throw new ApiError(400, 'first_name and last_name are required to create a new contact');
        const created = await callApi<{ data: { id: string } }>('POST', '/contacts', {
          body: compact({ first_name, last_name, email, phone, address: lead.project_address, source: lead.source ?? 'MANUAL' }),
        });
        contactId = created.data.id;
      }
    }
    return callApi('POST', '/leads', { body: compact({ contact_id: contactId, ...lead }) });
  });

  defineTool(server, 'update_lead', {
    title: 'Update lead',
    description: 'Move a lead between stages or change its details. Moving to LOST requires lost_reason. Stage changes are logged.',
    input: {
      lead_id: id('Lead'),
      stage: leadStage.optional(),
      lost_reason: z.string().optional(),
      notes: z.string().optional(),
      assigned_to: z.string().optional(),
      service_needed: z.string().optional(),
      source: leadSource.optional(),
      project_address: z.string().optional(),
      appointment_id: z.string().optional(),
      estimate_id: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ lead_id, ...rest }) => callApi('PATCH', `/leads/${lead_id}`, { body: compact(rest) }));

  defineTool(server, 'add_lead_activity', {
    title: 'Log lead activity',
    description: 'Log a note, call, email, or other touchpoint on a lead timeline.',
    input: {
      lead_id: id('Lead'),
      type: z.enum(['NOTE', 'CALL', 'EMAIL_SENT', 'APPOINTMENT', 'SYSTEM']),
      description: z.string(),
    },
    annotations: WRITE,
  }, ({ lead_id, ...rest }) => callApi('POST', `/leads/${lead_id}/activities`, { body: rest }));

  defineTool(server, 'convert_lead_to_job', {
    title: 'Convert lead to job',
    description:
      'Turn a WON lead into a billing customer and a new job (status ESTIMATING). The lead must be in stage WON; ' +
      'set it with update_lead first if needed.',
    input: {
      lead_id: id('Lead'),
      job_name: z.string().optional(),
      address: z.string().optional().describe('Defaults to the lead project address'),
      municipality: z.string().optional().describe('City used to pick the tax profile, e.g. Ankeny'),
    },
    annotations: WRITE,
  }, ({ lead_id, ...rest }) => callApi('POST', `/leads/${lead_id}/convert`, { body: compact(rest) }));

  defineTool(server, 'delete_lead', {
    title: 'Delete lead',
    description: 'Soft-delete a lead.',
    input: { lead_id: id('Lead') },
    annotations: DELETE,
  }, ({ lead_id }) => callApi('DELETE', `/leads/${lead_id}`));
}
