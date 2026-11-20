import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerOverviewTools } from './tools/overview';
import { registerCrmTools } from './tools/crm';
import { registerWorkTools } from './tools/work';
import { registerOpsTools } from './tools/ops';

const INSTRUCTIONS = `
BrushPro runs OPN Renovation, a small Des Moines-area painting company. You act as the owner.

How the data fits together:
- Contacts (people) and Companies are the CRM and the real client list. Billing "customers" are created from them automatically when a job or invoice needs one, so look clients up with search, list_contacts, or list_companies.
- Pipeline: lead (NEW > CONTACTED > APPOINTMENT > ESTIMATE_SENT > NEGOTIATING > WON/LOST) > convert_lead_to_job > job.
- Job flow: create_estimate (DRAFT) > send_estimate (customer gets PDF + approval/signature link) > customer approves and pays the deposit > job ACTIVE > complete_job (emails the final balance invoice) > record_payment.
- Money: line item unit_price is what the customer pays; our_cost is internal and never shown to customers. Totals, tax (Iowa state + local by municipality), deposits, and balances are computed by the app; do not hand-calculate them into line items.
- Dates are Central time. Pass YYYY-MM-DD for dates, or ISO 8601 with offset for appointment times.

Rules:
- Tools whose description says they email the customer, and send_campaign, reach real people. Confirm with the user before calling them, unless the user explicitly told you to send.
- Start with business_snapshot for "how are we doing" or "what needs attention", and with search to find ids.
- Anything without a dedicated tool can be done with api_request.
`.trim();

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'brushpro', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );
  registerOverviewTools(server);
  registerCrmTools(server);
  registerWorkTools(server);
  registerOpsTools(server);
  return server;
}

function requireMcpKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    res.status(503).json({ error: 'MCP is disabled: set MCP_API_KEY to enable it' });
    return;
  }
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Invalid MCP API key' });
    return;
  }
  next();
}

export const mcpRouter = Router();

// Stateless Streamable HTTP: a fresh server per request, so nothing to clean
// up between Railway restarts and no sticky sessions needed.
mcpRouter.post('/', requireMcpKey, async (req, res) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] request failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

mcpRouter.all('/', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed: this MCP server is stateless and only accepts POST' },
    id: null,
  });
});
