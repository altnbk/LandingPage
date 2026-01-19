import type { APIRoute } from 'astro';
import { createCheckoutSession, STRIPE_PRODUCTS } from '../../../lib/stripe';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { tier } = body; // 'pro' or 'business'

    if (!tier || !['pro', 'business'].includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier. Must be "pro" or "business"' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user email
    const email = user.email;
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get price ID
    const priceId = tier === 'pro'
      ? STRIPE_PRODUCTS.pro.priceId
      : STRIPE_PRODUCTS.business.priceId;

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Stripe price ID not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get base URL
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Create checkout session
    const session = await createCheckoutSession(
      user.id,
      email,
      priceId,
      `${baseUrl}/dashboard?success=true`,
      `${baseUrl}/pricing?canceled=true`
    );

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create checkout session'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
