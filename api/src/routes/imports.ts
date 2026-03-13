import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { upsertResendContact } from '../lib/resend';
import { uploadCsv } from '../middleware/upload';
import { AuthRequest } from '../middleware/auth';

export const importsRouter = Router();

function parseRecord(record: Record<string, string>, mapping: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const [field, csvCol] of Object.entries(mapping)) {
    if (record[csvCol] !== undefined) result[field] = record[csvCol];
  }
  return result;
}

importsRouter.post('/contacts', uploadCsv.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const mapping = JSON.parse(req.body.mapping || '{}') as Record<string, string>;
    const import_type_value = req.body.import_type || 'PROSPECT';

    const records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const error_log: { row: number; reason: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const mapped = parseRecord(row, mapping);
      const email = (mapped.email as string)?.trim();

      if (!email || !email.includes('@')) {
        errors++;
        error_log.push({ row: i + 2, reason: 'Missing or invalid email' });
        continue;
      }

      try {
        const existing = await prisma.contact.findUnique({ where: { email } });
        if (existing) {
          // Merge tags
          if (mapped.tags && typeof mapped.tags === 'string') {
            const newTags = mapped.tags.split(',').map((t) => t.trim()).filter(Boolean);
            const merged = Array.from(new Set([...existing.tags, ...newTags]));
            await prisma.contact.update({ where: { id: existing.id }, data: { tags: merged } });
          }
          skipped++;
          continue;
        }

        const tags = typeof mapped.tags === 'string'
          ? mapped.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];

        const contact = await prisma.contact.create({
          data: {
            type: import_type_value as 'PROSPECT' | 'CUSTOMER' | 'BOTH',
            first_name: (mapped.first_name as string) || '',
            last_name: (mapped.last_name as string) || '',
            company: (mapped.company as string) || undefined,
            email,
            phone: (mapped.phone as string) || undefined,
            address: (mapped.address as string) || undefined,
            city: (mapped.city as string) || undefined,
            state: (mapped.state as string) || undefined,
            zip: (mapped.zip as string) || undefined,
            notes: (mapped.notes as string) || undefined,
            tags,
            source: 'CSV Import',
            subscribed: true,
          },
        });

        try {
          await upsertResendContact({
            email: contact.email,
            first_name: contact.first_name,
            last_name: contact.last_name,
          });
        } catch {
          // Non-fatal
        }

        imported++;
      } catch {
        errors++;
        error_log.push({ row: i + 2, reason: 'Database error' });
      }
    }

    const csvImport = await prisma.csvImport.create({
      data: {
        import_type: 'CONTACTS',
        filename: req.file.originalname,
        total_rows: records.length,
        imported,
        skipped,
        errors,
        error_log,
        imported_by: req.user!.id,
      },
    });

    res.json({ data: { id: csvImport.id, imported, skipped, errors } });
  } catch {
    res.status(500).json({ error: 'Import failed' });
  }
});

importsRouter.post('/customers', uploadCsv.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const mapping = JSON.parse(req.body.mapping || '{}') as Record<string, string>;

    const records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const error_log: { row: number; reason: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const mapped = parseRecord(row, mapping);

      const name = ((mapped.name as string) || `${mapped.first_name || ''} ${mapped.last_name || ''}`.trim());
      const address = mapped.address as string;

      if (!name || !address) {
        errors++;
        error_log.push({ row: i + 2, reason: 'Missing name or address' });
        continue;
      }

      try {
        const email = (mapped.email as string)?.trim() || undefined;

        // Check if contact with this email already exists
        let existingContact = email ? await prisma.contact.findUnique({ where: { email } }) : null;

        const customer = await prisma.customer.create({
          data: {
            name,
            email,
            phone: (mapped.phone as string) || undefined,
            address,
            contact_id: existingContact?.id || undefined,
          },
        });

        if (!existingContact && email) {
          const [first_name = '', ...rest] = name.split(' ');
          const last_name = rest.join(' ');
          existingContact = await prisma.contact.create({
            data: {
              type: 'CUSTOMER',
              first_name,
              last_name,
              email,
              phone: (mapped.phone as string) || undefined,
              address,
              customer_id: customer.id,
              source: 'CSV Import',
              subscribed: true,
            },
          });
          await prisma.customer.update({
            where: { id: customer.id },
            data: { contact_id: existingContact.id },
          });
        } else if (existingContact) {
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: { type: 'BOTH', customer_id: customer.id },
          });
        }

        imported++;
      } catch {
        errors++;
        error_log.push({ row: i + 2, reason: 'Database error' });
      }
    }

    const csvImport = await prisma.csvImport.create({
      data: {
        import_type: 'CUSTOMERS',
        filename: req.file.originalname,
        total_rows: records.length,
        imported,
        skipped,
        errors,
        error_log,
        imported_by: req.user!.id,
      },
    });

    res.json({ data: { id: csvImport.id, imported, skipped, errors } });
  } catch {
    res.status(500).json({ error: 'Customer import failed' });
  }
});

importsRouter.get('/:id', async (req, res) => {
  try {
    const record = await prisma.csvImport.findUnique({ where: { id: req.params.id } });
    if (!record) {
      res.status(404).json({ error: 'Import not found' });
      return;
    }
    res.json({ data: record });
  } catch {
    res.status(500).json({ error: 'Failed to fetch import' });
  }
});

importsRouter.get('/:id/errors', async (req, res) => {
  try {
    const record = await prisma.csvImport.findUnique({ where: { id: req.params.id } });
    if (!record) {
      res.status(404).json({ error: 'Import not found' });
      return;
    }

    const errorLog = (record.error_log as { row: number; reason: string }[]) || [];
    const csv = ['row,reason', ...errorLog.map((e) => `${e.row},"${e.reason}"`)].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${record.id}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to download error log' });
  }
});
