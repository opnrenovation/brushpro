import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sendEmail } from '../lib/resend';

const router = Router();

// GET /users — OWNER only
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        is_active: true, must_change_password: true, last_login_at: true, created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
    res.json({ data: users });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /users/invite — OWNER only
router.post('/invite', async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== 'OWNER') {
      res.status(403).json({ error: 'Owner only' });
      return;
    }
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      res.status(400).json({ error: 'name, email, and role required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: { name, email, role, password_hash: hash, must_change_password: true, is_active: true },
    });

    const settings = await prisma.companySettings.findFirst();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    await sendEmail({
      to: email,
      subject: 'You have been invited to BrushPro',
      html: `<p>Hi ${name},</p>
<p>You have been invited to access the BrushPro dashboard for ${settings?.company_name || 'OPN Renovation'}.</p>
<p><strong>Login URL:</strong> <a href="${appUrl}/admin/login">${appUrl}/admin/login</a></p>
<p><strong>Email:</strong> ${email}<br/><strong>Temporary Password:</strong> ${tempPassword}</p>
<p>You will be required to set a new password on first login.</p>
<p>— BrushPro</p>`,
    });

    res.status(201).json({
      data: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        is_active: user.is_active, must_change_password: user.must_change_password,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// PATCH /users/:id — OWNER only
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== 'OWNER') {
      res.status(403).json({ error: 'Owner only' });
      return;
    }
    const { name, role, is_active } = req.body;

    // Guard: cannot deactivate last owner
    if (is_active === false) {
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (target?.role === 'OWNER') {
        const ownerCount = await prisma.user.count({ where: { role: 'OWNER', is_active: true } });
        if (ownerCount <= 1) {
          res.status(409).json({ error: 'Cannot deactivate the last active owner account' });
          return;
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(is_active !== undefined && { is_active }),
      },
      select: {
        id: true, name: true, email: true, role: true, is_active: true,
        must_change_password: true, last_login_at: true,
      },
    });
    res.json({ data: user });
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /users/:id/reset — OWNER only
router.post('/:id/reset', async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== 'OWNER') {
      res.status(403).json({ error: 'Owner only' });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password_hash: hash, must_change_password: true },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await sendEmail({
      to: target.email,
      subject: 'Your BrushPro password has been reset',
      html: `<p>Hi ${target.name},</p>
<p>Your BrushPro password has been reset by an administrator.</p>
<p><strong>Temporary Password:</strong> ${tempPassword}</p>
<p>Please log in at <a href="${appUrl}/admin/login">${appUrl}/admin/login</a> and set a new password.</p>`,
    });

    res.json({ message: 'Password reset email sent' });
  } catch {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
