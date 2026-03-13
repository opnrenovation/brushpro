import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const laborRouter = Router();

laborRouter.get('/', async (req, res) => {
  try {
    const { job_id, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (job_id) where.job_id = job_id;

    const [entries, total] = await Promise.all([
      prisma.laborEntry.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { work_date: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.laborEntry.count({ where }),
    ]);
    res.json({ data: entries, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch labor entries' });
  }
});

laborRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.body.job_id } });
    const entry = await prisma.laborEntry.create({
      data: {
        ...req.body,
        user_id: req.body.user_id || req.user!.id,
        rate: req.body.rate || Number(job?.labor_rate) || 0,
      },
    });
    res.status(201).json({ data: entry });
  } catch {
    res.status(500).json({ error: 'Failed to create labor entry' });
  }
});
