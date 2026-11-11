-- v9.28.2 — Remove unused legacy cs_* tables (empty; no code or function used them).
-- Structure and the 4 branch rows are archived in supabase/archive/cs_tables_restore.sql.
drop table if exists public.cs_purchase_payments;
drop table if exists public.cs_purchase_order_lines;
drop table if exists public.cs_purchase_orders;
drop table if exists public.cs_audit_events;
drop table if exists public.cs_staff;
drop table if exists public.cs_suppliers;
drop table if exists public.cs_branches;
