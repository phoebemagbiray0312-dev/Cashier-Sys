-- v9.28 — Remaining browser records move to Supabase.
-- One table holds each record as JSON (the app's own object), keyed by (collection, id),
-- with branch isolation, role rules and version checks enforced by cms_save_record / cms_delete_record.
create table if not exists public.cms_records (
  collection text not null,
  id text not null,
  branch_id text references public.cms_branches(id),
  payload jsonb not null,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  primary key (collection, id),
  constraint cms_records_collection_check check (collection in (
    'fundEntries','disbursementRequests','counts','turnovers','incidents','requests',
    'terminalEvents','terminalSettlements','stockRequests','stockReceipts','stockIssues','audit','settings'))
);
create index if not exists cms_records_branch_idx on public.cms_records(branch_id, collection);

alter table public.cms_records enable row level security;
drop policy if exists "records branch read" on public.cms_records;
create policy "records branch read" on public.cms_records for select to authenticated
  using (
    case when branch_id is null
      then (collection = 'settings' and exists (select 1 from public.cms_profiles p where p.user_id = (select auth.uid()) and p.active))
        or cms_private.has_role(array['admin'])
      else cms_private.can_access(branch_id) end
  );
revoke all on public.cms_records from anon;
revoke insert, update, delete, truncate on public.cms_records from authenticated;
grant select on public.cms_records to authenticated;

create or replace function public.cms_save_record(p_collection text, p_record jsonb, p_expected_version integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := cms_private.has_role(array['admin']);
  v_id text := nullif(trim(coalesce(p_record->>'id', case when p_collection = 'settings' then 'settings' end)), '');
  v_branch text := nullif(p_record->>'branch', '');
  v_existing public.cms_records%rowtype;
  v_version integer;
  v_decided text[] := array['Approved','Rejected','Verified','Flagged','Reviewed','Returned'];
begin
  if v_uid is null or not cms_private.has_role(array['admin','cashier','pb']) then
    raise exception 'REC_DENIED: Sign in with an active staff account.' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'REC_INVALID: Record id is required.' using errcode = '22023';
  end if;
  if p_collection = 'settings' then
    if not v_admin then raise exception 'REC_DENIED: Only Admin can change settings.' using errcode = '42501'; end if;
    v_branch := null;
  elsif p_collection = 'audit' then
    v_branch := null;
  elsif v_branch is null or not cms_private.can_access(v_branch) then
    raise exception 'REC_DENIED: You cannot save records for branch %.', coalesce(v_branch, '(none)') using errcode = '42501';
  end if;

  select * into v_existing from public.cms_records where collection = p_collection and id = v_id for update;
  if found then
    if v_existing.deleted_at is not null then
      raise exception 'REC_CONFLICT: This record was deleted on another device.' using errcode = '40001';
    end if;
    if p_collection = 'audit' then
      return jsonb_build_object('id', v_id, 'version', v_existing.version); -- audit is append-only
    end if;
    if v_existing.branch_id is not null and not cms_private.can_access(v_existing.branch_id) then
      raise exception 'REC_DENIED: This record belongs to another branch.' using errcode = '42501';
    end if;
    if p_expected_version is not null and v_existing.version <> p_expected_version then
      raise exception 'REC_CONFLICT: This record was changed on another device. Reloading the latest copy.' using errcode = '40001';
    end if;
    if not v_admin and v_existing.branch_id is distinct from v_branch then
      raise exception 'REC_DENIED: Only Admin can move a record to another branch.' using errcode = '42501';
    end if;
    if not v_admin and (
      (p_record->>'status' = any(v_decided) and p_record->>'status' is distinct from v_existing.payload->>'status')
      or (p_record->>'accountingStatus' is distinct from v_existing.payload->>'accountingStatus' and p_record->>'accountingStatus' = any(v_decided))
      or (p_record->>'presidentStatus' is distinct from v_existing.payload->>'presidentStatus' and p_record->>'presidentStatus' = any(v_decided))
    ) then
      raise exception 'REC_DENIED: Only Admin can approve, reject or verify records.' using errcode = '42501';
    end if;
    update public.cms_records set payload = p_record, branch_id = v_branch, version = version + 1,
      updated_by = v_uid, updated_at = now()
    where collection = p_collection and id = v_id
    returning version into v_version;
  else
    if not v_admin and (p_record->>'status' = any(v_decided)
        or p_record->>'accountingStatus' = any(v_decided) or p_record->>'presidentStatus' = any(v_decided)) then
      raise exception 'REC_DENIED: Only Admin can create approved, rejected or verified records.' using errcode = '42501';
    end if;
    insert into public.cms_records (collection, id, branch_id, payload, created_by, updated_by)
    values (p_collection, v_id, v_branch, p_record, v_uid, v_uid)
    returning version into v_version;
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create or replace function public.cms_delete_record(p_collection text, p_id text, p_expected_version integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.cms_records%rowtype;
begin
  if v_uid is null or not cms_private.has_role(array['admin']) then
    raise exception 'REC_DENIED: Only Admin can delete records.' using errcode = '42501';
  end if;
  if p_collection in ('audit','settings') then
    raise exception 'REC_DENIED: % records cannot be deleted.', p_collection using errcode = '42501';
  end if;
  select * into v_existing from public.cms_records where collection = p_collection and id = p_id for update;
  if not found or v_existing.deleted_at is not null then
    return jsonb_build_object('id', p_id, 'deleted', true);
  end if;
  if p_expected_version is not null and v_existing.version <> p_expected_version then
    raise exception 'REC_CONFLICT: This record was changed on another device. Reloading the latest copy.' using errcode = '40001';
  end if;
  update public.cms_records set deleted_at = now(), deleted_by = v_uid, version = version + 1, updated_at = now(), updated_by = v_uid
  where collection = p_collection and id = p_id;
  return jsonb_build_object('id', p_id, 'deleted', true, 'version', v_existing.version + 1);
end;
$$;

revoke all on function public.cms_save_record(text, jsonb, integer) from public, anon;
revoke all on function public.cms_delete_record(text, text, integer) from public, anon;
grant execute on function public.cms_save_record(text, jsonb, integer) to authenticated;
grant execute on function public.cms_delete_record(text, text, integer) to authenticated;
