import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { uploadFile } from '../lib/supabase';
import { uploadLogo } from '../middleware/upload';
import { v4 as uuidv4 } from 'uuid';

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  try {
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: { company_name: 'My Company' },
      });
    }
    res.json({ data: settings });
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

settingsRouter.patch('/', async (req, res) => {
  try {
    const settings = await prisma.companySettings.findFirst();

    // Strip auto-managed / non-updatable fields
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      ...raw
    } = req.body as Record<string, unknown>;

    // Coerce fields that Prisma requires as specific types
    const data: Record<string, unknown> = { ...raw };
    const intFields = [
      'next_invoice_number',
      'next_estimate_number',
      'payment_terms_days',
      'estimate_expiry_days',
    ];
    for (const f of intFields) {
      if (data[f] !== undefined && data[f] !== null && data[f] !== '') {
        const parsed = parseInt(String(data[f]), 10);
        data[f] = isNaN(parsed) ? undefined : parsed;
      } else if (data[f] === '' || data[f] === null) {
        delete data[f]; // let the DB default stand
      }
    }
    const decimalFields = [
      'deposit_percentage',
      'deposit_minimum_amount',
      'default_labor_rate',
    ];
    for (const f of decimalFields) {
      if (data[f] !== undefined && data[f] !== null && data[f] !== '') {
        const parsed = parseFloat(String(data[f]));
        data[f] = isNaN(parsed) ? undefined : parsed;
      } else if (data[f] === '' || data[f] === null) {
        delete data[f];
      }
    }
    if (data['deposit_required'] !== undefined) {
      data['deposit_required'] = data['deposit_required'] === true || data['deposit_required'] === 'true';
    }

    if (settings) {
      const updated = await prisma.companySettings.update({
        where: { id: settings.id },
        data,
      });
      res.json({ data: updated });
    } else {
      const created = await prisma.companySettings.create({ data: data as Parameters<typeof prisma.companySettings.create>[0]['data'] });
      res.json({ data: created });
    }
  } catch (err) {
    console.error('[PATCH /settings]', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

settingsRouter.post('/logo', uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const bucket = process.env.STORAGE_BUCKET_BRANDING;
    if (!bucket) {
      res.status(500).json({ error: 'STORAGE_BUCKET_BRANDING environment variable is not set' });
      return;
    }

    const ext = req.file.originalname.split('.').pop();
    const path = `logo-${uuidv4()}.${ext}`;
    const url = await uploadFile(bucket, path, req.file.buffer, req.file.mimetype);

    let settings = await prisma.companySettings.findFirst();
    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { logo_url: url },
      });
    } else {
      settings = await prisma.companySettings.create({
        data: { company_name: 'OPN Renovation', logo_url: url },
      });
    }

    res.json({ data: { logo_url: url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[logo upload]', message);
    res.status(500).json({ error: message });
  }
});
