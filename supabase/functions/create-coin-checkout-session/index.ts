// Supabase Edge Function: create-coin-checkout-session
//
// Creates a one-time Stripe Checkout Session for a coin bundle. This is the
// coin-core purchase on-ramp, replacing create-checkout-session (deprecated,
// see supabase/functions/create-checkout-session/index.ts) as the active
// billing path.
//
// Same anti-tampering shape as create-checkout-session: the browser sends
// only a bundle *name*; the Price ID and coin amount are looked up
// server-side so a tampered client request can't buy coins at the wrong
// price or credit the wrong amount.
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   STRIPE_SECRET_KEY   - sk_live_... / sk_test_...
//   SITE_URL            - e.g. https://theunitas.global
//   PRICE_ID_COIN_SMALL  - Stripe one-time Price ID, $10 bundle
//   PRICE_ID_COIN_MEDIUM - Stripe one-time Price ID, $25 bundle
//   PRICE_ID_COIN_LARGE  - Stripe one-time Price ID, $50 bundle
//
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by the platform.

import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const requiredSecretNames = [
  'STRIPE_SECRET_KEY',
  'PRICE_ID_COIN_SMALL',
  'PRICE_ID_COIN_MEDIUM',
  'PRICE_ID_COIN_LARGE',
]
const missingSecretNames = requiredSecretNames.filter((name) => !Deno.env.get(name))

if (missingSecretNames.length > 0) {
  throw new Error(`Missing Supabase secrets: ${missingSecretNames.join(', ')}`)
}

const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://theunitas.global'

// Authoritative catalog: bundle name -> { Stripe Price ID, coin amount }.
// The client only ever sends a bundle name; both the price and the coin
// amount credited are looked up here so neither can be tampered with.
const COIN_BUNDLE_CATALOG: Record<string, { priceId: string | undefined; coinAmount: number }> = {
  small: { priceId: Deno.env.get('PRICE_ID_COIN_SMALL'), coinAmount: 1000 },
  medium: { priceId: Deno.env.get('PRICE_ID_COIN_MEDIUM'), coinAmount: 2750 },
  large: { priceId: Deno.env.get('PRICE_ID_COIN_LARGE'), coinAmount: 6000 },
}

function isStripePriceId(value: string | undefined): value is string {
  return typeof value === 'string' && /^price_[A-Za-z0-9]+$/.test(value)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { bundle } = await req.json()
    const entry = COIN_BUNDLE_CATALOG[bundle]
    if (!entry || !isStripePriceId(entry.priceId)) {
      return new Response(JSON.stringify({ error: `Unknown or unconfigured bundle: ${bundle}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: entry.priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { coin_bundle: bundle, coin_amount: String(entry.coinAmount), supabase_user_id: user.id },
      success_url: `${SITE_URL}/?coin_checkout=success&bundle=${encodeURIComponent(bundle)}`,
      cancel_url: `${SITE_URL}/?coin_checkout=cancelled`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-coin-checkout-session error:', err)
    return new Response(JSON.stringify({ error: 'Internal error creating checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
