# LandingForge - Deployment Guide

Complete step-by-step guide to deploy your Landing Page SaaS to production.

---

## 📋 Prerequisites

Before deploying, make sure you have:
- ✅ Completed development and tested locally
- ✅ All required accounts created:
  - GitHub (for hosting code)
  - Supabase (for database and auth)
  - Cloudflare (for hosting and workers)
  - OpenAI (for AI features)
  - Stripe (for payments)
- ✅ Domain name purchased (optional, can use Cloudflare subdomain)

---

## 🗄️ Part 1: Database Setup (Supabase)

### 1. Create Production Database

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project (choose production region closest to your users)
3. Save the database password securely

### 2. Run Database Migrations

In Supabase SQL Editor, run this migration:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create landing_pages table
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  custom_domain TEXT UNIQUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create page_content table
CREATE TABLE IF NOT EXISTS page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES landing_pages(id) ON DELETE CASCADE UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  subheadline TEXT,
  body_text TEXT,
  cta_button_text TEXT NOT NULL,
  cta_button_link TEXT NOT NULL,
  hero_image_url TEXT,
  color_scheme JSONB NOT NULL DEFAULT '{"primary":"#2563eb","secondary":"#3b82f6","accent":"#60a5fa","background":"#eff6ff","text":"#1e293b"}',
  sections JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES landing_pages(id) ON DELETE CASCADE NOT NULL,
  form_data JSONB NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_generations table
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('headline', 'description', 'image', 'color')),
  prompt TEXT NOT NULL,
  result TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_landing_pages_user_id ON landing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_subdomain ON landing_pages(subdomain);
CREATE INDEX IF NOT EXISTS idx_page_content_page_id ON page_content(page_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_page_id ON form_submissions(page_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for landing_pages
CREATE POLICY "Users can view own pages" ON landing_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pages" ON landing_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pages" ON landing_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pages" ON landing_pages FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for page_content
CREATE POLICY "Users can view own page content" ON page_content FOR SELECT USING (
  EXISTS (SELECT 1 FROM landing_pages WHERE landing_pages.id = page_content.page_id AND landing_pages.user_id = auth.uid())
);
CREATE POLICY "Users can create own page content" ON page_content FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM landing_pages WHERE landing_pages.id = page_content.page_id AND landing_pages.user_id = auth.uid())
);
CREATE POLICY "Users can update own page content" ON page_content FOR UPDATE USING (
  EXISTS (SELECT 1 FROM landing_pages WHERE landing_pages.id = page_content.page_id AND landing_pages.user_id = auth.uid())
);
CREATE POLICY "Users can delete own page content" ON page_content FOR DELETE USING (
  EXISTS (SELECT 1 FROM landing_pages WHERE landing_pages.id = page_content.page_id AND landing_pages.user_id = auth.uid())
);

-- RLS Policies for ai_generations
CREATE POLICY "Users can view own AI generations" ON ai_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create AI generations" ON ai_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Function to auto-create profile and subscription on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_view_count(page_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE landing_pages
  SET view_count = view_count + 1
  WHERE id = page_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Configure Storage

1. Go to Storage in Supabase dashboard
2. Create bucket: `landing-pages`
3. Make it public
4. Add policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'landing-pages');

-- Allow public to view
CREATE POLICY "Public can view" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'landing-pages');

-- Allow users to delete own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'landing-pages' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Get API Keys

1. Go to Settings → API
2. Copy:
   - Project URL
   - `anon` (public) key
3. Save these securely

---

## ☁️ Part 2: Deploy Main App (Cloudflare Pages)

### 1. Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages → Create application → Pages → Connect to Git
3. Select your repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`

### 2. Add Environment Variables

In Cloudflare Pages settings, add these environment variables:

```
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
OPENAI_API_KEY=sk-xxxxx...
STRIPE_SECRET_KEY=sk_live_xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx... (get this later)
PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxx...
PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_xxxxx...
```

### 3. Deploy

Click "Save and Deploy"

Your app will be available at: `yourproject.pages.dev`

---

## ⚙️ Part 3: Deploy Cloudflare Worker

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Configure Worker

Edit `worker/wrangler.toml`:

```toml
name = "landingforge-worker"
main = "index.ts"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "*.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

### 4. Add Secrets

```bash
cd worker
wrangler secret put SUPABASE_URL
# Enter: https://xxxxx.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Enter: eyJxxxxx...
```

### 5. Deploy Worker

```bash
wrangler deploy
```

---

## 💳 Part 4: Configure Stripe

### 1. Create Products and Prices

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Products → Add product

**Pro Product:**
- Name: Pro
- Recurring: Monthly
- Price: $29.00
- Copy the Price ID (starts with `price_...`)

**Business Product:**
- Name: Business
- Recurring: Monthly
- Price: $79.00
- Copy the Price ID

### 2. Configure Webhooks

1. Go to Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
3. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret (starts with `whsec_...`)
5. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

### 3. Enable Customer Portal

1. Go to Settings → Billing → Customer portal
2. Enable customer portal
3. Configure branding and allowed actions

---

## 🌐 Part 5: Custom Domain (Optional)

### 1. Add Domain to Cloudflare

1. Go to Cloudflare dashboard
2. Add your domain
3. Update nameservers at your registrar

### 2. Configure DNS for Main App

Add CNAME record:
- Name: `@` or `www`
- Target: `yourproject.pages.dev`
- Proxy status: Proxied (orange cloud)

### 3. Configure DNS for Landing Pages

Add wildcard CNAME record:
- Name: `*`
- Target: `yourdomain.com`
- Proxy status: Proxied (orange cloud)

### 4. Add Custom Domain to Pages

1. Go to your Pages project → Custom domains
2. Add `yourdomain.com`
3. Wait for SSL certificate provisioning (automatic)

---

## 🔐 Part 6: Security Checklist

Before going live:

- [ ] Enable Supabase email verification
- [ ] Set up Supabase MFA (optional but recommended)
- [ ] Add rate limiting to API endpoints
- [ ] Configure CORS policies
- [ ] Set up monitoring and alerts
- [ ] Enable Cloudflare Bot Fight Mode
- [ ] Add CSP headers
- [ ] Review all RLS policies
- [ ] Test Stripe webhooks in production
- [ ] Set up backup strategy for database

---

## 📊 Part 7: Monitoring & Analytics

### Cloudflare Analytics
- Available in Cloudflare dashboard
- Free analytics for Workers and Pages

### Supabase Monitoring
- Database size and performance
- API usage
- Auth events

### Stripe Dashboard
- Revenue tracking
- Subscription analytics
- Failed payments

---

## 🐛 Troubleshooting

### Pages not rendering
1. Check worker logs: `wrangler tail`
2. Verify Supabase connection
3. Check subdomain format

### Stripe webhooks failing
1. Verify webhook signature secret
2. Check endpoint URL is accessible
3. Review webhook event logs in Stripe

### Authentication issues
1. Check Supabase URL and key
2. Verify email templates are configured
3. Check RLS policies

---

## 🚀 Post-Deployment Tasks

1. **Test everything:**
   - Sign up new user
   - Create landing page
   - Use AI features
   - Upgrade to Pro (test mode)
   - Verify webhook handling

2. **Set up monitoring:**
   - Add status page (e.g., status.yourdomain.com)
   - Set up uptime monitoring
   - Configure error tracking (Sentry, etc.)

3. **Launch marketing:**
   - Submit to Product Hunt
   - Post on social media
   - Reach out to early users

---

## 💰 Cost Breakdown (Production)

**Monthly costs at launch:**
- Domain: ~$1/month (amortized)
- Cloudflare: $0 (free tier)
- Supabase: $0-25 (free tier → Pro at ~50 users)
- OpenAI: $20-50 (depends on usage)
- Stripe: 2.9% + $0.30 per transaction

**Total: ~$20-75/month**

**At 100 paying customers ($29/mo Pro):**
- Revenue: $2,900/month
- Costs: ~$250/month
- Profit: ~$2,650/month 🎉

---

## 📞 Support

If you encounter issues:
1. Check the logs (Cloudflare, Supabase, Stripe)
2. Review the troubleshooting section
3. Search GitHub issues
4. Join the Discord community

---

**Ready to deploy?** Follow each section carefully and you'll have your SaaS live in under 2 hours! 🚀
