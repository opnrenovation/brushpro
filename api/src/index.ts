import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { contactsRouter } from './routes/contacts';
import { contactListsRouter } from './routes/contactLists';
import { importsRouter } from './routes/imports';
import { customersRouter } from './routes/customers';
import { jobsRouter } from './routes/jobs';
import { materialItemsRouter } from './routes/materialItems';
import { estimatesRouter } from './routes/estimates';
import { approveRouter } from './routes/approve';
import { invoicesRouter } from './routes/invoices';
import { laborRouter } from './routes/labor';
import { expensesRouter } from './routes/expenses';
import { taxProfilesRouter } from './routes/taxProfiles';
import { emailTemplatesRouter } from './routes/emailTemplates';
import { campaignsRouter } from './routes/campaigns';
import { reportsRouter } from './routes/reports';
import { stripeWebhookRouter } from './routes/webhooks/stripe';
import { resendWebhookRouter } from './routes/webhooks/resend';
import leadsRouter from './routes/leads';
import schedulerRouter from './routes/scheduler';
import contractTemplatesRouter from './routes/contractTemplates';
import usersRouter from './routes/users';
import publicRouter from './routes/public';
import { vendorsRouter } from './routes/vendors';
import { companiesRouter } from './routes/companies';
import { employeesRouter } from './routes/employees';
import { payrollRouter } from './routes/payroll';
import { bugReportsRouter } from './routes/bugReports';
import { crewRouter } from './routes/crew';
import { jobCrewRouter } from './routes/jobCrew';
import { startFeedbackCron } from './lib/feedbackCron';
import { mcpRouter } from './mcp';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error';

const app = express();
const PORT = process.env.PORT || 3001;

// Webhooks need raw body — mount before json middleware
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);
// Both spellings: the endpoint registered in the Resend dashboard is
// /api/v1/webhooks/resend, which never matched the original mount below — no
// event had ever been delivered. Keep both so either registration works.
app.use(
  ['/api/v1/webhooks/resend', '/api/v1/resend/webhook'],
  express.raw({ type: 'application/json' }),
  resendWebhookRouter,
);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check — no auth
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes — no auth required
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/approve', approveRouter);
app.use('/api/public', publicRouter);

// MCP server for Claude — guarded by its own MCP_API_KEY bearer token.
// /api/mcp is the public path: the web service only proxies /api/* here.
app.use(['/mcp', '/api/mcp'], mcpRouter);

// Crew app — its own PIN sign-in and crew-only tokens (see routes/crew.ts)
app.use('/api/v1/crew', crewRouter);

// Protected routes
app.use('/api/v1', authenticate);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/contact-lists', contactListsRouter);
app.use('/api/v1/imports', importsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/material-items', materialItemsRouter);
app.use('/api/v1/estimates', estimatesRouter);
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/labor', laborRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/tax-profiles', taxProfilesRouter);
app.use('/api/v1/email-templates', emailTemplatesRouter);
app.use('/api/v1/campaigns', campaignsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/scheduler', schedulerRouter);
app.use('/api/v1/contract-templates', contractTemplatesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/vendors', vendorsRouter);
app.use('/api/v1/companies', companiesRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/payroll', payrollRouter);
app.use('/api/v1/bug-reports', bugReportsRouter);
app.use('/api/v1/job-crew', jobCrewRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BrushPro API running on port ${PORT}`);
  startFeedbackCron();
});

export default app;
