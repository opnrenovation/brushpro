import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const taxProfilesRouter = Router();

taxProfilesRouter.get('/', async (_req, res) => {
  try {
    const profiles = await prisma.taxProfile.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: profiles });
  } catch {
    res.status(500).json({ error: 'Failed to fetch tax profiles' });
  }
});

taxProfilesRouter.post('/', async (req, res) => {
  try {
    // If new default, unset others
    if (req.body.is_default) {
      await prisma.taxProfile.updateMany({ data: { is_default: false } });
    }
    const profile = await prisma.taxProfile.create({ data: req.body });
    res.status(201).json({ data: profile });
  } catch {
    res.status(500).json({ error: 'Failed to create tax profile' });
  }
});

taxProfilesRouter.patch('/:id', async (req, res) => {
  try {
    if (req.body.is_default) {
      await prisma.taxProfile.updateMany({
        where: { id: { not: req.params.id } },
        data: { is_default: false },
      });
    }
    const profile = await prisma.taxProfile.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ data: profile });
  } catch {
    res.status(500).json({ error: 'Failed to update tax profile' });
  }
});

taxProfilesRouter.delete('/:id', async (req, res) => {
  try {
    // Check for references
    const estimateCount = await prisma.estimate.count({ where: { tax_profile_id: req.params.id } });
    const invoiceCount = await prisma.invoice.count({ where: { tax_profile_id: req.params.id } });
    if (estimateCount + invoiceCount > 0) {
      res.status(409).json({ error: 'Tax profile is referenced by existing estimates or invoices' });
      return;
    }
    await prisma.taxProfile.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete tax profile' });
  }
});
