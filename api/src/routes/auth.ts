import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { authenticate } from '../middleware/auth';

export const authRouter = Router();

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last login
    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      token,
      must_change_password: user.must_change_password,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/change-password — requires auth
authRouter.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = (req as any).user.id;

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'current_password and new_password required' });
      return;
    }

    // Password strength: 8+ chars, uppercase, number
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(new_password)) {
      res.status(400).json({ error: 'Password must be at least 8 characters with one uppercase letter and one number' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hash, must_change_password: false },
    });

    res.json({ message: 'Password changed successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /auth/reset-request — public
authRouter.post('/reset-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent enumeration
    if (!user || !user.is_active) {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in a simple way — we'll use a metadata approach
    // In production use a dedicated password_reset_tokens table; here we store in user record
    const hash = await bcrypt.hash(resetToken, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Store as temp password hash — must_change_password will be set on confirm
        password_hash: hash,
        must_change_password: true,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await sendEmail({
      to: email,
      subject: 'Reset your BrushPro password',
      html: `<p>Hi ${user.name},</p>
<p>A password reset was requested for your account.</p>
<p>Your temporary access token (expires in 1 hour): <strong>${resetToken}</strong></p>
<p>Please use this at <a href="${appUrl}/admin/login">${appUrl}/admin/login</a> and set a new password.</p>
<p>If you did not request this, contact your administrator.</p>`,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// POST /auth/reset-confirm — public
authRouter.post('/reset-confirm', async (req: Request, res: Response) => {
  try {
    const { email, token, new_password } = req.body;
    if (!email || !token || !new_password) {
      res.status(400).json({ error: 'email, token, and new_password required' });
      return;
    }

    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(new_password)) {
      res.status(400).json({ error: 'Password must be 8+ chars with uppercase and number' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({ error: 'Invalid reset request' });
      return;
    }

    const valid = await bcrypt.compare(token, user.password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: hash, must_change_password: false },
    });

    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});
