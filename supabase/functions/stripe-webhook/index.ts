// Supabase Edge Function: stripe-webhook
// Configure Stripe to POST to:
// https://<project-ref>.supabase.co/functions/v1/stripe-webhook

import Stripe from 'npm:stripe@17.7.0'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

if (!stripeSecretKey || !webhookSecret) {
  throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured')
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  try {
    const payload = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    )

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed':
        console.log(`Stripe event received: ${event.type}`)
        break
      default:
        console.log(`Stripe event ignored: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error)
    return new Response('Invalid webhook signature', { status: 400 })
  }
})