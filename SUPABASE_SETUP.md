# Supabase Setup Guide

Follow these steps to set up your Supabase backend for LandingForge.

## Step 1: Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

## Step 2: Create a New Project

1. Click "New Project" from your dashboard
2. Fill in the details:
   - **Name:** landingforge (or your preferred name)
   - **Database Password:** Generate a strong password (save this!)
   - **Region:** Choose closest to your target users
   - **Pricing Plan:** Free (perfect for development and early users)
3. Click "Create new project"
4. Wait 2-3 minutes for setup to complete

## Step 3: Run Database Migrations

### Option A: Using Supabase Dashboard (Easiest)

1. In your Supabase project, click on "SQL Editor" in the left sidebar
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - this is correct!

### Option B: Using Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Step 4: Get Your API Keys

1. In your Supabase project, click on "Settings" (gear icon) in the left sidebar
2. Click "API" under Project Settings
3. You'll see two important values:
   - **Project URL** - starts with `https://xxxxx.supabase.co`
   - **anon/public key** - long string starting with `eyJ...`

## Step 5: Configure Environment Variables

1. In your project root, create a `.env` file (copy from `.env.example`)
2. Add your Supabase credentials:

```bash
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxx...
```

3. Save the file
4. **NEVER commit `.env` to git** - it's already in `.gitignore`

## Step 6: Enable Email Authentication

1. In Supabase dashboard, go to "Authentication" > "Providers"
2. Make sure "Email" is enabled (it should be by default)
3. Configure email templates (optional):
   - Go to "Authentication" > "Email Templates"
   - Customize signup confirmation, password reset emails

## Step 7: Configure Storage (for image uploads)

1. Go to "Storage" in the left sidebar
2. Click "Create a new bucket"
3. Name it: `landing-pages`
4. Make it **public** (check "Public bucket")
5. Click "Create bucket"

### Set Storage Policies

1. Click on the `landing-pages` bucket
2. Go to "Policies" tab
3. Click "New Policy"
4. Select "Custom" policy
5. Add these policies:

**Allow authenticated users to upload:**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landing-pages');
```

**Allow public to view:**
```sql
CREATE POLICY "Public can view"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'landing-pages');
```

## Step 8: Verify Everything Works

Run this test in the SQL Editor:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see these tables:
- ai_generations
- form_submissions
- landing_pages
- page_content
- profiles
- subscriptions

## Step 9: Create a Test User (Optional)

1. Go to "Authentication" > "Users"
2. Click "Add user" > "Create new user"
3. Enter email and password
4. Click "Create user"
5. Check that a profile and subscription were automatically created:

```sql
SELECT * FROM profiles;
SELECT * FROM subscriptions;
```

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the migration SQL successfully
- Check for any error messages in the SQL editor

### Can't connect from app
- Double-check your `.env` file has correct URL and key
- Make sure you're using `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`
- Restart your dev server after changing `.env`

### RLS policies blocking access
- Make sure you're authenticated when testing
- Check RLS policies in "Authentication" > "Policies"
- You can temporarily disable RLS for testing (not recommended for production)

## Security Checklist

- ✅ Never commit `.env` file to git
- ✅ Use Row Level Security (RLS) policies (already configured)
- ✅ Keep your service role key secret (don't use in frontend)
- ✅ Use anon/public key in frontend (it's safe)
- ✅ Enable email verification for production
- ✅ Set up password strength requirements

## Next Steps

Your Supabase backend is ready! You can now:
1. Run the app locally: `npm run dev`
2. Test authentication (signup/login)
3. Create your first landing page

## Useful Supabase Resources

- [Supabase Docs](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)
- [Supabase Community](https://github.com/supabase/supabase/discussions)

---

Need help? The migration file is in `supabase/migrations/001_initial_schema.sql`
