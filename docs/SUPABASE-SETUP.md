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
