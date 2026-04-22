import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-12-18.acacia',
});

export async function createPaymentLink(params: {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
}): Promise<{ url: string; paymentIntentId: string }> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100),
    currency: params.currency.toLowerCase(),
    description: params.description,
    receipt_email: params.customerEmail,
    metadata: { invoiceId: params.invoiceId },
    automatic_payment_methods: { enabled: true },
  });

  return {
    paymentIntentId: paymentIntent.id,
    url: `https://checkout.stripe.com/pay/${paymentIntent.client_secret}`,
  };
}
