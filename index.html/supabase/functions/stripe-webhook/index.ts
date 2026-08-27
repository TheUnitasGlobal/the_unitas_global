// Supabase Edge Function: stripe-webhook
// Configure Stripe to POST to:
// https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//
// Verifies the Stripe signature, then routes events to one of two paths:
//   - mode: 'payment' checkout.session.completed -> credits public.wallets
//     via the credit_coins RPC. This is the ACTIVE coin-core purchase path.
//   - mode: 'subscription' events -> mirrors state into public.subscriptions.
//     DEPRECATED: subscriptions no longer gate module access (see
//     create-checkout-session/index.ts). Left wired so the table doesn't go
//     stale if it's ever reused for a future auto-refill subscription tier.
// Uses the platform-injected SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) for
// both paths.

import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

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

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  overrides: { userId?: string; module?: string } = {},
) {
  const userId = overrides.userId ?? subscription.metadata?.supabase_user_id
  const module = overrides.module ?? subscription.metadata?.module
  if (!userId || !module) {
    console.error('Subscription missing supabase_user_id/module metadata:', subscription.id)
    return
  }

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  const { error } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      module,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  )
  if (error) console.error('Supabase upsert failed:', error)
}

async function creditCoinsFromSession(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id
  const coinAmount = Number(session.metadata?.coin_amount)
  if (!userId || !Number.isFinite(coinAmount) || coinAmount <= 0) {
    console.error('Coin checkout session missing supabase_user_id/coin_amount metadata:', session.id)
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  const { error } = await supabaseAdmin.rpc('credit_coins', {
    p_user_id: userId,
    p_amount: coinAmount,
    p_stripe_payment_intent_id: paymentIntentId,
  })
  if (error) console.error('credit_coins RPC failed:', error)
}

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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment') {
          await creditCoinsFromSession(session)
        } else if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await upsertFromSubscription(subscription, {
            userId: session.client_reference_id ?? undefined,
            module: session.metadata?.module,
          })
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await upsertFromSubscription(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await upsertFromSubscription(subscription)
        }
        break
      }

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
