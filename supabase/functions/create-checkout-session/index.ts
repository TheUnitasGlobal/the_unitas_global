// Supabase Edge Function: create-checkout-session
//
// Creates a Stripe Checkout Session (subscription mode) for one of the five
// THE UNITAS GLOBAL OÜ modules and returns its hosted URL for the browser to
// redirect to.
//
// Why this has to live server-side (and not in index.html):
//   - Creating a Checkout Session requires the Stripe *secret* key. Secret
//     keys must never be shipped to the browser (Stripe: "secret keys must
//     never be exposed"). Only the publishable key is safe client-side.
//   - The price charged must never be trusted from the client. This function
//     accepts only a module *name* and looks the Price ID up itself, so a
//     tampered client request can't check out at an arbitrary amount.
//   - The caller must be an authenticated Supabase user (not just holding the
//     public anon key), so the resulting subscription can be tied to a real
//     account via client_reference_id / customer_email.
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   STRIPE_SECRET_KEY      - sk_live_... / sk_test_...
//   SITE_URL               - e.g. https://theunitas.global (used for success/cancel redirects)
//   PRICE_ID_ARCHE          - Stripe recurring Price ID for the Arche module ($29/mo)
//   PRICE_ID_ARENA          - Stripe recurring Price ID for the Arena module ($49/mo)
//   PRICE_ID_SCORE          - Stripe recurring Price ID for the Score module ($39/mo)
//   PRICE_ID_FATE           - Stripe recurring Price ID for the Fate module ($99/mo)
//   PRICE_ID_CODEX22        - Stripe recurring Price ID for the Codex22 module ($199/mo)
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
  'PRICE_ID_ARCHE',
  'PRICE_ID_ARENA',
  'PRICE_ID_SCORE',
  'PRICE_ID_FATE',
  'PRICE_ID_CODEX22',
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

// Authoritative catalog: module name -> Stripe recurring Price ID.
// The client only ever sends a module name; the price itself is looked up
// here so it can never be tampered with from the browser.
const PRICE_CATALOG: Record<string, string | undefined> = {
  Arche: Deno.env.get('PRICE_ID_ARCHE'),
  Arena: Deno.env.get('PRICE_ID_ARENA'),
  Score: Deno.env.get('PRICE_ID_SCORE'),
  Fate: Deno.env.get('PRICE_ID_FATE'),
  Codex22: Deno.env.get('PRICE_ID_CODEX22'),
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
    // Verify the caller is a real, authenticated Supabase user (not just the
    // public anon key) before creating a Checkout Session on their behalf.
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

    const { module: moduleName } = await req.json()
    const priceId = PRICE_CATALOG[moduleName]
    if (!isStripePriceId(priceId)) {
      return new Response(JSON.stringify({ error: `Unknown or unconfigured module: ${moduleName}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { module: moduleName, supabase_user_id: user.id },
      success_url: `${SITE_URL}/?checkout=success&module=${encodeURIComponent(moduleName)}`,
      cancel_url: `${SITE_URL}/?checkout=cancelled`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return new Response(JSON.stringify({ error: 'Internal error creating checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
