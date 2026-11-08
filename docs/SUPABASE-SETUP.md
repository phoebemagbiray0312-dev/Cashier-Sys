# Cashier System — Supabase preparation

Target project: `rxkaebvivzptjprnpaaf`. This commit is **preparation only**, not a working cloud sync.

## Before activation
1. Review `supabase/schema.sql` and apply it using the target project's SQL Editor, with an authorized administrator. Never run it against CRM or other projects.
2. Set up Supabase Auth users; assign each user a `cms_profiles` role and branch via a trusted administrator (never allow self-assignment). Admin can see all branches; Cashier and Parts Buyer only their assigned branch.
3. Create a **private** Supabase Storage bucket for payment proofs and configure branch-scoped object policies before any uploads. Never use public buckets for receipts.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Codespaces/Vercel. Keep `NEXT_PUBLIC_CMS_BACKEND=local` until the app has a fully implemented and tested Supabase adapter.
5. Build a transactional server-side workflow for PO numbering, reconciliation reviews, audit logs, and receipt replacements. Do not rely on browser role flags for authorization.
6. Back up localStorage exports before migration; do not automatically overwrite local records.

## Current status
- Supabase PostgreSQL foundation and branch-aware RLS definitions provided.
- Opt-in configuration helper provided; no credentials committed.
- Existing UI and localStorage remain in use. **No live Supabase reads/writes yet.**
- SQL must be validated against the project, then policies and application integration tested with separate Admin, Cashier and Parts Buyer accounts.


## Live integration pilot (isolated test route)

The opt-in test page at `/supabase-test` is now available on branch `feature/supplier-management`. It calls Supabase Auth and performs authenticated, read-only queries against `cms_profiles`, `cms_branches`, `cms_suppliers`, and `cms_purchase_orders`. It does not modify or migrate the main app's localStorage data.

1. Keep `.env.local` in the repository root, with `NEXT_PUBLIC_CMS_BACKEND=local`, the project URL, and the **publishable** key. Never commit `.env.local` or any secret/service-role key.
2. Pull the branch and restart the Next.js dev server so it loads the env file. Open `/supabase-test` on the existing Codespaces preview URL.
3. Create a **Supabase Auth** test user in the Supabase dashboard. A trusted administrator must separately insert a matching `cms_profiles` row with `user_id` equal to the Auth user's UUID, `role` of `admin`, `cashier`, or `pb`, `active=true`, and a valid `branch_id` for non-admins.
4. Log in on the test page using **Supabase Auth credentials**, not the existing app's local login. Confirm that the user can see only the rows allowed by the RLS policies.
5. Repeat with users from two different branches and an admin account to verify isolation. Empty lists can be expected before records are created; an empty list alone does not prove branch isolation.

This is a read-only pilot, not full Cashier backend integration. Purchase creation, file storage, reconciliation reviews, auditing, and cross-device synchronization still require secure workflows and testing.
