import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const vendorsRouter = Router();

vendorsRouter.get('/', async (req, res) => {
  try {
    const { category, search } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { deleted_at: null };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contact_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const vendors = await prisma.vendor.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ data: vendors });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

vendorsRouter.post('/', async (req, res) => {
  try {
    const vendor = await prisma.vendor.create({ data: req.body });
    res.status(201).json({ data: vendor });
  } catch {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

vendorsRouter.get('/:id', async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor || vendor.deleted_at) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }
    res.json({ data: vendor });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

vendorsRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_at;
    const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data });
    res.json({ data: vendor });
  } catch {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

vendorsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.vendor.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});
