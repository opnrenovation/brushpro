import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { resend, sendEmail, upsertResendContact } from '../lib/resend';
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

    // Get all contacts from the campaign lists
    const members = await prisma.contactListMember.findMany({
      where: { list_id: { in: campaign.list_ids } },
      include: { contact: true },
      distinct: ['contact_id'],
    });

    const subscribedContacts = members
      .map((m) => m.contact)
      .filter((c) => c.subscribed && !c.deleted_at && c.email);

    // Sync contacts to Resend audience
    for (const contact of subscribedContacts) {
      await upsertResendContact({
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        unsubscribed: false,
      }).catch(() => {});
    }

    const settings = await prisma.companySettings.findFirst();

    // Use Resend Broadcasts API
    const { data: broadcast, error } = await (resend.broadcasts as unknown as {
      create: (params: object) => Promise<{ data: { id: string } | null; error: Error | null }>;
    }).create({
      audienceId: process.env.RESEND_AUDIENCE_ID,
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      subject: campaign.subject,
      html: campaign.html_body,
      name: campaign.name,
    });

    if (error || !broadcast) {
      throw new Error('Resend broadcast failed');
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENT',
        sent_at: new Date(),
        total_recipients: subscribedContacts.length,
        resend_broadcast_id: broadcast.id,
      },
    });

    res.json({ data: { sent: true, recipients: subscribedContacts.length } });
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
