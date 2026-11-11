-- v9.32 — Edit supplier name/contact. Admin: any supplier. Parts Buyer: only their own suppliers still For Review.
create or replace function public.cms_update_supplier(p_id uuid, p_name text, p_contact text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.cms_suppliers%rowtype;
  v_name text := upper(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
begin
  if v_uid is null or not cms_private.has_role(array['pb','admin']) then
    raise exception 'SUP_DENIED: Only Parts Buyer or Admin may edit suppliers.' using errcode = '42501'; end if;
  select * into v_row from public.cms_suppliers where id = p_id for update;
  if not found then raise exception 'SUP_INVALID: Supplier not found.' using errcode = '22023'; end if;
  if not cms_private.has_role(array['admin']) and not (v_row.created_by = v_uid and v_row.status = 'For Review') then
    raise exception 'SUP_DENIED: Parts Buyers can only edit their own suppliers that are still For Review.' using errcode = '42501'; end if;
  if v_name = '' or length(trim(coalesce(p_contact,''))) = 0 then
    raise exception 'SUP_INVALID: Supplier name and contact are required.' using errcode = '22023'; end if;
  if exists (select 1 from public.cms_suppliers s where s.id <> p_id and upper(regexp_replace(trim(s.name), '\s+', ' ', 'g')) = v_name) then
    raise exception 'SUP_DUPLICATE: Supplier % already exists.', v_name using errcode = '23505'; end if;
  update public.cms_suppliers set name = v_name, contact = trim(p_contact) where id = p_id;
end $$;
revoke all on function public.cms_update_supplier(uuid,text,text) from public, anon;
grant execute on function public.cms_update_supplier(uuid,text,text) to authenticated;
