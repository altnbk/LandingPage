import type { APIRoute } from 'astro';
import { suggestColorScheme } from '../../../lib/openai';
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
    const { productDescription, industry } = body;

    if (!productDescription) {
      return new Response(
        JSON.stringify({ error: 'Product description is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const colorScheme = await suggestColorScheme({
      productDescription,
      industry: industry || 'general'
    });

    // Track generation
    supabase.from('ai_generations').insert({
      user_id: user.id,
      generation_type: 'color',
      prompt: productDescription,
      result: colorScheme,
      tokens_used: 50
    }).then();

    return new Response(
      JSON.stringify({ colorScheme }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('AI color scheme suggestion error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to suggest color scheme'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
