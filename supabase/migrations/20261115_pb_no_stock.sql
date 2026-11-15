-- v9.55: stock in and stock out are done by the branch cashier (and Admin); PB only pays suppliers.
create or replace function cms_private.apply_stock_movement(p_product_id uuid, p_kind text, p_quantity numeric, p_reason text, p_destination_branch text default null::text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
 v_actor uuid := (select auth.uid());
 v_product public.cms_products%rowtype;
 v_target public.cms_products%rowtype;
 v_delta numeric(14,3);
 v_after numeric(14,3);
 v_transfer uuid;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('receive','issue','adjust','transfer') then raise exception 'Invalid stock operation'; end if;
 if p_quantity is null or p_quantity=0 or p_quantity<>round(p_quantity,3) or abs(p_quantity)>100000000 then raise exception 'Invalid quantity'; end if;
 if p_reason is null or length(trim(p_reason))<3 or length(p_reason)>500 then raise exception 'Reason must be 3 to 500 characters'; end if;
 if p_kind in ('receive','issue','transfer') and p_quantity<=0 then raise exception 'Quantity must be positive'; end if;
 if p_kind in ('adjust','transfer') then
   if not cms_private.has_role(array['admin']) then raise exception 'Admin permission required'; end if;
 elsif p_kind='receive' then
   if not cms_private.has_role(array['admin','cashier']) then raise exception 'Receiving permission required'; end if;
 else
   if not cms_private.has_role(array['admin','cashier']) then raise exception 'Issuance permission required'; end if;
 end if;
 select * into v_product from public.cms_products where id=p_product_id for update;
 if not found or not cms_private.can_access(v_product.branch_id) then raise exception 'Product unavailable'; end if;
 if p_kind='transfer' then
   if p_destination_branch is null or p_destination_branch=v_product.branch_id then raise exception 'Invalid destination'; end if;
   if not exists(select 1 from public.cms_branches where id=p_destination_branch) then raise exception 'Unknown destination'; end if;
   select * into v_target from public.cms_products
   where branch_id=p_destination_branch and sku=v_product.sku for update;
   if not found then raise exception 'Destination branch must already have a matching SKU'; end if;
   if v_product.stock_qty<p_quantity then raise exception 'Insufficient stock'; end if;
   v_transfer:=gen_random_uuid();
   update public.cms_products set stock_qty=stock_qty-p_quantity where id=v_product.id;
   update public.cms_products set stock_qty=stock_qty+p_quantity where id=v_target.id;
   insert into public.cms_stock_movements(product_id,branch_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,transfer_group,performed_by)
   values
   (v_product.id,v_product.branch_id,'transfer_out',-p_quantity,v_product.stock_qty,v_product.stock_qty-p_quantity,trim(p_reason),v_transfer,v_actor),
   (v_target.id,v_target.branch_id,'transfer_in',p_quantity,v_target.stock_qty,v_target.stock_qty+p_quantity,trim(p_reason),v_transfer,v_actor);
   return jsonb_build_object('operation','transfer','transfer_id',v_transfer,'source_quantity',v_product.stock_qty-p_quantity,'destination_quantity',v_target.stock_qty+p_quantity);
 end if;
 v_delta:=case when p_kind='issue' then -p_quantity else p_quantity end;
 v_after:=v_product.stock_qty+v_delta;
 if v_after<0 then raise exception 'Insufficient stock'; end if;
 update public.cms_products set stock_qty=v_after where id=v_product.id;
 insert into public.cms_stock_movements(product_id,branch_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,performed_by)
 values(v_product.id,v_product.branch_id,p_kind,v_delta,v_product.stock_qty,v_after,trim(p_reason),v_actor);
 return jsonb_build_object('operation',p_kind,'product_id',v_product.id,'quantity_before',v_product.stock_qty,'quantity_after',v_after);
end $function$;
