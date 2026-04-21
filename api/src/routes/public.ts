import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendEmail } from '../lib/resend';

const router = Router();

// POST /api/public/leads — website quote form submission
router.post('/leads', async (req: Request, res: Response) => {
  try {
    const {
      first_name, last_name, email, phone,
      service_needed, project_address, message, heard_from,
    } = req.body;

    if (!first_name || !last_name || !email || !phone) {
      res.status(400).json({ error: 'first_name, last_name, email, and phone are required' });
      return;
    }

    // Upsert contact
    let contact = await prisma.contact.findFirst({ where: { email } });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          first_name,
          last_name,
          email,
          phone,
          type: 'PROSPECT',
          source: 'Website Form',
          subscribed: true,
        },
      });
    } else {
      // Update phone if changed
      if (phone && !contact.phone) {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: { phone },
        });
      }
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        contact_id: contact.id,
        source: 'WEBSITE_FORM',
        service_needed,
        project_address,
        message,
        heard_from,
        stage: 'NEW',
      },
    });

    const settings = await prisma.companySettings.findFirst();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Auto-reply to prospect
    await sendEmail({
      to: email,
      subject: `Thanks for reaching out, ${first_name}!`,
      html: `<p>Hi ${first_name},</p>
<p>Thanks for reaching out to ${settings?.company_name || 'OPN Renovation'}! We received your request for ${service_needed || 'painting services'} and will be in touch within 1 business day.</p>
<p>In the meantime, you can book a free estimate walk-through directly: <a href="${appUrl}/book">${appUrl}/book</a></p>
<p>— ${settings?.company_name || 'OPN Renovation'} Team</p>`,
    });

    // Owner notification
    if (settings?.email) {
      await sendEmail({
        to: settings.email,
        subject: `New lead from ${first_name} ${last_name} — ${service_needed || 'General'}`,
        html: `<p><strong>New lead submitted via website.</strong></p>
<p><strong>Name:</strong> ${first_name} ${last_name}<br/>
<strong>Email:</strong> ${email}<br/>
<strong>Phone:</strong> ${phone}<br/>
<strong>Service:</strong> ${service_needed || 'Not specified'}<br/>
<strong>Address:</strong> ${project_address || 'Not provided'}<br/>
<strong>Message:</strong> ${message || 'None'}<br/>
<strong>Heard from:</strong> ${heard_from || 'Not specified'}</p>
<p><a href="${appUrl}/admin/leads/${lead.id}">View Lead in Dashboard</a></p>`,
      });
    }

    res.status(201).json({ message: 'Lead submitted successfully', lead_id: lead.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit lead' });
  }
});

// GET /api/public/appointment-types
router.get('/appointment-types', async (_req: Request, res: Response) => {
  try {
    const types = await prisma.appointmentType.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, duration_minutes: true },
    });
    res.json({ data: types });
  } catch {
    res.status(500).json({ error: 'Failed to fetch appointment types' });
  }
});

// GET /api/public/availability?date=YYYY-MM-DD&type_id=xxx
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const { date, type_id } = req.query as { date: string; type_id: string };
    if (!date || !type_id) {
      res.status(400).json({ error: 'date and type_id required' });
      return;
    }

    const apptType = await prisma.appointmentType.findUnique({ where: { id: type_id } });
    if (!apptType) {
      res.status(404).json({ error: 'Appointment type not found' });
      return;
    }

    const settings = await prisma.schedulerSettings.findFirst();
    const bufferMinutes = settings?.buffer_minutes ?? 30;
    const duration = apptType.duration_minutes;

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get availability rule for this day
    const rule = await prisma.availabilityRule.findFirst({
      where: { day_of_week: dayOfWeek, is_active: true },
    });

    if (!rule) {
      res.json({ data: [] });
      return;
    }

    // Generate slots
    const [startH, startM] = rule.start_time.split(':').map(Number);
    const [endH, endM] = rule.end_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const slots: string[] = [];
    for (let m = startMinutes; m + duration <= endMinutes; m += duration + bufferMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }

    // Filter out already booked slots
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findMany({
      where: {
        scheduled_at: { gte: dayStart, lte: dayEnd },
        status: { not: 'CANCELLED' },
      },
    });

    const bookedSlots = new Set(
      existing.map((a) => {
        const d = new Date(a.scheduled_at);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })
    );

    const available = slots.filter((s) => !bookedSlots.has(s));
    res.json({ data: available });
  } catch {
    res.status(500).json({ error: 'Failed to compute availability' });
  }
});

// POST /api/public/appointments — book an appointment
router.post('/appointments', async (req: Request, res: Response) => {
  try {
    const {
      appointment_type_id, first_name, last_name, email, phone,
      notes, date, time, lead_id,
    } = req.body;

    if (!appointment_type_id || !first_name || !last_name || !email || !phone || !date || !time) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const apptType = await prisma.appointmentType.findUnique({ where: { id: appointment_type_id } });
    if (!apptType) {
      res.status(404).json({ error: 'Appointment type not found' });
      return;
    }

    const [h, m] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(h, m, 0, 0);

    const appt = await prisma.appointment.create({
      data: {
        appointment_type_id,
        first_name,
        last_name,
        email,
        phone,
        notes,
        scheduled_at: scheduledAt,
        duration_minutes: apptType.duration_minutes,
        status: 'SCHEDULED',
        ...(lead_id && { lead_id }),
      },
      include: { appointment_type: true },
    });

    // Link appointment to lead if provided
    if (lead_id) {
      await prisma.lead.update({
        where: { id: lead_id },
        data: { appointment_id: appt.id, stage: 'APPOINTMENT' },
      });
    }

    const settings = await prisma.companySettings.findFirst();
    const schedulerSettings = await prisma.schedulerSettings.findFirst();
    const formattedDate = scheduledAt.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const formattedTime = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Confirmation email to booker
    await sendEmail({
      to: email,
      subject: `Appointment Confirmed — ${apptType.name}`,
      html: `${schedulerSettings?.confirmation_email_body ? `<p>${schedulerSettings.confirmation_email_body}</p>` : ''}
<p>Hi ${first_name},</p>
<p>Your appointment has been confirmed!</p>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Type:</td><td><strong>${apptType.name}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Date:</td><td><strong>${formattedDate}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Time:</td><td><strong>${formattedTime}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Duration:</td><td><strong>${apptType.duration_minutes} minutes</strong></td></tr>
</table>
${notes ? `<p><strong>Your notes:</strong> ${notes}</p>` : ''}
<p>— ${settings?.company_name || 'OPN Renovation'} Team</p>`,
    });

    res.status(201).json({ data: appt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// GET /api/public/invoices/:id — view invoice without auth
router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        job: { include: { customer: true } },
        customer: true,
        tax_profile: true,
        payments: true,
      },
    });
    if (!invoice || invoice.deleted_at) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const settings = await prisma.companySettings.findFirst();
    res.json({ data: invoice, settings: { company_name: settings?.company_name, email: settings?.email, phone: settings?.phone, website: settings?.website } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/public/invoices/:id/stripe-link — create Stripe checkout (no auth)
router.post('/invoices/:id/stripe-link', async (req: Request, res: Response) => {
  try {
    const Stripe = (await import('stripe')).default;
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(503).json({ error: 'Online payments are not configured.' });
      return;
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { job: { include: { customer: true } }, tax_profile: true, payments: true },
    });
    if (!invoice || invoice.deleted_at) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const lineItems = invoice.line_items as Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
    const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxable = lineItems.filter(li => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const tax = taxable * (Number(invoice.tax_profile.state_rate) + Number(invoice.tax_profile.local_rate));
    const total = subtotal + tax;
    const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const amountDue = Math.round((total - alreadyPaid) * 100);

    if (amountDue <= 0) {
      res.status(400).json({ error: 'Invoice is already paid.' });
      return;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountDue,
          product_data: { name: `Invoice ${invoice.invoice_number}` },
        },
        quantity: 1,
      }],
      metadata: { invoice_id: invoice.id },
      success_url: `${appUrl}/invoices/${invoice.id}?paid=true`,
      cancel_url: `${appUrl}/invoices/${invoice.id}`,
    });

    res.json({ data: { url: session.url } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('stripe-link error:', msg);
    res.status(500).json({ error: 'Failed to create payment link', detail: msg });
  }
});

export default router;
