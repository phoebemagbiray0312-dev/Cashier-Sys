# Cashier System — Production Migration Plan

Status: implementation in phases; **not production-ready yet**.

## Verified baseline (2026-11-06)
- Supabase project `rxkaebvivzptjprnpaaf` is active/healthy.
- Two public table families exist: `cs_*` and `cms_*`; **do not merge or delete either** until ownership and code references are audited.
- Four branch records exist in each branch table family.
- Main `app/page.tsx` still calls `loadDB()` and uses `sessionStorage` for login. Existing local browser data must be preserved until an explicit, validated migration.
- No purchase order records in `cms_purchase_orders` at initial inspection.

## Safe sequence
1. Inventory every read/write path: POS, terminal payments, inventory, revolving fund, cash count, daily turnover, suppliers, PO, receipts, audit events, report studio and attachments.
2. Identify canonical table family and compare columns, foreign keys, constraints, RLS policies, and storage buckets. Map each UI model to database entities; avoid parallel conflicting sources of truth.
3. Export and validate backup of existing Supabase records; implement explicit opt-in export/import for browser-local data with duplicate detection and rollback. Never silently overwrite.
4. Implement Supabase Auth with server-verified sessions and role/branch membership. Define branch/company RLS for all exposed tables. Never expose secret/service-role keys in the client.
5. Move modules in small verified transactions: suppliers and vehicle/job-linked POs, receipt uploads, payments/reconciliation, POS, inventory, funds, cash counts, reports. Maintain audit trail.
6. Replace 'Local Demo' only when active authenticated database reads/writes are confirmed; show an honest disconnected/error state rather than falsely reporting online.
7. Run typecheck, build, existing smoke tests and real cross-session/multi-device tests before Vercel production promotion.

## Purchase orders: vehicle/job linkage
- A vehicle can have many service jobs, and a job can have many POs.
- Each PO has a unique PO number, supplier, branch, vehicle_id and job_id; preserve historical records by job.
- Receipts, Parts Buyer proof, refunds, replacements, and verification remain tied to their specific PO/payment.
- Linked POs can be summarized by vehicle and job without combining supplier-specific accounting.

## UI requirements
- Preserve original `public/UC.png` and `public/MND.png` files.
- Full original logo in expanded desktop sidebar; compact original-artwork symbol on narrow/mobile; favicon symbol.
- Group profile and logout in a consistent sidebar footer; avoid oversized blank space.
- Verify responsive layouts and company switching on both branches.

## Release gates
- No production data deletion or reset.
- RLS isolation verified for all four branches and both companies.
- No duplicate or missing transactions after migration.
- Real Auth sign-in/out and session expiry tested.
- Uploads private, permissioned, and accessible only to authorized roles.
- Production secrets configured in Vercel, not committed to Git.
