import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /leads
router.get('/', async (req: Request, res: Response) => {
  try {
    const { stage, source, assigned_to } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { deleted_at: null };
    if (stage) where.stage = stage;
    if (source) where.source = source;
    if (assigned_to) where.assigned_to = assigned_to;

    const leads = await prisma.lead.findMany({
      where,
      include: {
        contact: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
        assignee: { select: { id: true, name: true } },
        appointment: { select: { id: true, scheduled_at: true, status: true } },
        estimate: { select: { id: true, estimate_number: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: leads });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /leads
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      contact_id, source, service_needed, project_address,
      message, heard_from, assigned_to, notes,
    } = req.body;

    if (!contact_id) {
      res.status(400).json({ error: 'contact_id required' });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        contact_id,
        source: source || 'MANUAL',
        service_needed,
        project_address,
        message,
        heard_from,
        assigned_to,
        notes,
        stage: 'NEW',
      },
      include: { contact: true },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        user_id: (req as any).user?.id,
        type: 'STAGE_CHANGE',
        description: 'Lead created',
        metadata: { to_stage: 'NEW' },
      },
    });

    res.status(201).json({ data: lead });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// GET /leads/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, deleted_at: null },
      include: {
        contact: true,
        assignee: { select: { id: true, name: true } },
        appointment: { include: { appointment_type: true } },
        estimate: { select: { id: true, estimate_number: true, status: true } },
        job: { select: { id: true, name: true, status: true } },
        activities: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ data: lead });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// PATCH /leads/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, deleted_at: null } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const { stage, lost_reason, notes, assigned_to, appointment_id, estimate_id } = req.body;

    // Stage change requires lost_reason if moving to LOST
    if (stage === 'LOST' && !lost_reason) {
      res.status(400).json({ error: 'lost_reason required when stage is LOST' });
      return;
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(stage && { stage }),
        ...(lost_reason !== undefined && { lost_reason }),
        ...(notes !== undefined && { notes }),
        ...(assigned_to !== undefined && { assigned_to }),
        ...(appointment_id !== undefined && { appointment_id }),
        ...(estimate_id !== undefined && { estimate_id }),
        ...(stage === 'WON' && { converted_at: new Date() }),
      },
      include: { contact: true },
    });

    // Log stage change
    if (stage && stage !== existing.stage) {
      await prisma.leadActivity.create({
        data: {
          lead_id: req.params.id,
          user_id: (req as any).user?.id,
          type: 'STAGE_CHANGE',
          description: `Stage changed from ${existing.stage} to ${stage}`,
          metadata: { from_stage: existing.stage, to_stage: stage, ...(lost_reason && { lost_reason }) },
        },
      });
    }

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// POST /leads/:id/activities
router.post('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { type, description, metadata } = req.body;
    if (!type || !description) {
      res.status(400).json({ error: 'type and description required' });
      return;
    }

    const activity = await prisma.leadActivity.create({
      data: {
        lead_id: req.params.id,
        user_id: (req as any).user?.id,
        type,
        description,
        metadata,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json({ data: activity });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// POST /leads/:id/convert — convert WON lead to job + customer
router.post('/:id/convert', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, deleted_at: null },
      include: { contact: true, estimate: true },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    if (lead.stage !== 'WON') {
      res.status(400).json({ error: 'Lead must be in WON stage to convert' });
      return;
    }

    const { job_name, address, municipality } = req.body;
    const settings = await prisma.companySettings.findFirst();

    // Create customer from contact if not already a customer
    let customer = await prisma.customer.findFirst({ where: { contact_id: lead.contact.id } });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          contact_id: lead.contact.id,
          name: `${lead.contact.first_name} ${lead.contact.last_name}`,
          email: lead.contact.email,
          phone: lead.contact.phone ?? undefined,
          address: address || lead.project_address || '',
        },
      });
      await prisma.contact.update({
        where: { id: lead.contact.id },
        data: { type: 'CUSTOMER' },
      });
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        customer_id: customer.id,
        name: job_name || `${lead.contact.first_name} ${lead.contact.last_name} — ${lead.service_needed || 'Project'}`,
        address: address || lead.project_address || customer.address,
        municipality: municipality || '',
        labor_rate: settings?.default_labor_rate || 45,
        status: 'ESTIMATING',
      },
    });

    // Link lead to job and mark WON
    await prisma.lead.update({
      where: { id: lead.id },
      data: { job_id: job.id, stage: 'WON', converted_at: new Date() },
    });

    await prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        user_id: (req as any).user?.id,
        type: 'SYSTEM',
        description: `Converted to Job #${job.id}`,
      },
    });

    res.status(201).json({ data: { job, customer } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

export default router;
