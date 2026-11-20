import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// MCP tools reuse the REST API in-process instead of re-implementing it, so
// every side effect (numbering, PDFs, Resend emails, deposits, Google Calendar
// sync) behaves exactly as it does when the same action is taken in the web app.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type QueryValue = string | number | boolean | undefined | null;

// The user MCP actions are attributed to (labor entries, campaigns, lead
// activity). MCP_USER_EMAIL picks one explicitly; otherwise the first owner.
export async function getActingUser() {
  const email = process.env.MCP_USER_EMAIL;
  const user = email
    ? await prisma.user.findFirst({ where: { email, is_active: true } })
    : await prisma.user.findFirst({ where: { role: 'OWNER', is_active: true }, orderBy: { created_at: 'asc' } });
  if (!user) {
    throw new ApiError(500, email ? `No active user with email ${email}` : 'No active OWNER user exists');
  }
  return user;
}

function internalBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PORT || 3001}`;
}

export async function callApi<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: { query?: Record<string, QueryValue>; body?: unknown } = {},
): Promise<T> {
  const user = await getActingUser();
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '5m' });

  const url = new URL(`/api/v1${path.startsWith('/') ? path : `/${path}`}`, internalBaseUrl());
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let payload: unknown;
  if (contentType.includes('application/json')) {
    payload = await res.json();
  } else if (contentType.startsWith('text/') || contentType.includes('csv')) {
    payload = await res.text();
  } else {
    const bytes = (await res.arrayBuffer()).byteLength;
    payload = { content_type: contentType, bytes, note: 'Binary response not returned over MCP' };
  }

  if (!res.ok) {
    const p = payload as { error?: string; message?: string; details?: string } | string;
    const message = typeof p === 'string' ? p : p?.error || p?.message || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

// Date-only strings ("2026-10-15") become noon UTC so the calendar date stays
// the same in every US timezone; Prisma rejects bare dates on DateTime fields.
export function toDateTime(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00.000Z`;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new ApiError(400, `Invalid date: ${value}`);
  return d.toISOString();
}

// Range filters: a date-only end bound must include that whole day.
export function rangeStart(value: string | undefined): string | undefined {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  return toDateTime(value);
}

export function rangeEnd(value: string | undefined): string | undefined {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59:59.999Z`;
  return toDateTime(value);
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// Billing Customer rows are derived lazily from the CRM (Contacts/Companies),
// mirroring the resolve-or-create logic in the web app's jobs and invoices pages.
export async function resolveCustomerId(input: {
  customer_id?: string;
  contact_id?: string;
  company_id?: string;
}): Promise<string> {
  if (input.customer_id) return input.customer_id;

  if (input.contact_id) {
    const existing = await prisma.customer.findFirst({ where: { contact_id: input.contact_id, deleted_at: null } });
    if (existing) return existing.id;
    const contact = await prisma.contact.findUnique({ where: { id: input.contact_id } });
    if (!contact || contact.deleted_at) throw new ApiError(404, 'Contact not found');
    const created = await prisma.customer.create({
      data: {
        contact_id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email,
        phone: contact.phone ?? undefined,
        address: contact.address || '',
      },
    });
    return created.id;
  }

  if (input.company_id) {
    const company = await prisma.company.findUnique({ where: { id: input.company_id } });
    if (!company || company.deleted_at) throw new ApiError(404, 'Company not found');
    const existing = await prisma.customer.findFirst({ where: { name: company.name, deleted_at: null } });
    if (existing) return existing.id;
    const created = await prisma.customer.create({
      data: {
        name: company.name,
        email: company.email ?? undefined,
        phone: company.phone ?? undefined,
        address: company.address || '',
      },
    });
    return created.id;
  }

  throw new ApiError(400, 'Provide customer_id, contact_id, or company_id');
}
