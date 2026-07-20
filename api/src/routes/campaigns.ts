import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { AuthRequest } from '../middleware/auth';

export const campaignsRouter = Router();

campaignsRouter.get('/', async (req, res) => {
  try {
    const { status, page = '1', limit = '50' } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
      }),
      prisma.campaign.count({ where }),
    ]);
    res.json({ data: campaigns, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

campaignsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.create({
      data: { ...req.body, created_by: req.user!.id, status: 'DRAFT' },
    });
    res.status(201).json({ data: campaign });
  } catch {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

campaignsRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_by;
    const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data });
    res.json({ data: campaign });
  } catch {
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

campaignsRouter.post('/:id/send', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign || campaign.status !== 'DRAFT') {
      res.status(400).json({ error: 'Campaign must be in DRAFT status to send' });
      return;
    }

    // Resolve recipients. With specific lists selected, use their members;
    // with no list chosen, fall back to every subscribed contact.
    let candidateContacts;
    if (campaign.list_ids && campaign.list_ids.length > 0) {
      const members = await prisma.contactListMember.findMany({
        where: { list_id: { in: campaign.list_ids } },
        include: { contact: true },
        distinct: ['contact_id'],
      });
      candidateContacts = members.map((m) => m.contact);
    } else {
      candidateContacts = await prisma.contact.findMany({ where: { subscribed: true, deleted_at: null } });
    }

    const subscribedContacts = candidateContacts.filter((c) => c.subscribed && !c.deleted_at && c.email);

    if (subscribedContacts.length === 0) {
      res.status(400).json({ error: 'No subscribed recipients in the selected list(s).' });
      return;
    }

    // Email ONLY the recipients on the selected lists — one message each — so
    // the campaign never reaches the whole shared audience, and previously
    // unsubscribed contacts are never re-subscribed or contacted.
    let sent = 0;
    const failed: string[] = [];
    for (const contact of subscribedContacts) {
      try {
        await sendEmail({
          to: contact.email,
          subject: campaign.subject,
          html: campaign.html_body,
          tags: [{ name: 'campaign_id', value: campaign.id }],
        });
        sent++;
      } catch (sendErr) {
        console.error(`Campaign ${campaign.id} send failed for ${contact.email}:`, sendErr);
        failed.push(contact.email);
      }
    }

    if (sent === 0) {
      res.status(502).json({ error: 'Failed to send campaign to any recipient.' });
      return;
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENT',
        sent_at: new Date(),
        total_recipients: sent,
      },
    });

    res.json({ data: { sent: true, recipients: sent, failed: failed.length } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});

campaignsRouter.post('/:id/schedule', async (req, res) => {
  try {
    const { scheduled_at } = req.body;
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'SCHEDULED', scheduled_at: new Date(scheduled_at) },
    });
    res.json({ data: campaign });
  } catch {
    res.status(500).json({ error: 'Failed to schedule campaign' });
  }
});

campaignsRouter.post('/:id/cancel', async (req, res) => {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json({ data: campaign });
  } catch {
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

campaignsRouter.post('/:id/test', async (req, res) => {
  try {
    const { email } = req.body;
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    await sendEmail({
      to: email,
      subject: `[TEST] ${campaign.subject}`,
      html: campaign.html_body,
    });

    res.json({ data: { sent: true } });
  } catch {
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

campaignsRouter.get('/:id/analytics', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const events = await prisma.campaignEvent.findMany({
      where: { campaign_id: campaign.id },
      orderBy: { occurred_at: 'asc' },
    });

    const counts = events.reduce(
      (acc, e) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const linkClicks = events
      .filter((e) => e.event_type === 'CLICKED' && e.link_url)
      .reduce(
        (acc, e) => {
          acc[e.link_url!] = (acc[e.link_url!] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const total = campaign.total_recipients || 1;
    const openRate = ((counts.OPENED || 0) / total) * 100;
    const clickRate = ((counts.CLICKED || 0) / total) * 100;

    res.json({
      data: {
        total_sent: total,
        delivered: counts.DELIVERED || 0,
        opened: counts.OPENED || 0,
        clicked: counts.CLICKED || 0,
        bounced: counts.BOUNCED || 0,
        unsubscribed: counts.UNSUBSCRIBED || 0,
        open_rate: Math.round(openRate * 10) / 10,
        click_rate: Math.round(clickRate * 10) / 10,
        link_clicks: linkClicks,
        events_over_time: events,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
