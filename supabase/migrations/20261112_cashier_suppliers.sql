-- v9.39 — Cashiers are front-line and receive supplier receipts, so they may add suppliers
-- (always For Review until Admin approves), add catalog items, and edit their own For Review suppliers.
create or replace function public.cms_add_supplier(p_name text, p_contact text, p_branch text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_uid uuid := auth.uid(); v_name text := upper(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
  v_admin boolean := cms_private.has_role(array['admin']); v_id uuid; v_by text;
begin
  if v_uid is null or not cms_private.has_role(array['cashier','pb','admin']) then
    raise exception 'SUP_DENIED: Only staff accounts may add suppliers.' using errcode = '42501'; end if;
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
end $function$;

create or replace function public.cms_add_supplier_item(p_supplier_id uuid, p_name text, p_price numeric)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_uid uuid := auth.uid(); v_id uuid; v_by text;
begin
  if v_uid is null or not cms_private.has_role(array['cashier','pb','admin']) then
    raise exception 'SUP_DENIED: Only staff accounts may add catalog items.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name,''))) = 0 or (p_price is not null and p_price < 0) then
    raise exception 'SUP_INVALID: Enter an item name and a valid non-negative price.' using errcode = '22023'; end if;
  if exists (select 1 from public.cms_supplier_items i where i.supplier_id = p_supplier_id and upper(trim(i.name)) = upper(trim(p_name))) then
    raise exception 'SUP_DUPLICATE: This item is already in the supplier catalog.' using errcode = '23505'; end if;
  select display_name into v_by from public.cms_profiles where user_id = v_uid;
  insert into public.cms_supplier_items (supplier_id, name, price, created_by, created_by_name)
  values (p_supplier_id, trim(p_name), p_price, v_uid, v_by) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.cms_update_supplier(p_id uuid, p_name text, p_contact text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_uid uuid := auth.uid(); v_row public.cms_suppliers%rowtype;
  v_name text := upper(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
begin
  if v_uid is null or not cms_private.has_role(array['cashier','pb','admin']) then
    raise exception 'SUP_DENIED: Only staff accounts may edit suppliers.' using errcode = '42501'; end if;
  select * into v_row from public.cms_suppliers where id = p_id for update;
  if not found then raise exception 'SUP_INVALID: Supplier not found.' using errcode = '22023'; end if;
  if not cms_private.has_role(array['admin']) and not (v_row.created_by = v_uid and v_row.status = 'For Review') then
    raise exception 'SUP_DENIED: You can only edit suppliers you submitted that are still For Review.' using errcode = '42501'; end if;
  if v_name = '' or length(trim(coalesce(p_contact,''))) = 0 then
    raise exception 'SUP_INVALID: Supplier name and contact are required.' using errcode = '22023'; end if;
  if exists (select 1 from public.cms_suppliers s where s.id <> p_id and upper(regexp_replace(trim(s.name), '\s+', ' ', 'g')) = v_name) then
    raise exception 'SUP_DUPLICATE: Supplier % already exists.', v_name using errcode = '23505'; end if;
  update public.cms_suppliers set name = v_name, contact = trim(p_contact) where id = p_id;
end $function$;
