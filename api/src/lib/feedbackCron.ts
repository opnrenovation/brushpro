import cron from 'node-cron';
import prisma from './prisma';
import { sendEmail, COMPANY_BCC } from './resend';

const FOLLOW_UP_DELAY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days after invoice send
const PER_EMAIL_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // don't ask the same client more than once a month
const BATCH_SIZE = 25;

export function startFeedbackCron() {
  // Hourly, at :15 past
  cron.schedule('15 * * * *', () => {
    runFeedbackSweep().catch((e) =>
      console.error('[feedback] sweep failed:', e instanceof Error ? e.message : e),
    );
  });
  console.log('[feedback] follow-up cron scheduled (hourly)');
}

export async function runFeedbackSweep(): Promise<{ sent: number; skipped: number }> {
  const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_MS);

  const invoices = await prisma.invoice.findMany({
    where: {
      sent_at: { not: null, lte: cutoff },
      deleted_at: null,
      feedback_request: null,
    },
    include: { job: { include: { customer: true } }, customer: true },
    orderBy: { sent_at: 'asc' },
    take: BATCH_SIZE,
  });
  if (invoices.length === 0) return { sent: 0, skipped: 0 };

  const settings = await prisma.companySettings.findFirst();
  const companyName = settings?.company_name || 'OPN Renovation';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  let sent = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const recipient = invoice.job?.customer ?? invoice.customer;
    const email = recipient?.email?.trim();

    // No email, or this client was already asked recently: record a skip so the
    // invoice is not rescanned every hour (sent_at stays null).
    if (!email) {
      await prisma.feedbackRequest.create({ data: { invoice_id: invoice.id } });
      skipped++;
      continue;
    }

    const recentAsk = await prisma.feedbackRequest.findFirst({
      where: {
        email,
        sent_at: { not: null },
        created_at: { gte: new Date(Date.now() - PER_EMAIL_COOLDOWN_MS) },
      },
    });
    if (recentAsk) {
      await prisma.feedbackRequest.create({ data: { invoice_id: invoice.id, email } });
      skipped++;
      continue;
    }

    const request = await prisma.feedbackRequest.create({
      data: { invoice_id: invoice.id, email },
    });
    const feedbackUrl = `${appUrl}/feedback/${request.token}`;
    const firstName = (recipient?.name || '').split(' ')[0] || 'there';

    try {
      await sendEmail({
        to: email,
        bcc: COMPANY_BCC,
        subject: `How did we do? — ${companyName}`,
        html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#007AFF;padding:24px 32px;border-radius:12px 12px 0 0">
    <img src="https://www.opnrenovation.com/opn-logo-white.png" alt="${companyName}" width="96" height="96" style="display:block;margin-bottom:10px" />
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">${companyName}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 8px">Hi ${firstName},</p>
    <p style="color:#555;margin:0 0 24px">
      Thank you for trusting our family business with your project. We would love to hear
      how everything went &mdash; it takes less than a minute, and it genuinely helps our
      small crew get better.
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${feedbackUrl}" style="display:inline-block;background:#007AFF;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none">Share Your Feedback</a>
    </div>
    <p style="color:#666;font-size:13px;margin:0">
      If anything was not right, please tell us &mdash; we want the chance to fix it.
    </p>
    <p style="color:#aaa;font-size:12px;margin-top:16px">${companyName}${settings?.phone ? ` · ${settings.phone}` : ''}${settings?.email ? ` · ${settings.email}` : ''}</p>
  </div>
</div>`,
      });
      await prisma.feedbackRequest.update({
        where: { id: request.id },
        data: { sent_at: new Date() },
      });
      sent++;
    } catch (e) {
      console.error(
        `[feedback] email failed for invoice ${invoice.invoice_number}:`,
        e instanceof Error ? e.message : e,
      );
      // Leave sent_at null; delete the record so a later sweep can retry.
      await prisma.feedbackRequest.delete({ where: { id: request.id } }).catch(() => {});
      skipped++;
    }
  }

  console.log(`[feedback] sweep complete: ${sent} sent, ${skipped} skipped`);
  return { sent, skipped };
}
