-- Seed data for development and testing
-- This file is optional and can be used to populate initial data

-- Note: Replace these UUIDs with actual user IDs after creating test users

-- Example color schemes
INSERT INTO landing_pages (user_id, title, subdomain, template_name, is_published)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'Example Modern Page', 'example-modern', 'modern', true),
  ('00000000-0000-0000-0000-000000000000', 'Example Minimal Page', 'example-minimal', 'minimal', true),
  ('00000000-0000-0000-0000-000000000000', 'Example Bold Page', 'example-bold', 'bold', true)
ON CONFLICT (subdomain) DO NOTHING;

-- You can add more seed data here for testing
