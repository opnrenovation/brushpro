import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { uploadCsv } from '../middleware/upload';

export const materialItemsRouter = Router();

materialItemsRouter.get('/', async (req, res) => {
  try {
    const { category, active, search, page = '1', limit = '100' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (active !== undefined) where.is_active = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.materialItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.materialItem.count({ where }),
    ]);

    res.json({ data: items, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

materialItemsRouter.post('/', async (req, res) => {
  try {
    const item = await prisma.materialItem.create({ data: req.body });
    res.status(201).json({ data: item });
  } catch {
    res.status(500).json({ error: 'Failed to create material item' });
  }
});

materialItemsRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const item = await prisma.materialItem.update({ where: { id: req.params.id }, data });
    res.json({ data: item });
  } catch {
    res.status(500).json({ error: 'Failed to update material item' });
  }
});

materialItemsRouter.get('/export', async (_req, res) => {
  try {
    const items = await prisma.materialItem.findMany({ orderBy: { name: 'asc' } });
    const headers = 'name,vendor,category,unit,our_cost,sku,is_active';
    const rows = items.map((i) =>
      `"${i.name}","${i.vendor || ''}","${i.category}","${i.unit}",${i.our_cost},"${i.sku || ''}",${i.is_active}`
    );
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="price-book.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export' });
  }
});

materialItemsRouter.post('/import', uploadCsv.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    let imported = 0;
    let errors = 0;

    for (const row of records) {
      if (!row.name || !row.our_cost) {
        errors++;
        continue;
      }
      try {
        await prisma.materialItem.create({
          data: {
            name: row.name,
            vendor: row.vendor || undefined,
            category: row.category || 'Other',
            unit: row.unit || 'each',
            our_cost: parseFloat(row.our_cost),
            sku: row.sku || undefined,
          },
        });
        imported++;
      } catch {
        errors++;
      }
    }

    res.json({ data: { imported, errors } });
  } catch {
    res.status(500).json({ error: 'Import failed' });
  }
});
