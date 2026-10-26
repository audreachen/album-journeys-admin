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


## Assignment administration

The Fruit Stand now includes `/log` (Input, AI output, Timestamp, User ID), read-only prompt chains/steps, requests, raw LLM responses and AI energy-map media; editable weighted prompt-chain mixes; and CRUD for terms, examples, models, providers, signup domains, email exceptions and uploaded images.

Every page and server mutation calls `requireAdmin()`. Supabase independently enforces Google-backed superadmin RLS. Profile INSERT/UPDATE privileges exclude `is_superadmin`. Logs are immutable to browser roles. Image bytes remain in private buckets, use short-lived signed previews and require the same admin policy for uploads/updates/deletes. New admin uploads are capped at 2 MB and checked by file signature. Referenced models/providers cannot be deleted.

The public generator selects an enabled weighted chain, uses its actual step model/settings, includes terms/examples as grounding, and records every provider attempt. Only validated output creates AI-generated media. An optional bearer session is verified with `getUser` before storing a user ID; anonymous calls remain supported and labeled. Logging fails closed. `JOURNEY_RUNTIME_TOKEN` is a server-only, narrowly scoped credential in the original app's Vercel branch environment; its hash is stored in `journey_private.runtime_credentials`. Never commit plaintext credentials or put this token in `NEXT_PUBLIC_*` variables. The existing Gemini key stays server-side. Runtime RPCs deliberately require this token; admin clients cannot write audit records.

`allowed_signup_domains` and `whitelisted_email_addresses` are managed policy lists. They do not currently enforce a signup gate or grant admin access, preserving the existing Google OAuth signup behavior. Only the Google model adapter is implemented; unsupported adapters are rejected.

### Verification

- `npm test`: strict energy-map validation and byte-signature upload validation.
- `npm run build`: production compilation and TypeScript checks.
- `tests/database-security.sql`: transaction-only tests for admin CRUD, profile upserts, nonadmin/anonymous denial, immutable logs, mix safeguards and storage RLS. All fixtures roll back. Execute through privileged SQL tooling, never through an application account.
- Migrations are additive. `20261026053150_journey_admin_catalog.sql` adds the catalog/audit/storage policies; `20261026053645_journey_admin_integrity.sql` protects the final active mix and supports listener-image refresh.

Existing user images can be imported with **Refresh listener uploads**; this catalogs their paths without moving their files. Replacing a catalog entry for a listener image preserves the original object. Explicit deletion warns that a listener's journal/profile may be affected.

Authenticated browser checks use the existing Google superadmin account. Database-role tests do not replace these checks.

### Deployment verification (October 26, 2026)

The Google superadmin session successfully opened all required screens, including accounts without profiles. Browser checks confirmed catalog create/update, private PNG upload/decoded preview/metadata update, and mix save without changing traffic weights. The temporary catalog fixture was removed; the sample energy-map image remains in the image library. A real public Gemini generation rendered successfully and created one request, one raw response and one validated media record. Invalid input returned 400; an invalid bearer session returned 401. Anonymous admin access redirects to login. Production builds and transaction-only database authorization/CRUD tests passed.

Google login now explicitly requests account selection, allowing staff to switch away from an unauthorized account. The admin Vercel commit URLs retain platform SSO protection; the production custom domain uses the app's Google superadmin gate. Signup policy lists remain management-only, as described above. Full original-app lint still reports pre-existing profile-effect and unescaped-text issues outside the changed files; lint on the modified original-app files passes with existing image/navigation warnings.
