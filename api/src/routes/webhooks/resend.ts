import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const resendWebhookRouter = Router();

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    click?: { link: string };
    contact?: { email: string };
    tags?: Record<string, string>;
  };
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

      // Check if this is an estimate email (tagged with estimate_id)
      const estimateId = data.tags?.estimate_id;
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
