-- v9.26 — POS & Sales stored in Supabase
-- Adds the fields the POS screen uses to cms_sales / cms_sale_lines / cms_sale_payments
-- and two SECURITY DEFINER RPCs that are the ONLY write path for POS records:
--   cms_save_pos(p_pos jsonb, p_expected_version int)        -> {id, pos_id, version}
--   cms_delete_pos_draft(p_pos_id text, p_reason text, p_expected_version int)
-- The full browser POS object is kept in cms_sales.payload (source of truth for the app);
-- header columns, lines and payments are rewritten from it on every save for reporting.
-- Additive only: no existing column, row or table is removed.

alter table public.cms_sales
  add column if not exists pos_id text,
  add column if not exists service_type text,
  add column if not exists customer_phone text,
  add column if not exists vehicle text,
  add column if not exists plate text,
  add column if not exists plate_key text,
  add column if not exists concern text,
  add column if not exists sale_date date,
  add column if not exists closed_at timestamptz,
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists payload jsonb,
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists delete_reason text;

create unique index if not exists cms_sales_pos_id_key on public.cms_sales(pos_id);
-- A vehicle can only have ONE open POS across ALL branches (mirrors unitVisitDecision in the app,
-- which cannot see other branches' drafts once data is branch-isolated by RLS).
create unique index if not exists cms_sales_one_open_per_plate
  on public.cms_sales(plate_key) where status = 'draft' and deleted_at is null and plate_key <> '';
create index if not exists cms_sales_branch_date_idx on public.cms_sales(branch_id, sale_date desc);

alter table public.cms_sale_lines
  add column if not exists line_ref text,
  add column if not exists line_type text,
  add column if not exists unit_cost numeric not null default 0,
  add column if not exists line_total numeric not null default 0,
  add column if not exists supplier text;

alter table public.cms_sale_payments
  add column if not exists payment_ref text,
  add column if not exists paid_on date,
  add column if not exists terminal_id text,
  add column if not exists provider text;

-- Direct client writes would bypass the RPC's checks and leave payload/lines out of sync.
drop policy if exists "sales cashier create" on public.cms_sales;
drop policy if exists "sales cashier finalize own draft" on public.cms_sales;
drop policy if exists "sale lines cashier create" on public.cms_sale_lines;
drop policy if exists "payments cashier create on draft" on public.cms_sale_payments;
revoke insert, update, delete, truncate on public.cms_sales, public.cms_sale_lines, public.cms_sale_payments from anon, authenticated;
revoke select on public.cms_sales, public.cms_sale_lines, public.cms_sale_payments from anon;

create or replace function public.cms_save_pos(p_pos jsonb, p_expected_version integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := cms_private.has_role(array['admin']);
  v_pos_id text := nullif(trim(p_pos->>'id'), '');
  v_branch text := p_pos->>'branch';
  v_status text;
  v_plate text := coalesce(p_pos->>'plate', '');
  v_plate_key text := upper(regexp_replace(coalesce(p_pos->>'plate', ''), '[^A-Za-z0-9]', '', 'g'));
  v_existing public.cms_sales%rowtype;
  v_other public.cms_sales%rowtype;
  v_sale_id uuid;
  v_version integer;
  v_total numeric := 0;
  v_paid numeric := 0;
  v_line jsonb;
  v_pay jsonb;
  v_qty numeric;
  v_line_total numeric;
begin
  if v_uid is null or not cms_private.has_role(array['cashier','admin']) then
    raise exception 'POS_DENIED: Only cashier or admin accounts can save POS records.' using errcode = '42501';
  end if;
  if v_pos_id is null or coalesce(p_pos->>'no', '') = '' then
    raise exception 'POS_INVALID: POS id and number are required.' using errcode = '22023';
  end if;
  if v_branch is null or not cms_private.can_access(v_branch) then
    raise exception 'POS_DENIED: You cannot save POS records for branch %.', coalesce(v_branch, '(none)') using errcode = '42501';
  end if;
  if jsonb_typeof(p_pos->'items') is distinct from 'array' or jsonb_typeof(p_pos->'payments') is distinct from 'array' then
    raise exception 'POS_INVALID: items and payments must be lists.' using errcode = '22023';
  end if;
  v_status := case p_pos->>'status' when 'Closed' then 'completed' when 'Pending' then 'draft' else null end;
  if v_status is null then
    raise exception 'POS_INVALID: Unknown POS status %.', p_pos->>'status' using errcode = '22023';
  end if;

  select * into v_existing from public.cms_sales where pos_id = v_pos_id for update;
  if found then
    if not cms_private.can_access(v_existing.branch_id) then
      raise exception 'POS_DENIED: This POS belongs to another branch.' using errcode = '42501';
    end if;
    if v_existing.deleted_at is not null then
      raise exception 'POS_CONFLICT: % was deleted on another device.', v_existing.reference using errcode = '40001';
    end if;
    if p_expected_version is not null and v_existing.version <> p_expected_version then
      raise exception 'POS_CONFLICT: % was changed on another device. Reload to see the latest version.', v_existing.reference using errcode = '40001';
    end if;
    if v_existing.branch_id <> v_branch then
      raise exception 'POS_INVALID: A POS cannot be moved to another branch.' using errcode = '22023';
    end if;
    if v_existing.status = 'completed' and v_status = 'draft' and not v_is_admin then
      raise exception 'POS_DENIED: Closed POS % cannot be reopened.', v_existing.reference using errcode = '42501';
    end if;
  end if;

  if v_status = 'draft' and v_plate_key <> '' then
    select * into v_other from public.cms_sales
      where plate_key = v_plate_key and status = 'draft' and deleted_at is null and pos_id <> v_pos_id
      limit 1;
    if found then
      raise exception 'POS_PLATE_OPEN: Unit % has an OPEN POS (%) at %. That branch must close it first.',
        v_plate_key, v_other.reference, v_other.branch_id using errcode = '23505';
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_pos->'items') loop
    v_qty := coalesce((v_line->>'qty')::numeric, 0);
    v_line_total := coalesce((v_line->>'lineTotal')::numeric, round(v_qty * coalesce((v_line->>'price')::numeric, 0), 2));
    v_total := v_total + v_line_total;
  end loop;
  v_total := round(v_total, 2);
  for v_pay in select * from jsonb_array_elements(p_pos->'payments') loop
    v_paid := v_paid + coalesce((v_pay->>'amount')::numeric, 0);
  end loop;

  if v_existing.id is null then
    insert into public.cms_sales (branch_id, reference, customer_name, status, total_amount, created_by,
      pos_id, service_type, customer_phone, vehicle, plate, plate_key, concern, sale_date, closed_at,
      paid_amount, payload, version, updated_at, updated_by)
    values (v_branch, p_pos->>'no', nullif(p_pos->>'client', ''), v_status, greatest(v_total, 0), v_uid,
      v_pos_id, p_pos->>'serviceType', p_pos->>'phone', p_pos->>'vehicle', v_plate, v_plate_key, p_pos->>'concern',
      nullif(p_pos->>'date', '')::date, nullif(p_pos->>'closedAt', '')::timestamptz,
      v_paid, p_pos, 1, now(), v_uid)
    returning id, version into v_sale_id, v_version;
  else
    update public.cms_sales set
      reference = p_pos->>'no', customer_name = nullif(p_pos->>'client', ''), status = v_status,
      total_amount = greatest(v_total, 0), service_type = p_pos->>'serviceType', customer_phone = p_pos->>'phone',
      vehicle = p_pos->>'vehicle', plate = v_plate, plate_key = v_plate_key, concern = p_pos->>'concern',
      sale_date = nullif(p_pos->>'date', '')::date, closed_at = nullif(p_pos->>'closedAt', '')::timestamptz,
      paid_amount = v_paid, payload = p_pos, version = v_existing.version + 1, updated_at = now(), updated_by = v_uid
    where id = v_existing.id
    returning id, version into v_sale_id, v_version;
  end if;

  delete from public.cms_sale_lines where sale_id = v_sale_id;
  insert into public.cms_sale_lines (sale_id, product_id, description, quantity, unit_price,
    line_ref, line_type, unit_cost, line_total, supplier)
  select v_sale_id, null, coalesce(nullif(l->>'name', ''), '(item)'), (l->>'qty')::numeric,
    greatest(coalesce((l->>'price')::numeric, 0), 0), l->>'id', l->>'type',
    coalesce((l->>'cost')::numeric, 0),
    coalesce((l->>'lineTotal')::numeric, round((l->>'qty')::numeric * coalesce((l->>'price')::numeric, 0), 2)),
    l->>'supplier'
  from jsonb_array_elements(p_pos->'items') l
  where coalesce((l->>'qty')::numeric, 0) > 0;

  delete from public.cms_sale_payments where sale_id = v_sale_id;
  insert into public.cms_sale_payments (sale_id, method, amount, reference, received_by,
    payment_ref, paid_on, terminal_id, provider)
  select v_sale_id,
    case x->>'mode' when 'Cash' then 'cash' when 'GCash' then 'gcash' when 'Bank Transfer' then 'bank_transfer'
      when 'Card' then 'card' else 'other' end,
    (x->>'amount')::numeric, x->>'reference', v_uid, x->>'id', nullif(x->>'date', '')::date,
    x->>'terminalId', x->>'provider'
  from jsonb_array_elements(p_pos->'payments') x
  where coalesce((x->>'amount')::numeric, 0) > 0;

  return jsonb_build_object('id', v_sale_id, 'pos_id', v_pos_id, 'version', v_version);
end;
$$;

create or replace function public.cms_delete_pos_draft(p_pos_id text, p_reason text, p_expected_version integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.cms_sales%rowtype;
begin
  if v_uid is null or not cms_private.has_role(array['cashier','admin']) then
    raise exception 'POS_DENIED: Only cashier or admin accounts can delete POS drafts.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'POS_INVALID: A deletion reason is required.' using errcode = '22023';
  end if;
  select * into v_existing from public.cms_sales where pos_id = p_pos_id for update;
  if not found then
    return jsonb_build_object('pos_id', p_pos_id, 'deleted', false);
  end if;
  if not cms_private.can_access(v_existing.branch_id) then
    raise exception 'POS_DENIED: This POS belongs to another branch.' using errcode = '42501';
  end if;
  if v_existing.deleted_at is not null then
    return jsonb_build_object('pos_id', p_pos_id, 'deleted', true, 'version', v_existing.version);
  end if;
  if p_expected_version is not null and v_existing.version <> p_expected_version then
    raise exception 'POS_CONFLICT: % was changed on another device. Reload first.', v_existing.reference using errcode = '40001';
  end if;
  if v_existing.status <> 'draft' then
    raise exception 'POS_DENIED: Only open drafts can be deleted.' using errcode = '42501';
  end if;
  update public.cms_sales set status = 'void', deleted_at = now(), deleted_by = v_uid,
    delete_reason = trim(p_reason), version = version + 1, updated_at = now(), updated_by = v_uid
  where id = v_existing.id;
  return jsonb_build_object('pos_id', p_pos_id, 'deleted', true, 'version', v_existing.version + 1);
end;
$$;

revoke all on function public.cms_save_pos(jsonb, integer) from public, anon;
revoke all on function public.cms_delete_pos_draft(text, text, integer) from public, anon;
grant execute on function public.cms_save_pos(jsonb, integer) to authenticated;
grant execute on function public.cms_delete_pos_draft(text, text, integer) to authenticated;
