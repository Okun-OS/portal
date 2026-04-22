import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@okun/db';
import { invoices } from '@okun/db/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-12-18.acacia' });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoiceId;
      if (invoiceId) {
        await db
          .update(invoices)
          .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
          .where(eq(invoices.id, invoiceId));
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoiceId;
      if (invoiceId) {
        await db
          .update(invoices)
          .set({ status: 'overdue', updatedAt: new Date() })
          .where(eq(invoices.id, invoiceId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
