-- v9.30 — One supplier master list in Supabase (replaces the browser-only supplier catalog).
alter table public.cms_suppliers
  add column if not exists status text not null default 'For Review',
  add column if not exists created_by_name text,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;
alter table public.cms_suppliers drop constraint if exists cms_suppliers_status_check;
alter table public.cms_suppliers add constraint cms_suppliers_status_check check (status in ('For Review','Verified','Flagged'));
create unique index if not exists cms_suppliers_name_key on public.cms_suppliers (upper(regexp_replace(trim(name), '\s+', ' ', 'g')));

-- Suppliers serve every branch: all active staff can read the master list.
drop policy if exists "supplier branch read" on public.cms_suppliers;
drop policy if exists "supplier staff read" on public.cms_suppliers;
create policy "supplier staff read" on public.cms_suppliers for select to authenticated
  using (exists (select 1 from public.cms_profiles p where p.user_id = (select auth.uid()) and p.active));

create table if not exists public.cms_supplier_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.cms_suppliers(id) on delete cascade,
  name text not null,
  price numeric check (price is null or price >= 0),
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists cms_supplier_items_name_key on public.cms_supplier_items (supplier_id, upper(trim(name)));
alter table public.cms_supplier_items enable row level security;
drop policy if exists "supplier items staff read" on public.cms_supplier_items;
create policy "supplier items staff read" on public.cms_supplier_items for select to authenticated
  using (exists (select 1 from public.cms_profiles p where p.user_id = (select auth.uid()) and p.active));
revoke all on public.cms_supplier_items from anon;
revoke insert, update, delete, truncate on public.cms_supplier_items from authenticated;
grant select on public.cms_supplier_items to authenticated;

create or replace function public.cms_add_supplier(p_name text, p_contact text, p_branch text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text := upper(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
  v_admin boolean := cms_private.has_role(array['admin']); v_id uuid; v_by text;
begin
  if v_uid is null or not cms_private.has_role(array['pb','admin']) then
    raise exception 'SUP_DENIED: Only Parts Buyer or Admin may add suppliers.' using errcode = '42501'; end if;
  if v_name = '' or length(trim(coalesce(p_contact,''))) = 0 then
    raise exception 'SUP_INVALID: Supplier name and contact are required.' using errcode = '22023'; end if;
  if not cms_private.can_access(p_branch) then
    raise exception 'SUP_DENIED: You cannot submit suppliers for branch %.', p_branch using errcode = '42501'; end if;
  if exists (select 1 from public.cms_suppliers s where upper(regexp_replace(trim(s.name), '\s+', ' ', 'g')) = v_name) then
    raise exception 'SUP_DUPLICATE: Supplier % already exists.', v_name using errcode = '23505'; end if;
  select display_name into v_by from public.cms_profiles where user_id = v_uid;
  insert into public.cms_suppliers (branch_id, name, contact, created_by, created_by_name, status, reviewed_by, reviewed_at)
  values (p_branch, v_name, trim(p_contact), v_uid, v_by, case when v_admin then 'Verified' else 'For Review' end,
          case when v_admin then v_uid end, case when v_admin then now() end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cms_review_supplier(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not cms_private.has_role(array['admin']) then
    raise exception 'SUP_DENIED: Only Admin can approve or flag suppliers.' using errcode = '42501'; end if;
  update public.cms_suppliers set status = case when p_approve then 'Verified' else 'Flagged' end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  if not found then raise exception 'SUP_INVALID: Supplier not found.' using errcode = '22023'; end if;
end $$;

create or replace function public.cms_add_supplier_item(p_supplier_id uuid, p_name text, p_price numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_by text;
begin
  if v_uid is null or not cms_private.has_role(array['pb','admin']) then
    raise exception 'SUP_DENIED: Only Parts Buyer or Admin may add catalog items.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name,''))) = 0 or (p_price is not null and p_price < 0) then
    raise exception 'SUP_INVALID: Enter an item name and a valid non-negative price.' using errcode = '22023'; end if;
  if exists (select 1 from public.cms_supplier_items i where i.supplier_id = p_supplier_id and upper(trim(i.name)) = upper(trim(p_name))) then
    raise exception 'SUP_DUPLICATE: This item is already in the supplier catalog.' using errcode = '23505'; end if;
  select display_name into v_by from public.cms_profiles where user_id = v_uid;
  insert into public.cms_supplier_items (supplier_id, name, price, created_by, created_by_name)
  values (p_supplier_id, trim(p_name), p_price, v_uid, v_by) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.cms_add_supplier(text,text,text) from public, anon;
revoke all on function public.cms_review_supplier(uuid,boolean) from public, anon;
revoke all on function public.cms_add_supplier_item(uuid,text,numeric) from public, anon;
grant execute on function public.cms_add_supplier(text,text,text) to authenticated;
grant execute on function public.cms_review_supplier(uuid,boolean) to authenticated;
grant execute on function public.cms_add_supplier_item(uuid,text,numeric) to authenticated;

-- Seed the original UCQC supplier list (previously hard-coded in the page) as Verified.
insert into public.cms_suppliers (branch_id, name, contact, status, created_by_name)
select 'UCQC', s.name, s.contact, 'Verified', 'Imported UCQC list'
from (values ('TOYOSCO','09778490850 / 09298780461'),('THUNDER','09255986464 / 09228133077'),('RJC AUTO PARTS','09778014246'),
  ('KJL AUTO PARTS','09178988863'),('EURO AUTO PARTS','09228227727'),('FAST DELIVERY','09165629827'),('ECSF','09166879608'),
  ('BENZLAND','09174130169'),('HONDA CARS QC','09189929364'),('JC EMERALD','09190641869'),('BANAWE CENTER','09362529700'),
  ('JANICE AUTO SUPPLY','09270057862'),('JZVC BANAWE','09562984945')) as s(name, contact)
where not exists (select 1 from public.cms_suppliers x where upper(x.name) = s.name);
