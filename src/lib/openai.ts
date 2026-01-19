import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

export interface HeadlineRequest {
  productDescription: string;
  tone?: 'professional' | 'casual' | 'bold' | 'playful';
}

export interface DescriptionRequest {
  productDescription: string;
  headline: string;
  tone?: 'professional' | 'casual' | 'bold' | 'playful';
}

export interface ColorSchemeRequest {
  productDescription: string;
  industry?: string;
}

/**
 * Generate compelling headlines using GPT-4
 */
export async function generateHeadlines(request: HeadlineRequest): Promise<string[]> {
  try {
    const { productDescription, tone = 'professional' } = request;

    const prompt = `You are a professional copywriter specializing in landing pages. Generate 5 compelling, conversion-focused headlines for a landing page.

Product/Service Description: ${productDescription}

Tone: ${tone}

Requirements:
- Each headline should be 5-10 words
- Focus on benefits, not features
- Create urgency or curiosity
- Use power words that convert
- Make them specific and actionable
- Vary the style (question, statement, promise, etc.)

Return ONLY the 5 headlines, one per line, without numbering or bullet points.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert landing page copywriter. You write headlines that convert visitors into customers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content || '';
    const headlines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/)); // Remove numbered lines

    return headlines.slice(0, 5);
  } catch (error) {
    console.error('Error generating headlines:', error);
    throw new Error('Failed to generate headlines');
  }
}

/**
 * Generate compelling body copy/description
 */
export async function generateDescription(request: DescriptionRequest): Promise<string> {
  try {
    const { productDescription, headline, tone = 'professional' } = request;

    const prompt = `You are a professional copywriter specializing in landing pages. Write compelling body copy for a landing page.

Product/Service Description: ${productDescription}
Headline: ${headline}
Tone: ${tone}

Requirements:
- Write 2-3 sentences (40-60 words total)
- Focus on benefits and transformation
- Create desire and urgency
- Use the PAS formula (Problem-Agitate-Solution) or AIDA (Attention-Interest-Desire-Action)
- Make it specific and credible
- End with a soft call-to-action suggestion

Return ONLY the body copy, without any labels or explanations.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert landing page copywriter who writes persuasive, benefit-focused copy that converts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error generating description:', error);
    throw new Error('Failed to generate description');
  }
}

/**
 * Suggest color scheme based on industry/product
 */
export async function suggestColorScheme(request: ColorSchemeRequest): Promise<string> {
  try {
    const { productDescription, industry = 'general' } = request;

    const prompt = `You are a professional UI/UX designer specializing in color psychology for landing pages.

Product/Service: ${productDescription}
Industry: ${industry}

Available color schemes:
- blue: Professional, trustworthy, tech (used by: SaaS, finance, healthcare)
- purple: Creative, innovative, premium (used by: design tools, luxury brands)
- green: Growth, eco-friendly, health (used by: wellness, sustainability, finance)
- orange: Energetic, friendly, action (used by: food, fitness, entertainment)
- pink: Modern, playful, bold (used by: fashion, beauty, lifestyle)

Based on the product description and industry, recommend the SINGLE BEST color scheme that will maximize conversions.

Respond with ONLY ONE WORD: blue, purple, green, orange, or pink`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in color psychology for digital marketing and conversion optimization.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const suggestion = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'blue';
    const validSchemes = ['blue', 'purple', 'green', 'orange', 'pink'];

    return validSchemes.includes(suggestion) ? suggestion : 'blue';
  } catch (error) {
    console.error('Error suggesting color scheme:', error);
    return 'blue'; // Default fallback
  }
}

/**
 * Track AI generation for analytics and billing
 */
export async function trackAIGeneration(
  userId: string,
  generationType: string,
  prompt: string,
  result: string,
  tokensUsed: number
) {
  // This would save to Supabase for tracking usage
  // Useful for enforcing tier limits and analytics
  try {
    const { supabase } = await import('./supabase');

    await supabase.from('ai_generations').insert({
      user_id: userId,
      generation_type: generationType,
      prompt,
      result,
      tokens_used: tokensUsed,
    });
  } catch (error) {
    console.error('Error tracking AI generation:', error);
    // Don't throw - tracking failure shouldn't break the feature
  }
}

export { openai };
