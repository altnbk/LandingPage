import type { APIRoute } from 'astro';
import { generateDescription } from '../../../lib/openai';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check tier limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier === 'free') {
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

    const body = await request.json();
    const { productDescription, headline, tone } = body;

    if (!productDescription || !headline) {
      return new Response(
        JSON.stringify({ error: 'Product description and headline are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const description = await generateDescription({
      productDescription,
      headline,
      tone: tone || 'professional'
    });

    // Track generation
    supabase.from('ai_generations').insert({
      user_id: user.id,
      generation_type: 'description',
      prompt: `${headline} | ${productDescription}`,
      result: description,
      tokens_used: 120
    }).then();

    return new Response(
      JSON.stringify({ description }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('AI description generation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate description'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
