import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const companiesRouter = Router();

// List companies
companiesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { deleted_at: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
        include: { contacts: { where: { deleted_at: null }, select: { id: true, first_name: true, last_name: true, email: true, phone: true } } },
      }),
      prisma.company.count({ where }),
    ]);

    res.json({ data: companies, total, page: parseInt(page), limit: parseInt(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company
companiesRouter.get('/:id', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: { contacts: { where: { deleted_at: null } } },
    });
    if (!company || company.deleted_at) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json({ data: company });
  } catch {
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company
companiesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, address, city, state, zip, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }
    const company = await prisma.company.create({ data: { name, phone, email, address, city, state, zip, notes } });
    res.status(201).json({ data: company });
  } catch {
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
companiesRouter.patch('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, city, state, zip, notes } = req.body;
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { name, phone, email, address, city, state, zip, notes },
    });
    res.json({ data: company });
  } catch {
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company (soft)
companiesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.company.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete company' });
  }
});
