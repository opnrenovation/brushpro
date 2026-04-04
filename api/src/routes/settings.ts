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
    const data = req.body;
    delete data.id;

    if (settings) {
      const updated = await prisma.companySettings.update({
        where: { id: settings.id },
        data,
      });
      res.json({ data: updated });
    } else {
      const created = await prisma.companySettings.create({ data });
      res.json({ data: created });
    }
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

settingsRouter.post('/logo', uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const ext = req.file.originalname.split('.').pop();
    const path = `logo-${uuidv4()}.${ext}`;
    const url = await uploadFile(
      process.env.STORAGE_BUCKET_BRANDING!,
      path,
      req.file.buffer,
      req.file.mimetype
    );

    // Update settings
    const settings = await prisma.companySettings.findFirst();
    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { logo_url: url },
      });
    }

    res.json({ data: { logo_url: url } });
  } catch {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});
