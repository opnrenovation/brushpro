import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { uploadFile } from '../lib/supabase';
import { uploadReceipt } from '../middleware/upload';
import { v4 as uuidv4 } from 'uuid';

export const expensesRouter = Router();

expensesRouter.get('/', async (req, res) => {
  try {
    const { job_id, category, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (job_id) where.job_id = job_id;
    if (category) where.category = category;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { expense_date: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);
    res.json({ data: expenses, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

expensesRouter.post('/', async (req, res) => {
  try {
    const expense = await prisma.expense.create({ data: req.body });
    res.status(201).json({ data: expense });
  } catch {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

expensesRouter.post('/upload', uploadReceipt.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const ext = req.file.originalname.split('.').pop();
    const path = `receipt-${uuidv4()}.${ext}`;
    const url = await uploadFile(
      process.env.STORAGE_BUCKET_RECEIPTS!,
      path,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ data: { receipt_url: url } });
  } catch {
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});
