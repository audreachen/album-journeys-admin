# 🍓 The Fruit Stand

Admin-only Next.js dashboard for Album Journeys, using its existing Supabase database.

## Setup
1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the existing Supabase project (see `.env.example`).
2. The migration in `supabase/migrations/001_fruit_stand.sql` has been applied to the Album Journeys Supabase project.
3. Enable Google in Supabase Auth, and allow `https://YOUR-ADMIN-DOMAIN/auth/callback` as a redirect URL.
4. Sign in once with Google. In the Supabase SQL editor, find your Google-authenticated user ID and run `UPDATE public.journal_profiles SET is_superadmin = true WHERE user_id = 'YOUR-USER-UUID';`. If no profile exists, create it through a privileged SQL insert after verifying the user ID.
5. Run `npm install && npm run dev` locally, or deploy to a separate Vercel project.

All admin pages and Server Actions check Supabase authentication, Google identity, and the database superadmin flag. RLS also protects the admin-only data. No service-role key is needed in the web app.

The generated-map catalog is initially separate from existing AI generations; existing listener ratings remain intact.
