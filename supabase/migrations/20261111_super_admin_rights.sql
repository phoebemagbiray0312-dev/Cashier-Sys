-- v9.29 — Super Admin-only rights: Settings, deleting records, reading the audit log.
create or replace function cms_private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cms_profiles p
    where p.user_id = (select auth.uid()) and p.active and p.role = 'admin' and p.is_super_admin)
$$;
revoke all on function cms_private.is_super_admin() from public, anon;
grant execute on function cms_private.is_super_admin() to authenticated;

-- Audit log readable by the Super Admin only; Settings by all active staff; branch records by branch.
drop policy if exists "records branch read" on public.cms_records;
create policy "records branch read" on public.cms_records for select to authenticated
  using (
    case
      when collection = 'audit' then cms_private.is_super_admin()
      when branch_id is null then (collection = 'settings' and exists (
        select 1 from public.cms_profiles p where p.user_id = (select auth.uid()) and p.active))
        or cms_private.has_role(array['admin'])
      else cms_private.can_access(branch_id) end
  );

-- Settings: Super Admin only (patch the check inside cms_save_record).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.cms_save_record(text,jsonb,integer)'::regprocedure);
  v_def := replace(v_def,
    'if not v_admin then raise exception ''REC_DENIED: Only Admin can change settings.''',
    'if not cms_private.is_super_admin() then raise exception ''REC_DENIED: Only the Super Admin can change settings.''');
  execute v_def;
end $$;

-- Deleting records: Super Admin only.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.cms_delete_record(text,text,integer)'::regprocedure);
  v_def := replace(v_def,
    'if v_uid is null or not cms_private.has_role(array[''admin'']) then
    raise exception ''REC_DENIED: Only Admin can delete records.''',
    'if v_uid is null or not cms_private.is_super_admin() then
    raise exception ''REC_DENIED: Only the Super Admin can delete records.''');
  execute v_def;
end $$;
