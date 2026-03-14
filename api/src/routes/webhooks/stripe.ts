import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-02-24.acacia' });

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId && session.amount_total) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { payments: true },
        });
        if (invoice) {
          await prisma.payment.create({
            data: {
              invoice_id: invoiceId,
              amount: session.amount_total / 100,
              method: 'CARD',
              stripe_id: session.id,
              paid_at: new Date(),
            },
          });

          const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number }>;
          const total = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
          const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + session.amount_total / 100;
          const status = totalPaid >= total ? 'PAID' : 'PARTIAL';
          await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        await prisma.payment.upsert({
          where: { id: pi.id },
          create: {
            id: pi.id,
            invoice_id: invoiceId,
            amount: pi.amount_received / 100,
            method: 'CARD',
            stripe_id: pi.id,
            paid_at: new Date(),
          },
          update: {},
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
