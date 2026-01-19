export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          company_name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'pro' | 'business'
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          company_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          company_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      landing_pages: {
        Row: {
          id: string
          user_id: string
          title: string
          subdomain: string
          template_name: string
          is_published: boolean
          custom_domain: string | null
          view_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          subdomain: string
          template_name: string
          is_published?: boolean
          custom_domain?: string | null
          view_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          subdomain?: string
          template_name?: string
          is_published?: boolean
          custom_domain?: string | null
          view_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      page_content: {
        Row: {
          id: string
          page_id: string
          headline: string
          subheadline: string | null
          body_text: string | null
          cta_button_text: string
          cta_button_link: string
          hero_image_url: string | null
          color_scheme: Json
          sections: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_id: string
          headline: string
          subheadline?: string | null
          body_text?: string | null
          cta_button_text: string
          cta_button_link: string
          hero_image_url?: string | null
          color_scheme: Json
          sections?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          headline?: string
          subheadline?: string | null
          body_text?: string | null
          cta_button_text?: string
          cta_button_link?: string
          hero_image_url?: string | null
          color_scheme?: Json
          sections?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
