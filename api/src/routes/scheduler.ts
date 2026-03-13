import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ─── Scheduler Settings ────────────────────────────────────────────────────

// GET /scheduler/settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.schedulerSettings.findFirst();
    if (!settings) {
      settings = await prisma.schedulerSettings.create({
        data: { buffer_minutes: 30, min_notice_hours: 24, booking_window_days: 60, reminder_hours_before: 24 },
      });
    }
    res.json({ data: settings });
  } catch {
    res.status(500).json({ error: 'Failed to fetch scheduler settings' });
  }
});

// PATCH /scheduler/settings
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const { buffer_minutes, min_notice_hours, booking_window_days, reminder_hours_before, confirmation_email_body } = req.body;
    let settings = await prisma.schedulerSettings.findFirst();
    if (!settings) {
      settings = await prisma.schedulerSettings.create({ data: {} });
    }
    const updated = await prisma.schedulerSettings.update({
      where: { id: settings.id },
      data: {
        ...(buffer_minutes !== undefined && { buffer_minutes }),
        ...(min_notice_hours !== undefined && { min_notice_hours }),
        ...(booking_window_days !== undefined && { booking_window_days }),
        ...(reminder_hours_before !== undefined && { reminder_hours_before }),
        ...(confirmation_email_body !== undefined && { confirmation_email_body }),
      },
    });
    res.json({ data: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update scheduler settings' });
  }
});

// ─── Availability Rules ────────────────────────────────────────────────────

// GET /scheduler/availability-rules
router.get('/availability-rules', async (_req: Request, res: Response) => {
  try {
    const rules = await prisma.availabilityRule.findMany({ orderBy: { day_of_week: 'asc' } });
    res.json({ data: rules });
  } catch {
    res.status(500).json({ error: 'Failed to fetch availability rules' });
  }
});

// POST /scheduler/availability-rules
router.post('/availability-rules', async (req: Request, res: Response) => {
  try {
    const { day_of_week, start_time, end_time } = req.body;
    if (day_of_week === undefined || !start_time || !end_time) {
      res.status(400).json({ error: 'day_of_week, start_time, end_time required' });
      return;
    }
    const rule = await prisma.availabilityRule.create({
      data: { day_of_week, start_time, end_time, is_active: true },
    });
    res.status(201).json({ data: rule });
  } catch {
    res.status(500).json({ error: 'Failed to create availability rule' });
  }
});

// PATCH /scheduler/availability-rules/:id
router.patch('/availability-rules/:id', async (req: Request, res: Response) => {
  try {
    const { day_of_week, start_time, end_time, is_active } = req.body;
    const rule = await prisma.availabilityRule.update({
      where: { id: req.params.id },
      data: {
        ...(day_of_week !== undefined && { day_of_week }),
        ...(start_time !== undefined && { start_time }),
        ...(end_time !== undefined && { end_time }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    res.json({ data: rule });
  } catch {
    res.status(500).json({ error: 'Failed to update availability rule' });
  }
});

// DELETE /scheduler/availability-rules/:id
router.delete('/availability-rules/:id', async (req: Request, res: Response) => {
  try {
    await prisma.availabilityRule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete availability rule' });
  }
});

// ─── Appointment Types ─────────────────────────────────────────────────────

// GET /appointment-types
router.get('/appointment-types', async (_req: Request, res: Response) => {
  try {
    const types = await prisma.appointmentType.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: types });
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointment types' });
  }
});

// POST /appointment-types
router.post('/appointment-types', async (req: Request, res: Response) => {
  try {
    const { name, description, duration_minutes } = req.body;
    if (!name || !duration_minutes) {
      res.status(400).json({ error: 'name and duration_minutes required' });
      return;
    }
    const type = await prisma.appointmentType.create({
      data: { name, description, duration_minutes, is_active: true },
    });
    res.status(201).json({ data: type });
  } catch {
    res.status(500).json({ error: 'Failed to create appointment type' });
  }
});

// PATCH /appointment-types/:id
router.patch('/appointment-types/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, duration_minutes, is_active } = req.body;
    const type = await prisma.appointmentType.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(duration_minutes !== undefined && { duration_minutes }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    res.json({ data: type });
  } catch {
    res.status(500).json({ error: 'Failed to update appointment type' });
  }
});

// ─── Admin Appointments ────────────────────────────────────────────────────

// GET /appointments
router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { status, from, to } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (from || to) {
      where.scheduled_at = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }
    const appointments = await prisma.appointment.findMany({
      where,
      include: { appointment_type: true },
      orderBy: { scheduled_at: 'asc' },
    });
    res.json({ data: appointments });
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST /appointments (manual booking by admin)
router.post('/appointments', async (req: Request, res: Response) => {
  try {
    const {
      appointment_type_id, lead_id, contact_id,
      first_name, last_name, email, phone,
      notes, scheduled_at, duration_minutes,
    } = req.body;

    if (!appointment_type_id || !first_name || !last_name || !email || !phone || !scheduled_at) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const appt = await prisma.appointment.create({
      data: {
        appointment_type_id,
        lead_id,
        contact_id,
        first_name,
        last_name,
        email,
        phone,
        notes,
        scheduled_at: new Date(scheduled_at),
        duration_minutes: duration_minutes || 30,
        status: 'SCHEDULED',
      },
      include: { appointment_type: true },
    });
    res.status(201).json({ data: appt });
  } catch {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PATCH /appointments/:id
router.patch('/appointments/:id', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(status === 'CANCELLED' && { cancelled_at: new Date() }),
      },
    });
    res.json({ data: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

export default router;
