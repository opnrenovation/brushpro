import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { upsertResendContact } from '../lib/resend';
import { AuthRequest } from '../middleware/auth';

export const contactsRouter = Router();

contactsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const { type, subscribed, search, tag, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { deleted_at: null };
    if (type) where.type = type;
    if (subscribed !== undefined) where.subscribed = subscribed === 'true';
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { company_rel: { select: { id: true, name: true } } },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ data: contacts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

async function resolveCompanyId(companyName: string | undefined): Promise<string | undefined> {
  if (!companyName?.trim()) return undefined;
  const existing = await prisma.company.findFirst({ where: { name: companyName.trim(), deleted_at: null } });
  if (existing) return existing.id;
  const created = await prisma.company.create({ data: { name: companyName.trim() } });
  return created.id;
}

contactsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const data = { ...req.body };
    if (data.company && !data.company_id) {
      data.company_id = await resolveCompanyId(data.company);
    }
    const contact = await prisma.contact.create({ data });

    if (contact.subscribed) {
      try {
        await upsertResendContact({
          email: contact.email,
          first_name: contact.first_name,
          last_name: contact.last_name,
          unsubscribed: false,
        });
      } catch {
        // Non-fatal: log but don't fail
        console.warn('Resend sync failed for contact', contact.id);
      }
    }

    res.status(201).json({ data: contact });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

contactsRouter.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id }, include: { company_rel: { select: { id: true, name: true } } } });
    if (!contact || contact.deleted_at) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ data: contact });
  } catch {
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

contactsRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_at;

    if (data.company && !data.company_id) {
      data.company_id = await resolveCompanyId(data.company);
    }

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
    });

    // Sync subscription status to Resend
    if (data.subscribed !== undefined) {
      try {
        await upsertResendContact({
          email: contact.email,
          unsubscribed: !contact.subscribed,
        });
      } catch {
        console.warn('Resend sync failed');
      }
    }

    res.json({ data: contact });
  } catch {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

contactsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.contact.update({
      where: { id: req.params.id },
      data: { deleted_at: new Date() },
    });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

contactsRouter.post('/:id/convert', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    if (contact.type !== 'PROSPECT') {
      res.status(400).json({ error: 'Only PROSPECT contacts can be converted' });
      return;
    }

    // Create customer record
    const customer = await prisma.customer.create({
      data: {
        contact_id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email,
        phone: contact.phone ?? undefined,
        address: contact.address ?? '',
        notes: contact.notes ?? undefined,
      },
    });

    // Update contact
    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: { type: 'BOTH' },
    });

    res.json({ data: { contact: updated, customer } });
  } catch {
    res.status(500).json({ error: 'Failed to convert contact' });
  }
});
