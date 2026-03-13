import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const customersRouter = Router();

customersRouter.get('/', async (req, res) => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { deleted_at: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { jobs: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ data: customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

customersRouter.post('/', async (req, res) => {
  try {
    const customer = await prisma.customer.create({ data: req.body });
    res.status(201).json({ data: customer });
  } catch {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

customersRouter.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { jobs: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } } },
    });
    if (!customer || customer.deleted_at) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ data: customer });
  } catch {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

customersRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ data: customer });
  } catch {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});
