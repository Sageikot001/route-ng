# Route.ng Setup Guide

## Prerequisites

- Node.js 18+
- A Supabase account (free tier works)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter project details:
   - Name: `route-ng` (or any name)
   - Database Password: (save this somewhere)
   - Region: Choose closest to you
4. Wait for project to be created

## Step 2: Get Supabase Credentials

1. In your project, go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under Project API keys)

3. Update `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 3: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the editor
5. Click "Run"

You should see "Success. No rows returned" for each statement.

## Step 4: Disable Email Confirmation (For Development)

By default, Supabase requires email confirmation. To skip this for testing:

1. Go to **Authentication** → **Providers** → **Email**
2. Turn OFF "Confirm email"
3. Click "Save"

**Note:** Re-enable this for production!

## Step 5: Create First Admin User (Optional)

To test admin features, manually create an admin in the database:

1. First, register through the app as a manager
2. Then in SQL Editor, run:
```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Step 6: Start Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Verification Checklist

After setup, verify:

1. [ ] Can register as a manager
2. [ ] Registration redirects to step 2 (complete profile)
3. [ ] After completing profile, redirects to success page
4. [ ] Can log in with created account
5. [ ] Dashboard shows correctly based on role
6. [ ] Refreshing page keeps you logged in

## Troubleshooting

### "Loading..." forever
- Check browser console for errors
- Verify `.env` has correct Supabase URL and key
- Make sure schema.sql was run in Supabase

### Registration doesn't proceed to step 2
- Check if email confirmation is disabled
- Check browser console for error messages
- Verify RLS policies were created (run schema.sql)

### "relation does not exist" errors
- Run schema.sql in Supabase SQL Editor

### "permission denied" errors
- Check RLS policies were created
- Make sure you're logged in (check auth state)

## Project Structure

```
src/
├── api/           # Supabase client & API functions
├── components/    # React components (Login, Registration, etc.)
├── contexts/      # AuthContext for state management
├── pages/         # Role-specific dashboards
│   ├── ios-user/
│   ├── manager/
│   └── admin/
└── types/         # TypeScript interfaces
```
