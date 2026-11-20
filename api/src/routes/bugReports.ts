import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireOwner } from '../middleware/auth';
import { sendEmail } from '../lib/resend';

// In-app bug reports and change requests from the team. Every new report is
// stored here and emailed to BUG_REPORT_NOTIFY_EMAIL (comma-separated; set it
// empty to disable the email).
export const bugReportsRouter = Router();

const NOTIFY = (process.env.BUG_REPORT_NOTIFY_EMAIL ?? 'info@opnrenovation.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TYPES = ['BUG', 'FEATURE_REQUEST', 'QUESTION'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX'];
// ~3 MB of base64; the client downsizes screenshots before upload.
const MAX_SCREENSHOT_CHARS = 4_000_000;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_LABEL: Record<string, string> = { BUG: 'Bug', FEATURE_REQUEST: 'Change request', QUESTION: 'Question' };

async function notify(report: { id: string; type: string; priority: string; title: string; description: string; page_url: string | null }, reporter: string) {
  if (!NOTIFY.length) return;
  const link = `${(process.env.APP_URL || '').replace(/\/$/, '')}/admin/bug-reports?id=${report.id}`;
  await sendEmail({
    to: NOTIFY,
    subject: `[BrushPro ${TYPE_LABEL[report.type] || 'Report'}] ${report.title}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#111">
        <p><strong>${esc(reporter)}</strong> filed a ${esc((TYPE_LABEL[report.type] || 'report').toLowerCase())} (priority: ${esc(report.priority.toLowerCase())}).</p>
        <h2 style="font-size:17px;margin:16px 0 8px">${esc(report.title)}</h2>
        <p style="white-space:pre-wrap">${esc(report.description)}</p>
        ${report.page_url ? `<p style="color:#555">Page: ${esc(report.page_url)}</p>` : ''}
        <p><a href="${esc(link)}">Open in BrushPro</a></p>
      </div>`,
  });
}

bugReportsRouter.get('/', async (req, res) => {
  try {
    const { status, type, since } = req.query as Record<string, string>;
    const where: Prisma.BugReportWhereInput = {};
    if (status) where.status = { in: status.split(',').filter((s) => STATUSES.includes(s)) as never };
    if (type && TYPES.includes(type)) where.type = type as never;
    if (since) {
      const d = new Date(since);
      if (!isNaN(d.getTime())) where.created_at = { gt: d };
    }
    const reports = await prisma.bugReport.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
      // Screenshots are large; fetch them per report.
      select: {
        id: true, type: true, priority: true, status: true, title: true, description: true,
        page_url: true, resolution_notes: true, resolved_at: true, created_at: true, updated_at: true,
        reporter: { select: { id: true, name: true, email: true } },
        screenshot: false,
      },
    });
    const withShots = await prisma.bugReport.findMany({
      where: { id: { in: reports.map((r) => r.id) }, screenshot: { not: null } },
      select: { id: true },
    });
    const has = new Set(withShots.map((r) => r.id));
    res.json({ data: reports.map((r) => ({ ...r, has_screenshot: has.has(r.id) })) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

bugReportsRouter.get('/:id', async (req, res) => {
  try {
    const report = await prisma.bugReport.findUnique({
      where: { id: req.params.id },
      include: { reporter: { select: { id: true, name: true, email: true } } },
    });
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ data: report });
  } catch {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

bugReportsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, description, page_url, screenshot } = req.body;
    const type = TYPES.includes(req.body.type) ? req.body.type : 'BUG';
    const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'NORMAL';
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Please add a short title and describe what happened' });
      return;
    }
    if (screenshot && (typeof screenshot !== 'string' || !screenshot.startsWith('data:image/') || screenshot.length > MAX_SCREENSHOT_CHARS)) {
      res.status(400).json({ error: 'Screenshot must be an image under about 3 MB' });
      return;
    }
    const report = await prisma.bugReport.create({
      data: {
        type,
        priority,
        title: String(title).trim().slice(0, 200),
        description: String(description).trim(),
        page_url: page_url ? String(page_url).slice(0, 500) : null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
        screenshot: screenshot || null,
        reported_by: req.user?.id,
      },
    });
    notify(report, req.user?.name && req.user.name !== 'Admin' ? req.user.name : req.user?.email || 'Someone')
      .catch((err) => console.error('[bug-reports] notify failed:', err));
    res.status(201).json({ data: { ...report, screenshot: undefined } });
  } catch {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

bugReportsRouter.patch('/:id', async (req, res) => {
  try {
    const data: Prisma.BugReportUpdateInput = {};
    if (req.body.status) {
      if (!STATUSES.includes(req.body.status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      data.status = req.body.status;
      data.resolved_at = ['RESOLVED', 'WONT_FIX'].includes(req.body.status) ? new Date() : null;
    }
    if (req.body.priority && PRIORITIES.includes(req.body.priority)) data.priority = req.body.priority;
    if (req.body.type && TYPES.includes(req.body.type)) data.type = req.body.type;
    if ('resolution_notes' in req.body) data.resolution_notes = req.body.resolution_notes || null;
    if (req.body.title) data.title = String(req.body.title).slice(0, 200);
    if (req.body.description) data.description = String(req.body.description);
    const report = await prisma.bugReport.update({
      where: { id: req.params.id },
      data,
      include: { reporter: { select: { id: true, name: true, email: true } } },
    });
    res.json({ data: { ...report, screenshot: undefined } });
  } catch {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

bugReportsRouter.delete('/:id', requireOwner, async (req, res) => {
  try {
    await prisma.bugReport.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete report' });
  }
});
