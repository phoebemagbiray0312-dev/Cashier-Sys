-- Cashier System backend foundation. Run in Supabase SQL Editor after review.
-- Existing browser-local data is intentionally not migrated or deleted.
create extension if not exists pgcrypto;
create table if not exists public.cms_branches (
 id text primary key check (id in ('UCM','UCQC','UCLP','MMM')),
 name text not null
);
insert into public.cms_branches(id,name) values
 ('UCM','UC Mandaluyong'),('UCQC','UC Quezon City'),
 ('UCLP','UC Las Piñas'),('MMM','Mastermind Mandaluyong')
on conflict (id) do nothing;

create table if not exists public.cms_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null check(role in ('admin','cashier','pb')),
 branch_id text references public.cms_branches(id),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check (role='admin' or branch_id is not null)
);
create table if not exists public.cms_suppliers (
 id uuid primary key default gen_random_uuid(),
 branch_id text not null references public.cms_branches(id),
 name text not null,
 contact text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,branch_id)
);
create table if not exists public.cms_purchase_orders (
 id uuid primary key default gen_random_uuid(),
 branch_id text not null references public.cms_branches(id),
 po_number text not null,
 supplier_id uuid not null,
 vehicle_plate text,
 vehicle_name text,
 status text not null default 'Pending' check(status in ('Pending','Pending Review','Matched','Discrepancy','Cancelled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(branch_id,po_number),
 unique(id,branch_id),
 foreign key (supplier_id,branch_id) references public.cms_suppliers(id,branch_id)
);
create table if not exists public.cms_po_items (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.cms_purchase_orders(id) on delete cascade,
 description text not null,
 quantity numeric(12,3) not null check(quantity>0),
 unit_cost numeric(14,2) not null check(unit_cost>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.cms_reconciliations (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.cms_purchase_orders(id),
 kind text not null check(kind in ('receipt','refund')),
 amount numeric(14,2) not null check(amount>=0),
 reference text,
 status text not null default 'Pending' check(status in ('Pending','Matched','Discrepancy','Received')),
 submitted_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 replaces_id uuid references public.cms_reconciliations(id),
 created_at timestamptz not null default now()
);
create table if not exists public.cms_attachments (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.cms_purchase_orders(id),
 reconciliation_id uuid references public.cms_reconciliations(id),
 kind text not null check(kind in ('buyer_proof','cashier_receipt','refund_proof')),
 storage_path text not null unique,
 file_name text not null,
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.cms_fund_entries (
 id uuid primary key default gen_random_uuid(),
 branch_id text not null references public.cms_branches(id),
 fund text not null check(fund in ('RF','RFP')),
 kind text not null check(kind in ('income','expense','transfer','adjustment')),
 amount numeric(14,2) not null check(amount>=0),
 reference text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.cms_audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 branch_id text references public.cms_branches(id),
 entity text not null,
 entity_id text not null,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists cms_po_branch_idx on public.cms_purchase_orders(branch_id,created_at desc);
create index if not exists cms_reconciliation_po_idx on public.cms_reconciliations(po_id,created_at desc);
create index if not exists cms_audit_branch_idx on public.cms_audit_logs(branch_id,created_at desc);

-- No permissive default policies. User roles must be assigned by a trusted administrator.
-- Never authorize using user_metadata or client-supplied role/branch.
create schema if not exists cms_private;
create or replace function cms_private.can_access(target_branch text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.cms_profiles p
   where p.user_id=(select auth.uid()) and p.active
   and (p.role='admin' or p.branch_id=target_branch)
 )
$$;
create or replace function cms_private.has_role(allowed text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.cms_profiles p
   where p.user_id=(select auth.uid()) and p.active and p.role=any(allowed)
 )
$$;
revoke all on function cms_private.can_access(text) from public,anon;
revoke all on function cms_private.has_role(text[]) from public,anon;
grant usage on schema cms_private to authenticated;
grant execute on function cms_private.can_access(text),cms_private.has_role(text[]) to authenticated;

alter table public.cms_branches enable row level security;
alter table public.cms_profiles enable row level security;
alter table public.cms_suppliers enable row level security;
alter table public.cms_purchase_orders enable row level security;
alter table public.cms_po_items enable row level security;
alter table public.cms_reconciliations enable row level security;
alter table public.cms_attachments enable row level security;
alter table public.cms_fund_entries enable row level security;
alter table public.cms_audit_logs enable row level security;

create policy "branches read" on public.cms_branches for select to authenticated
 using (cms_private.can_access(id));
create policy "profile self or admin read" on public.cms_profiles for select to authenticated
 using (user_id=(select auth.uid()) or cms_private.has_role(array['admin']));
-- Profile writes intentionally disabled from browser clients.
create policy "supplier branch read" on public.cms_suppliers for select to authenticated using(cms_private.can_access(branch_id));
create policy "supplier buyer create" on public.cms_suppliers for insert to authenticated
 with check(cms_private.can_access(branch_id) and cms_private.has_role(array['pb','admin']) and created_by=(select auth.uid()));
create policy "po branch read" on public.cms_purchase_orders for select to authenticated using(cms_private.can_access(branch_id));
create policy "po buyer create" on public.cms_purchase_orders for insert to authenticated
 with check(cms_private.can_access(branch_id) and cms_private.has_role(array['pb','admin']) and created_by=(select auth.uid()));
create policy "items branch read" on public.cms_po_items for select to authenticated
 using(exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id)));
create policy "items buyer create" on public.cms_po_items for insert to authenticated
 with check(cms_private.has_role(array['pb','admin']) and exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id) and p.created_by=(select auth.uid())));
create policy "reconciliation branch read" on public.cms_reconciliations for select to authenticated
 using(exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id)));
create policy "reconciliation cashier create" on public.cms_reconciliations for insert to authenticated
 with check(cms_private.has_role(array['cashier','admin']) and submitted_by=(select auth.uid()) and exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id)));
create policy "attachments branch read" on public.cms_attachments for select to authenticated
 using(exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id)));
create policy "attachments uploader create" on public.cms_attachments for insert to authenticated
 with check(uploaded_by=(select auth.uid()) and cms_private.has_role(array['pb','cashier','admin']) and exists(select 1 from public.cms_purchase_orders p where p.id=po_id and cms_private.can_access(p.branch_id)) and ((kind='buyer_proof' and cms_private.has_role(array['pb','admin'])) or (kind in ('cashier_receipt','refund_proof') and cms_private.has_role(array['cashier','admin']))));
create policy "fund branch read" on public.cms_fund_entries for select to authenticated using(cms_private.can_access(branch_id));
create policy "fund cashier create" on public.cms_fund_entries for insert to authenticated
 with check(cms_private.can_access(branch_id) and cms_private.has_role(array['cashier','admin']) and created_by=(select auth.uid()));
create policy "audit branch read" on public.cms_audit_logs for select to authenticated
 using(cms_private.has_role(array['admin']) or (cms_private.can_access(branch_id) and cms_private.has_role(array['cashier'])));
-- Audit writes and reconciliation reviews require a trusted server-side workflow.
-- Private Storage bucket and object policies must be configured before enabling uploads.
