-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create landing_pages table
CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL CHECK (template_name IN ('modern', 'minimal', 'bold')),
  is_published BOOLEAN DEFAULT FALSE,
  custom_domain TEXT UNIQUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create page_content table
CREATE TABLE page_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE UNIQUE,
  headline TEXT NOT NULL,
  subheadline TEXT,
  body_text TEXT,
  cta_button_text TEXT NOT NULL,
  cta_button_link TEXT NOT NULL,
  hero_image_url TEXT,
  color_scheme JSONB NOT NULL DEFAULT '{"primary": "#0284c7", "secondary": "#0369a1", "accent": "#38bdf8", "background": "#ffffff", "text": "#111827"}'::jsonb,
  sections JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create form_submissions table
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ai_generations table
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('headline', 'description', 'image', 'color')),
  prompt TEXT NOT NULL,
  result TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_landing_pages_user_id ON landing_pages(user_id);
CREATE INDEX idx_landing_pages_subdomain ON landing_pages(subdomain);
CREATE INDEX idx_landing_pages_custom_domain ON landing_pages(custom_domain);
CREATE INDEX idx_page_content_page_id ON page_content(page_id);
CREATE INDEX idx_form_submissions_page_id ON form_submissions(page_id);
CREATE INDEX idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON landing_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_content_updated_at BEFORE UPDATE ON page_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Landing pages policies
CREATE POLICY "Users can view own pages" ON landing_pages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pages" ON landing_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pages" ON landing_pages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pages" ON landing_pages
  FOR DELETE USING (auth.uid() = user_id);

-- Public access to published pages (for viewing)
CREATE POLICY "Anyone can view published pages" ON landing_pages
  FOR SELECT USING (is_published = true);

-- Page content policies
CREATE POLICY "Users can view own page content" ON page_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM landing_pages
      WHERE landing_pages.id = page_content.page_id
      AND landing_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own page content" ON page_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM landing_pages
      WHERE landing_pages.id = page_content.page_id
      AND landing_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own page content" ON page_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM landing_pages
      WHERE landing_pages.id = page_content.page_id
      AND landing_pages.user_id = auth.uid()
    )
  );

-- Public access to published page content
CREATE POLICY "Anyone can view published page content" ON page_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM landing_pages
      WHERE landing_pages.id = page_content.page_id
      AND landing_pages.is_published = true
    )
  );

-- Form submissions policies
CREATE POLICY "Users can view own form submissions" ON form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM landing_pages
      WHERE landing_pages.id = form_submissions.page_id
      AND landing_pages.user_id = auth.uid()
    )
  );

-- Public can insert form submissions
CREATE POLICY "Anyone can submit forms" ON form_submissions
  FOR INSERT WITH CHECK (true);

-- AI generations policies
CREATE POLICY "Users can view own AI generations" ON ai_generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create AI generations" ON ai_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
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

-- Trigger to call handle_new_user function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to increment page view count
CREATE OR REPLACE FUNCTION increment_page_views(page_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE landing_pages
  SET view_count = view_count + 1
  WHERE id = page_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
