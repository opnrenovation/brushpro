import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { uploadFile } from '../lib/supabase';
import { uploadLogo } from '../middleware/upload';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

export const emailTemplatesRouter = Router();

emailTemplatesRouter.get('/', async (_req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        name: true,
        subject: true,
        preview_text: true,
        thumbnail_url: true,
        created_by: true,
        updated_at: true,
        created_at: true,
      },
    });
    res.json({ data: templates });
  } catch {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

emailTemplatesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const template = await prisma.emailTemplate.create({
      data: { ...req.body, created_by: req.user!.id },
    });

    // Generate thumbnail async (non-blocking)
    generateThumbnail(template.id, template.html_body).catch(console.error);

    res.status(201).json({ data: template });
  } catch {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

emailTemplatesRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_by;
    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data,
    });
    if (data.html_body) {
      generateThumbnail(template.id, template.html_body).catch(console.error);
    }
    res.json({ data: template });
  } catch {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

emailTemplatesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

emailTemplatesRouter.post('/upload-image', uploadLogo.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const ext = req.file.originalname.split('.').pop();
    const path = `email-${uuidv4()}.${ext}`;
    const url = await uploadFile(
      process.env.STORAGE_BUCKET_EMAIL_ASSETS!,
      path,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ data: { url } });
  } catch {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

async function generateThumbnail(templateId: string, html: string) {
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 800 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const screenshot = await page.screenshot({ type: 'png' }) as Buffer;
    await browser.close();

    const path = `thumb-${templateId}.png`;
    const url = await uploadFile(
      process.env.STORAGE_BUCKET_EMAIL_ASSETS!,
      path,
      screenshot,
      'image/png'
    );

    await prisma.emailTemplate.update({
      where: { id: templateId },
      data: { thumbnail_url: url },
    });
  } catch (err) {
    console.warn('Thumbnail generation failed:', err);
  }
}
