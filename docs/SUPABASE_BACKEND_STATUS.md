# Cashier System — Supabase backend foundation

Supabase project: `rxkaebvivzptjprnpaaf`

## Applied on 2026-11-05
Migration `cashier_backend_foundation` was applied directly to Supabase and verified.

Tables:
- `cs_branches`: UCQC, UCM, UCLP (Underchargers), MMM (Mastermind Autoworks)
- `cs_staff`: Supabase Auth user IDs, admin/cashier/pb roles and branch
- `cs_suppliers`: supplier directory
- `cs_purchase_orders`: PO number, supplier, branch, plate and POS reference
- `cs_purchase_order_lines`: quantity and unit cost
- `cs_purchase_payments`: payment method, receipt storage path and PO link
- `cs_audit_events`: audit event foundation

All seven tables have RLS enabled with **no client-access policies yet**. This is intentional: do not add permissive policies or connect production writes until staff identity and branch access are implemented and tested. The frontend currently uses localStorage, not this database.

## Next integration milestones
1. Implement Supabase Auth with unique staff accounts and secure admin provisioning. Existing browser-local passwords must not be imported as plaintext.
2. Design branch/role RLS policies for each operation; keep financial approvals on trusted transactional server code.
3. Add POS, RF/RFP, stock ledgers, approvals and receipt storage schemas mapped to existing `lib/data.ts` types.
4. Add migrations to version control and a safe browser-backup import procedure; never silently overwrite existing browser data.
5. Configure Vercel environment variables using publishable client key only. Never expose service-role keys in browser code.
6. Test Cashier, Parts Buyer and Admin cross-branch isolation, audit trails, duplicate payments and concurrent inventory approvals.

## Security advisor follow-up
The security advisor reported an existing `public.rls_auto_enable()` SECURITY DEFINER function callable by anon/authenticated. Inspect and restrict EXECUTE if unnecessary before production release. Advisor also reports seven intentional RLS-without-policy notices.

## Verification
Post-migration checks returned 7 RLS-enabled public tables, 4 branches, 0 POs and 0 payments. No live transactions were imported or modified.
