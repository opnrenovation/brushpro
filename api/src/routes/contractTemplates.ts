import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /contract-templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.contractTemplate.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: templates });
  } catch {
    res.status(500).json({ error: 'Failed to fetch contract templates' });
  }
});

// POST /contract-templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name, description, body_text,
      requires_initials, signature_label, company_sig_label, is_default,
    } = req.body;

    if (!name || !body_text) {
      res.status(400).json({ error: 'name and body_text required' });
      return;
    }

    // If setting as default, unset others
    if (is_default) {
      await prisma.contractTemplate.updateMany({ where: { is_default: true }, data: { is_default: false } });
    }

    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        body_text,
        requires_initials: requires_initials ?? false,
        signature_label: signature_label || 'Customer Signature',
        company_sig_label,
        is_default: is_default ?? false,
      },
    });
    res.status(201).json({ data: template });
  } catch {
    res.status(500).json({ error: 'Failed to create contract template' });
  }
});

// PATCH /contract-templates/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const {
      name, description, body_text,
      requires_initials, signature_label, company_sig_label, is_default,
    } = req.body;

    if (is_default) {
      await prisma.contractTemplate.updateMany({ where: { is_default: true }, data: { is_default: false } });
    }

    const template = await prisma.contractTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(body_text !== undefined && { body_text }),
        ...(requires_initials !== undefined && { requires_initials }),
        ...(signature_label !== undefined && { signature_label }),
        ...(company_sig_label !== undefined && { company_sig_label }),
        ...(is_default !== undefined && { is_default }),
      },
    });
    res.json({ data: template });
  } catch {
    res.status(500).json({ error: 'Failed to update contract template' });
  }
});

// DELETE /contract-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Check if any active estimate references this template
    const usedCount = await prisma.estimate.count({
      where: {
        contract_template_id: req.params.id,
        deleted_at: null,
        status: { in: ['DRAFT', 'SENT', 'APPROVED'] },
      },
    });
    if (usedCount > 0) {
      res.status(409).json({ error: 'Template is in use by active estimates' });
      return;
    }
    await prisma.contractTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete contract template' });
  }
});

// POST /contract-templates/:id/preview — render with sample data
router.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const template = await prisma.contractTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    const settings = await prisma.companySettings.findFirst();

    const sampleData: Record<string, string> = {
      customer_name: 'Jane Sample',
      customer_email: 'jane@example.com',
      customer_phone: '(515) 555-0100',
      job_address: '1234 Main St, Des Moines, IA 50309',
      municipality: 'Des Moines',
      estimate_number: 'EST-0042',
      total_price: '$4,200',
      deposit_amount: '$1,260',
      company_name: settings?.company_name || 'OPN Renovation',
      company_phone: settings?.phone || '',
      company_email: settings?.email || '',
      company_license: settings?.license_number || '',
      date: new Date().toLocaleDateString('en-US'),
      start_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-US'),
      payment_terms: `${settings?.payment_terms_days ?? 7} days`,
    };

    let html = template.body_text;
    for (const [key, val] of Object.entries(sampleData)) {
      html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    res.json({ html });
  } catch {
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

export default router;
