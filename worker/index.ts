/**
 * Cloudflare Worker for LandingForge
 * Dynamically renders landing pages based on subdomain
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  PAGES_CACHE: KVNamespace; // Optional: for caching rendered pages
}

interface PageData {
  id: string;
  title: string;
  subdomain: string;
  template_name: string;
  is_published: boolean;
  view_count: number;
  user_id: string;
  content: {
    headline: string;
    subheadline?: string;
    body_text?: string;
    cta_button_text: string;
    cta_button_link: string;
    hero_image_url?: string;
    color_scheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  profile?: {
    subscription_tier: string;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Extract subdomain
      const hostname = url.hostname;
      const subdomain = extractSubdomain(hostname);

      // If no subdomain or it's the main domain, return 404
      if (!subdomain || subdomain === 'www' || subdomain === 'landingforge') {
        return new Response('Page not found', { status: 404 });
      }

      // Try to get from cache first (if KV is configured)
      let cachedHtml: string | null = null;
      if (env.PAGES_CACHE) {
        cachedHtml = await env.PAGES_CACHE.get(`page:${subdomain}`);
        if (cachedHtml) {
          return new Response(cachedHtml, {
            headers: {
              'Content-Type': 'text/html;charset=UTF-8',
              'Cache-Control': 'public, max-age=300', // 5 minutes
              'X-Cache': 'HIT'
            }
          });
        }
      }

      // Fetch page data from Supabase
      const pageData = await fetchPageData(subdomain, env);

      if (!pageData) {
        return new Response(renderNotFoundPage(subdomain), {
          status: 404,
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
      }

      if (!pageData.is_published) {
        return new Response(renderUnpublishedPage(), {
          status: 403,
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
      }

      // Track page view (fire and forget)
      ctx.waitUntil(trackPageView(pageData.id, env));

      // Render the appropriate template
      const html = renderTemplate(pageData);

      // Cache the rendered page (if KV is configured)
      if (env.PAGES_CACHE) {
        ctx.waitUntil(env.PAGES_CACHE.put(`page:${subdomain}`, html, {
          expirationTtl: 300 // 5 minutes
        }));
      }

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=300',
          'X-Cache': 'MISS'
        }
      });

    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(renderErrorPage(error.message), {
        status: 500,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }
  }
};

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  hostname = hostname.split(':')[0];

  // Split by dots
  const parts = hostname.split('.');

  // For landingforge.app, subdomain is parts[0]
  // For localhost:3000, subdomain is parts[0]
  if (parts.length >= 2) {
    return parts[0];
  }

  return null;
}

/**
 * Fetch page data from Supabase
 */
async function fetchPageData(subdomain: string, env: Env): Promise<PageData | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/landing_pages?subdomain=eq.${subdomain}&select=*,page_content(*),profiles(subscription_tier)`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const page = data[0];
    const content = page.page_content?.[0];

    if (!content) {
      return null;
    }

    // Parse color scheme if it's a string
    let colorScheme = content.color_scheme;
    if (typeof colorScheme === 'string') {
      colorScheme = JSON.parse(colorScheme);
    }

    return {
      id: page.id,
      title: page.title,
      subdomain: page.subdomain,
      template_name: page.template_name,
      is_published: page.is_published,
      view_count: page.view_count || 0,
      user_id: page.user_id,
      content: {
        headline: content.headline,
        subheadline: content.subheadline,
        body_text: content.body_text,
        cta_button_text: content.cta_button_text,
        cta_button_link: content.cta_button_link,
        hero_image_url: content.hero_image_url,
        color_scheme: colorScheme,
        metadata: typeof content.metadata === 'string' ? JSON.parse(content.metadata) : content.metadata
      },
      profile: page.profiles
    };
  } catch (error) {
    console.error('Error fetching page data:', error);
    return null;
  }
}

/**
 * Track page view
 */
async function trackPageView(pageId: string, env: Env): Promise<void> {
  try {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/increment_view_count`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_id: pageId })
      }
    );
  } catch (error) {
    console.error('Error tracking view:', error);
  }
}

/**
 * Render template with page data
 */
function renderTemplate(page: PageData): string {
  const { content } = page;
  const colors = content.color_scheme;
  const showWatermark = page.profile?.subscription_tier === 'free';

  // Choose template renderer based on template_name
  switch (page.template_name) {
    case 'modern':
      return renderModernTemplate(content, colors, showWatermark);
    case 'minimal':
      return renderMinimalTemplate(content, colors, showWatermark);
    case 'bold':
      return renderBoldTemplate(content, colors, showWatermark);
    default:
      return renderModernTemplate(content, colors, showWatermark);
  }
}

/**
 * Modern template renderer
 */
function renderModernTemplate(content: any, colors: any, showWatermark: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.metadata?.title || content.headline}</title>
  <meta name="description" content="${content.metadata?.description || content.subheadline || ''}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${colors.text}; }
    .hero { min-height: 100vh; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%); display: flex; align-items: center; justify-content: center; text-align: center; padding: 60px 20px; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%); animation: pulse 8s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .hero-content { position: relative; z-index: 1; max-width: 900px; animation: fadeInUp 1s ease-out; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    h1 { font-size: 4rem; font-weight: 900; color: white; margin-bottom: 20px; letter-spacing: -2px; line-height: 1.1; }
    .subheadline { font-size: 1.8rem; color: ${colors.accent}; margin-bottom: 30px; font-weight: 600; }
    .body-text { font-size: 1.3rem; color: rgba(255,255,255,0.9); margin-bottom: 40px; line-height: 1.8; }
    .hero-image { margin: 40px 0; }
    .hero-image img { max-width: 700px; width: 100%; border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,0.3); }
    .cta-button { display: inline-block; padding: 20px 50px; background: ${colors.accent}; color: ${colors.text}; text-decoration: none; font-weight: 700; border-radius: 12px; font-size: 1.2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: all 0.3s ease; }
    .cta-button:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(0,0,0,0.3); }
    .watermark { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
    .watermark a { color: ${colors.accent}; text-decoration: none; }
    @media (max-width: 768px) { h1 { font-size: 2.5rem; } .subheadline { font-size: 1.3rem; } .body-text { font-size: 1.1rem; } }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-content">
      <h1>${content.headline}</h1>
      ${content.subheadline ? `<p class="subheadline">${content.subheadline}</p>` : ''}
      ${content.body_text ? `<p class="body-text">${content.body_text}</p>` : ''}
      ${content.hero_image_url ? `<div class="hero-image"><img src="${content.hero_image_url}" alt="${content.headline}" /></div>` : ''}
      <a href="${content.cta_button_link}" class="cta-button">${content.cta_button_text}</a>
    </div>
  </section>
  ${showWatermark ? '<div class="watermark">Made with <a href="https://landingforge.com" target="_blank">LandingForge</a></div>' : ''}
</body>
</html>`;
}

/**
 * Minimal template renderer
 */
function renderMinimalTemplate(content: any, colors: any, showWatermark: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.metadata?.title || content.headline}</title>
  <meta name="description" content="${content.metadata?.description || content.subheadline || ''}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; line-height: 1.8; color: ${colors.text}; background: ${colors.background}; }
    .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 60px 40px; }
    .hero-content { max-width: 700px; text-align: center; }
    h1 { font-size: 3.5rem; font-weight: 300; color: ${colors.primary}; margin-bottom: 30px; letter-spacing: -1px; line-height: 1.2; }
    .subheadline { font-size: 1.5rem; color: ${colors.secondary}; margin-bottom: 25px; font-style: italic; }
    .body-text { font-size: 1.2rem; color: ${colors.text}; margin-bottom: 40px; opacity: 0.8; }
    .hero-image { margin: 40px 0; }
    .hero-image img { max-width: 100%; border-radius: 4px; }
    .cta-button { display: inline-block; padding: 16px 40px; background: transparent; color: ${colors.primary}; text-decoration: none; font-weight: 600; border: 2px solid ${colors.primary}; font-size: 1.1rem; transition: all 0.3s ease; font-family: sans-serif; }
    .cta-button:hover { background: ${colors.primary}; color: white; }
    .watermark { position: fixed; bottom: 20px; right: 20px; background: ${colors.text}; color: white; padding: 8px 16px; font-size: 0.85rem; font-family: sans-serif; }
    .watermark a { color: ${colors.accent}; text-decoration: none; }
    @media (max-width: 768px) { h1 { font-size: 2.2rem; } }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-content">
      <h1>${content.headline}</h1>
      ${content.subheadline ? `<p class="subheadline">${content.subheadline}</p>` : ''}
      ${content.body_text ? `<p class="body-text">${content.body_text}</p>` : ''}
      ${content.hero_image_url ? `<div class="hero-image"><img src="${content.hero_image_url}" alt="${content.headline}" /></div>` : ''}
      <a href="${content.cta_button_link}" class="cta-button">${content.cta_button_text}</a>
    </div>
  </section>
  ${showWatermark ? '<div class="watermark">Made with <a href="https://landingforge.com">LandingForge</a></div>' : ''}
</body>
</html>`;
}

/**
 * Bold template renderer
 */
function renderBoldTemplate(content: any, colors: any, showWatermark: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.metadata?.title || content.headline}</title>
  <meta name="description" content="${content.metadata?.description || content.subheadline || ''}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Impact', 'Arial Black', sans-serif; line-height: 1.6; color: ${colors.text}; background: ${colors.background}; }
    .hero { min-height: 100vh; background: ${colors.primary}; display: flex; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; position: relative; }
    h1 { font-size: 5rem; font-weight: 900; text-transform: uppercase; color: white; text-shadow: 4px 4px 0 ${colors.secondary}, 8px 8px 0 rgba(0,0,0,0.2); margin-bottom: 30px; letter-spacing: -2px; line-height: 1; }
    .subheadline { font-size: 2rem; font-weight: 700; color: ${colors.accent}; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
    .body-text { font-size: 1.3rem; color: white; margin-bottom: 50px; font-family: Arial, sans-serif; font-weight: 500; max-width: 700px; margin-left: auto; margin-right: auto; }
    .hero-image { margin: 50px 0; position: relative; display: inline-block; }
    .hero-image::before { content: ''; position: absolute; top: -20px; left: -20px; right: 20px; bottom: 20px; background: ${colors.accent}; z-index: 0; }
    .hero-image img { position: relative; z-index: 1; max-width: 600px; width: 100%; border: 6px solid white; display: block; }
    .cta-button { display: inline-block; padding: 25px 60px; background: ${colors.accent}; color: ${colors.text}; text-decoration: none; font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; border: 6px solid white; box-shadow: 8px 8px 0 ${colors.secondary}; transition: all 0.2s ease; }
    .cta-button:hover { transform: translate(2px, 2px); box-shadow: 6px 6px 0 ${colors.secondary}; }
    .watermark { position: fixed; bottom: 20px; right: 20px; background: ${colors.text}; color: white; padding: 10px 20px; border: 3px solid ${colors.accent}; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; }
    .watermark a { color: ${colors.accent}; text-decoration: none; }
    @media (max-width: 768px) { h1 { font-size: 3rem; } .subheadline { font-size: 1.5rem; } }
  </style>
</head>
<body>
  <section class="hero">
    <div>
      <h1>${content.headline}</h1>
      ${content.subheadline ? `<p class="subheadline">${content.subheadline}</p>` : ''}
      ${content.body_text ? `<p class="body-text">${content.body_text}</p>` : ''}
      ${content.hero_image_url ? `<div class="hero-image"><img src="${content.hero_image_url}" alt="${content.headline}" /></div>` : ''}
      <a href="${content.cta_button_link}" class="cta-button">${content.cta_button_text}</a>
    </div>
  </section>
  ${showWatermark ? '<div class="watermark">Made with <a href="https://landingforge.com">LandingForge</a></div>' : ''}
</body>
</html>`;
}

/**
 * Render 404 page
 */
function renderNotFoundPage(subdomain: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center; padding: 20px; }
    h1 { font-size: 6rem; font-weight: 900; margin-bottom: 20px; }
    p { font-size: 1.5rem; margin-bottom: 30px; opacity: 0.9; }
    a { color: white; text-decoration: underline; }
  </style>
</head>
<body>
  <div>
    <h1>404</h1>
    <p>Landing page "${subdomain}" not found</p>
    <p><a href="https://landingforge.com">Create your own landing page</a></p>
  </div>
</body>
</html>`;
}

/**
 * Render unpublished page
 */
function renderUnpublishedPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Unpublished</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center; padding: 20px; }
    h1 { font-size: 4rem; font-weight: 900; margin-bottom: 20px; }
    p { font-size: 1.3rem; opacity: 0.9; }
  </style>
</head>
<body>
  <div>
    <h1>🚧</h1>
    <p>This page is currently unpublished</p>
  </div>
</body>
</html>`;
}

/**
 * Render error page
 */
function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a202c; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center; padding: 20px; }
    h1 { font-size: 3rem; font-weight: 700; margin-bottom: 20px; color: #fc8181; }
    p { font-size: 1.2rem; opacity: 0.8; }
  </style>
</head>
<body>
  <div>
    <h1>⚠️ Error</h1>
    <p>Something went wrong loading this page</p>
    <p style="font-size: 0.9rem; margin-top: 20px; opacity: 0.6;">${message}</p>
  </div>
</body>
</html>`;
}
