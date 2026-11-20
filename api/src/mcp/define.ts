import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError } from './api';

// Tool annotations let MCP clients decide what needs a confirmation prompt.
export const READ = { readOnlyHint: true, openWorldHint: false };
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
export const DELETE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
// Reaches people outside the business (customer email, campaign, Stripe).
export const EXTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };

const MAX_CHARS = 120_000;

function format(result: unknown): string {
  const text = typeof result === 'string' ? result : JSON.stringify(result ?? { ok: true });
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS)}\n...[truncated ${text.length - MAX_CHARS} chars; narrow the query or lower the limit]`;
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const details =
      err.body && typeof err.body === 'object' && 'details' in err.body ? ` (${(err.body as { details: string }).details})` : '';
    return `Error ${err.status}: ${err.message}${details}`;
  }
  if (err instanceof Error) return `Error: ${err.message}`;
  return 'Error: unknown failure';
}

export function defineTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: {
    title: string;
    description: string;
    input: S;
    annotations: Record<string, boolean>;
  },
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
): void {
  // Loosely typed: registerTool's generics over a dynamic shape trip the
  // compiler without adding safety beyond what the zod schema already gives.
  (server.registerTool as any)(
    name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.input,
      annotations: { title: config.title, ...config.annotations },
    },
    async (args: z.infer<z.ZodObject<S>>) => {
      try {
        const result = await handler(args);
        return { content: [{ type: 'text', text: format(result) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: errorText(err) }] };
      }
    },
  );
}

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const id = (what: string) => z.string().describe(`${what} id`);

export const date = (what: string) =>
  z.string().describe(`${what} as YYYY-MM-DD or a full ISO 8601 timestamp`);

export const page = z.number().int().min(1).optional().describe('Page number, default 1');
export const limit = (def = 25) => z.number().int().min(1).max(500).optional().describe(`Page size, default ${def}`);

export const lineItem = z
  .object({
    description: z.string(),
    qty: z.number(),
    unit_price: z.number().describe('Price per unit charged to the customer'),
    unit: z.string().optional().describe('e.g. hr, gal, sqft, room'),
    taxable: z.boolean().optional().describe('Defaults to true. Labor is usually false in Iowa.'),
    type: z
      .string()
      .optional()
      .describe('Use "material" for materials so job profitability counts our_cost; otherwise "labor" or "other"'),
    our_cost: z.number().optional().describe('INTERNAL cost per unit. Never shown to customers.'),
  })
  .passthrough();

export const lineItems = z.array(lineItem).describe('Line items. Totals and tax are computed by the app.');

export const customerRef = {
  customer_id: z.string().optional().describe('Billing customer id, if already known'),
  contact_id: z.string().optional().describe('CRM contact id; a billing customer is created from it if needed'),
  company_id: z.string().optional().describe('CRM company id; a billing customer is created from it if needed'),
};

// Drop undefined keys so PATCH bodies only carry what the caller set.
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
