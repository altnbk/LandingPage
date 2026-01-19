export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface PageContent {
  id: string;
  page_id: string;
  headline: string;
  subheadline: string | null;
  body_text: string | null;
  cta_button_text: string;
  cta_button_link: string;
  hero_image_url: string | null;
  color_scheme: ColorScheme;
  sections: any[];
  metadata: {
    title?: string;
    description?: string;
    og_image?: string;
  };
}

export interface LandingPage {
  id: string;
  user_id: string;
  title: string;
  subdomain: string;
  template_name: 'modern' | 'minimal' | 'bold';
  is_published: boolean;
  custom_domain: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  content?: PageContent;
}

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro' | 'business';
  stripe_customer_id: string | null;
}
