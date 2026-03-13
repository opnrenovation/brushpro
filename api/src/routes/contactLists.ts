import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const contactListsRouter = Router();

contactListsRouter.get('/', async (_req, res) => {
  try {
    const lists = await prisma.contactList.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { created_at: 'desc' },
    });

    const data = await Promise.all(
      lists.map(async (list) => {
        const subscribedCount = await prisma.contactListMember.count({
          where: {
            list_id: list.id,
            contact: { subscribed: true, deleted_at: null },
          },
        });
        return {
          ...list,
          member_count: list._count.members,
          subscribed_count: subscribedCount,
        };
      })
    );

    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch contact lists' });
  }
});

contactListsRouter.post('/', async (req, res) => {
  try {
    const list = await prisma.contactList.create({ data: req.body });
    res.status(201).json({ data: list });
  } catch {
    res.status(500).json({ error: 'Failed to create contact list' });
  }
});

contactListsRouter.patch('/:id', async (req, res) => {
  try {
    const list = await prisma.contactList.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ data: list });
  } catch {
    res.status(500).json({ error: 'Failed to update contact list' });
  }
});

contactListsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.contactList.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete contact list' });
  }
});

contactListsRouter.post('/:id/members', async (req, res) => {
  try {
    const { contact_ids } = req.body as { contact_ids: string[] };
    const data = contact_ids.map((contact_id) => ({
      list_id: req.params.id,
      contact_id,
    }));

    // Upsert (skip duplicates)
    await prisma.contactListMember.createMany({ data, skipDuplicates: true });
    res.json({ data: { added: contact_ids.length } });
  } catch {
    res.status(500).json({ error: 'Failed to add members' });
  }
});

contactListsRouter.delete('/:id/members', async (req, res) => {
  try {
    const { contact_ids } = req.body as { contact_ids: string[] };
    await prisma.contactListMember.deleteMany({
      where: { list_id: req.params.id, contact_id: { in: contact_ids } },
    });
    res.json({ data: { removed: contact_ids.length } });
  } catch {
    res.status(500).json({ error: 'Failed to remove members' });
  }
});
