# Supabase schema audit — Cashier System
Date: 2026-11-06
Project: rxkaebvivzptjprnpaaf
Status: read-only inventory, no live data mutations.

## Confirmed table families
| Feature | cs_* family | cms_* family | Direction |
| --- | --- | --- | --- |
| Branches | cs_branches (4) | cms_branches (4) | Keep both; inspect dependencies before selecting canonical |
| Staff / auth mapping | cs_staff (0) | cms_profiles (1) | cms_profiles is populated; verify user and RLS |
| Suppliers | cs_suppliers (0) | cms_suppliers (0) | cms has branch_id and creator |
| Purchase orders | cs_purchase_orders (0) | cms_purchase_orders (0) | cms has branch+supplier composite FK |
| PO line items | cs_purchase_order_lines (0) | cms_po_items (0) | Both have quantity/cost constraints |
| Payment / reconciliation | cs_purchase_payments (0) | cms_reconciliations (0) | Different semantics: avoid blind conversion |
| File metadata | receipt_path on cs_purchase_payments | cms_attachments (0) | cms supports buyer_proof, cashier_receipt, refund_proof |
| Funds | — | cms_fund_entries (0) | RF/RFP entry types available |
| Audit | cs_audit_events (0) | cms_audit_logs (0) | Verify RLS and insert strategy |

All listed public tables have RLS enabled; this alone does not prove policies correctly isolate branches. Do not enable generic authenticated-all access.

## Code audit
- `app/page.tsx` still calls `loadDB()` and saves login identity to `sessionStorage` under `uc_fund_session`.
- Current sign-in checks local user records, not Supabase Auth.
- A display-only removal of demo labels must not be treated as production readiness.
- Existing smoke tests and `npm run build` should gate every migration PR.

## Multiple POs per vehicle and job
Current PO tables have `plate_number` / `vehicle_plate` text but no `vehicle_id` or `job_id` foreign keys. Before live PO writes:
1. Add normalized vehicles and service_jobs tables with branch-scoped identifiers.
2. Add nullable vehicle_id/job_id to canonical purchase_orders, backfill from verified existing references, then enforce valid job-to-vehicle relationship.
3. Permit multiple unique PO numbers for each job; one supplier per PO; preserve receipts and review history per PO.
4. Keep vehicle history across jobs but never combine unrelated job accounting.
5. Define and test RLS for job, vehicle, PO, child line items and attachments.

## Implementation gates
1. Inspect current RLS policies and Auth users with authorized read-only checks.
2. Verify Supabase Storage bucket privacy and storage policies.
3. Identify all browser-local data export paths; do not overwrite or silently migrate.
4. Establish production sign-in with Supabase Auth, server-validated sessions and role/branch profile; block inactive accounts.
5. Implement a read-only Supabase connectivity probe, then write transactions module-by-module after RLS tests.
6. Preserve original logo assets and current app behavior until replacement passes tests.
7. Configure environment variables in Vercel without committing secrets.
