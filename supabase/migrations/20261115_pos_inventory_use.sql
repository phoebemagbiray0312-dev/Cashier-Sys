-- v9.56: the cashier takes parts from the live branch inventory (cms_products) for an OPEN POS.
-- Each movement remembers its POS and the product price at that moment, so Unit costs can show it.
alter table public.cms_stock_movements add column if not exists sale_pos_id text;
alter table public.cms_stock_movements add column if not exists unit_cost numeric(14,2);
create index if not exists cms_stock_movements_sale_pos_idx on public.cms_stock_movements(sale_pos_id) where sale_pos_id is not null;

create or replace function public.cms_use_stock_for_pos(p_product_id uuid, p_quantity numeric, p_pos_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := auth.uid(); v_product public.cms_products%rowtype; v_sale public.cms_sales%rowtype; v_result jsonb; v_movement uuid;
begin
  if v_actor is null or not cms_private.has_role(array['cashier','admin']) then raise exception 'Only cashier or admin can use stock for a POS'; end if;
  select * into v_product from public.cms_products where id = p_product_id;
  if not found or not cms_private.can_access(v_product.branch_id) then raise exception 'Product unavailable'; end if;
  select * into v_sale from public.cms_sales where pos_id = p_pos_id and deleted_at is null;
  if not found then raise exception 'POS not found. Save the POS first.'; end if;
  if v_sale.branch_id <> v_product.branch_id then raise exception 'Product and POS must be in the same branch'; end if;
  if v_sale.status <> 'draft' then raise exception 'This POS is closed. Use a linked transaction.'; end if;
  v_result := public.cms_record_stock_movement(p_product_id, 'issue', p_quantity,
    left('Used for ' || v_sale.reference || coalesce(' · ' || nullif(v_sale.plate, ''), '') || coalesce(' · ' || nullif(trim(p_note), ''), ''), 500), null);
  select id into v_movement from public.cms_stock_movements
    where product_id = p_product_id and performed_by = v_actor and movement_type = 'issue' and sale_pos_id is null
      and xmin::text::bigint = txid_current() order by created_at desc limit 1;
  if v_movement is null then raise exception 'Stock movement not found in this transaction'; end if;
  update public.cms_stock_movements set sale_pos_id = p_pos_id, unit_cost = nullif(v_product.unit_price, 0) where id = v_movement;
  return v_result || jsonb_build_object('movement_id', v_movement, 'pos_id', p_pos_id);
end $$;

create or replace function public.cms_return_stock_from_pos(p_movement_id uuid, p_quantity numeric)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := auth.uid(); v_out public.cms_stock_movements%rowtype; v_sale public.cms_sales%rowtype; v_returned numeric; v_result jsonb; v_movement uuid;
begin
  if v_actor is null or not cms_private.has_role(array['cashier','admin']) then raise exception 'Only cashier or admin can return stock'; end if;
  select * into v_out from public.cms_stock_movements where id = p_movement_id and movement_type = 'issue' and sale_pos_id is not null;
  if not found or not cms_private.can_access(v_out.branch_id) then raise exception 'Stock use not found'; end if;
  select * into v_sale from public.cms_sales where pos_id = v_out.sale_pos_id and deleted_at is null;
  if found and v_sale.status <> 'draft' and not cms_private.has_role(array['admin']) then raise exception 'This POS is closed. Ask Admin to correct it.'; end if;
  select coalesce(sum(quantity_delta), 0) into v_returned from public.cms_stock_movements
    where movement_type = 'receive' and sale_pos_id = v_out.sale_pos_id and transfer_group = v_out.id;
  if p_quantity is null or p_quantity <= 0 or p_quantity > (-v_out.quantity_delta - v_returned) then raise exception 'Return quantity is more than what was used'; end if;
  v_result := public.cms_record_stock_movement(v_out.product_id, 'receive', p_quantity, left('Returned from ' || coalesce(v_sale.reference, v_out.sale_pos_id), 500), null);
  select id into v_movement from public.cms_stock_movements
    where product_id = v_out.product_id and performed_by = v_actor and movement_type = 'receive' and sale_pos_id is null
      and xmin::text::bigint = txid_current() order by created_at desc limit 1;
  if v_movement is null then raise exception 'Stock movement not found in this transaction'; end if;
  update public.cms_stock_movements set sale_pos_id = v_out.sale_pos_id, unit_cost = v_out.unit_cost, transfer_group = v_out.id where id = v_movement;
  return v_result || jsonb_build_object('movement_id', v_movement);
end $$;

revoke all on function public.cms_use_stock_for_pos(uuid, numeric, text, text) from public, anon;
revoke all on function public.cms_return_stock_from_pos(uuid, numeric) from public, anon;
grant execute on function public.cms_use_stock_for_pos(uuid, numeric, text, text) to authenticated;
grant execute on function public.cms_return_stock_from_pos(uuid, numeric) to authenticated;
