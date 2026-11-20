import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { sendInvoiceOpenedAlert } from '../../lib/sendInvoice';

export const resendWebhookRouter = Router();

// Resend has sent tags as both a name/value array and a flat object; accept either.
type ResendTags = Record<string, string> | Array<{ name: string; value: string }>;

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    click?: { link: string };
    contact?: { email: string };
    tags?: ResendTags;
  };
}

function tagValue(tags: ResendTags | undefined, name: string): string | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.find((t) => t.name === name)?.value;
  return tags[name];
}

resendWebhookRouter.post('/', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString()) as ResendWebhookPayload;
    const { type, data } = payload;

    const emailToEventType: Record<string, string> = {
      'email.sent': 'SENT',
      'email.delivered': 'DELIVERED',
      'email.opened': 'OPENED',
      'email.clicked': 'CLICKED',
      'email.bounced': 'BOUNCED',
      'email.complained': 'COMPLAINED',
    };

    if (emailToEventType[type]) {
      const eventType = emailToEventType[type] as
        | 'SENT'
        | 'DELIVERED'
        | 'OPENED'
        | 'CLICKED'
        | 'BOUNCED'
        | 'UNSUBSCRIBED'
        | 'COMPLAINED';

      // Invoice email (tagged with invoice_id by lib/sendInvoice.ts)
      const invoiceId = tagValue(data.tags, 'invoice_id');
      if (invoiceId) {
        const now = new Date();
        const updateData: Record<string, Date> = {};
        if (type === 'email.delivered') updateData.email_delivered_at = now;
        else if (type === 'email.opened') updateData.email_opened_at = now;
        else if (type === 'email.clicked') updateData.email_clicked_at = now;

        if (Object.keys(updateData).length > 0) {
          await prisma.invoice.updateMany({ where: { id: invoiceId }, data: updateData });
        }

        if (type === 'email.opened') {
          // Claim the alert atomically: repeat opens and duplicate webhook
          // deliveries both lose the race, so exactly one alert goes out per
          // send. sendInvoiceEmail clears open_notified_at on every resend.
          const claim = await prisma.invoice.updateMany({
            where: { id: invoiceId, open_notified_at: null },
            data: { open_notified_at: now },
          });
          if (claim.count > 0) {
            try {
              await sendInvoiceOpenedAlert(invoiceId);
            } catch (alertErr) {
              console.error('Invoice opened alert failed (non-fatal):', alertErr);
              // Release the claim so the next open retries the alert.
              await prisma.invoice.updateMany({
                where: { id: invoiceId },
                data: { open_notified_at: null },
              });
            }
          }
        }

        res.json({ received: true });
        return;
      }

      // Check if this is an estimate email (tagged with estimate_id)
      const estimateId = tagValue(data.tags, 'estimate_id');
      if (estimateId) {
        const now = new Date();
        const updateData: Record<string, Date | null> = {};
        if (type === 'email.delivered') updateData.email_delivered_at = now;
        else if (type === 'email.opened') updateData.email_opened_at = now;
        else if (type === 'email.clicked') updateData.email_clicked_at = now;

        if (Object.keys(updateData).length > 0) {
          await prisma.estimate.updateMany({
            where: { id: estimateId },
            data: updateData,
          });
        }
        res.json({ received: true });
        return;
      }

      const recipientEmail = data.to?.[0];
      if (recipientEmail) {
        const contact = await prisma.contact.findUnique({ where: { email: recipientEmail } });

        // Find campaign by resend message ID if available
        const campaign = data.email_id
          ? await prisma.campaign.findFirst({ where: { resend_broadcast_id: { not: null } } })
          : null;

        if (contact && campaign) {
          await prisma.campaignEvent.create({
            data: {
              campaign_id: campaign.id,
              contact_id: contact.id,
              event_type: eventType,
              resend_msg_id: data.email_id,
              link_url: type === 'email.clicked' ? data.click?.link : undefined,
            },
          });
        }

        // Handle bounce and complaint — mark contact
        if (type === 'email.bounced' || type === 'email.complained') {
          if (contact) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { subscribed: false },
            });
          }
        }
      }
    }

    if (type === 'contact.unsubscribed') {
      const email = data.contact?.email;
      if (email) {
        await prisma.contact.updateMany({
          where: { email },
          data: { subscribed: false },
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Resend webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
