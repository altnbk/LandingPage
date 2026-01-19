import type { APIRoute } from 'astro';
import { generateHeadlines } from '../../../lib/openai';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check user's tier and AI generation limit
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier === 'free') {
      // Check if user has exceeded free tier limit (10 generations/month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count } = await supabase
        .from('ai_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstDayOfMonth.toISOString());

      if (count && count >= 10) {
        return new Response(
          JSON.stringify({
            error: 'Free tier limit reached. Upgrade to Pro for unlimited AI generations.',
            requiresUpgrade: true
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { productDescription, tone } = body;

    if (!productDescription || productDescription.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Product description must be at least 10 characters' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate headlines
    const headlines = await generateHeadlines({
      productDescription,
      tone: tone || 'professional'
    });

    // Track generation (fire and forget)
    supabase.from('ai_generations').insert({
      user_id: user.id,
      generation_type: 'headline',
      prompt: productDescription,
      result: headlines.join('\n'),
      tokens_used: 150 // Approximate
    }).then();

    return new Response(
      JSON.stringify({ headlines }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('AI headline generation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate headlines',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
