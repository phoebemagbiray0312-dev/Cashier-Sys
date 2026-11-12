-- v9.38 — Stock Transfer: let any active staff see which items other UC branches can send.
-- Products RLS keeps cashiers/PB to their own branch, so the transfer picker could not list
-- other branches. This read-only function returns only sku, name, branch and quantity.
create or replace function public.cms_transfer_catalog()
returns table(sku text, name text, branch_id text, stock_qty numeric)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not cms_private.has_role(array['admin','cashier','pb']) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.sku::text, p.name::text, p.branch_id::text, p.stock_qty::numeric
    from public.cms_products p
    where p.branch_id in ('UCM','UCQC','UCLP')
    order by p.name;
end $$;

revoke all on function public.cms_transfer_catalog() from public, anon;
grant execute on function public.cms_transfer_catalog() to authenticated;
