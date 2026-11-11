-- Archived structure + data of the unused legacy cs_* tables, dropped on 2026-11-11 (v9.28.2).
-- They were empty (except 4 branch rows duplicated in cms_branches) and unused by any code.
-- To restore, run this file in the Supabase SQL Editor (tables are created in dependency order).
create table public.cs_branches (
  code text not null,
  name text not null,
  company text not null,
  constraint cs_branches_code_check CHECK ((code = ANY (ARRAY['UCQC'::text, 'UCM'::text, 'UCLP'::text, 'MMM'::text]))),
  constraint cs_branches_pkey PRIMARY KEY (code)
);
insert into public.cs_branches (code, name, company) values
  ('UCQC','UC Quezon City','Underchargers'),('UCM','UC Mandaluyong','Underchargers'),
  ('UCLP','UC Las Piñas','Underchargers'),('MMM','MM Mandaluyong','Mastermind Autoworks');

create table public.cs_staff (
  user_id uuid not null,
  display_name text not null,
  role text not null,
  branch_code text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint cs_staff_branch_code_fkey FOREIGN KEY (branch_code) REFERENCES cs_branches(code),
  constraint cs_staff_pkey PRIMARY KEY (user_id),
  constraint cs_staff_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'cashier'::text, 'pb'::text]))),
  constraint cs_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

create table public.cs_suppliers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamp with time zone not null default now(),
  constraint cs_suppliers_pkey PRIMARY KEY (id)
);

create table public.cs_purchase_orders (
  id uuid not null default gen_random_uuid(),
  po_number text not null,
  supplier_id uuid not null,
  branch_code text not null,
  plate_number text,
  pos_reference text,
  status text not null default 'Draft'::text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint cs_purchase_orders_branch_code_fkey FOREIGN KEY (branch_code) REFERENCES cs_branches(code),
  constraint cs_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint cs_purchase_orders_pkey PRIMARY KEY (id),
  constraint cs_purchase_orders_po_number_key UNIQUE (po_number),
  constraint cs_purchase_orders_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Submitted'::text, 'Received'::text, 'Cancelled'::text]))),
  constraint cs_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES cs_suppliers(id)
);

create table public.cs_purchase_order_lines (
  id uuid not null default gen_random_uuid(),
  purchase_order_id uuid not null,
  description text not null,
  quantity numeric(12,2) not null,
  unit_cost numeric(14,2) not null,
  constraint cs_purchase_order_lines_pkey PRIMARY KEY (id),
  constraint cs_purchase_order_lines_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES cs_purchase_orders(id),
  constraint cs_purchase_order_lines_quantity_check CHECK ((quantity > (0)::numeric)),
  constraint cs_purchase_order_lines_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);

create table public.cs_purchase_payments (
  id uuid not null default gen_random_uuid(),
  purchase_order_id uuid not null,
  amount numeric(14,2) not null,
  payment_method text not null,
  reference_number text,
  receipt_path text,
  paid_at timestamp with time zone not null default now(),
  recorded_by uuid,
  constraint cs_purchase_payments_amount_check CHECK ((amount > (0)::numeric)),
  constraint cs_purchase_payments_pkey PRIMARY KEY (id),
  constraint cs_purchase_payments_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES cs_purchase_orders(id),
  constraint cs_purchase_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id)
);

create table public.cs_audit_events (
  id bigint not null,
  actor_id uuid,
  branch_code text,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint cs_audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id),
  constraint cs_audit_events_branch_code_fkey FOREIGN KEY (branch_code) REFERENCES cs_branches(code),
  constraint cs_audit_events_pkey PRIMARY KEY (id)
);

alter table public.cs_branches enable row level security;
alter table public.cs_staff enable row level security;
alter table public.cs_suppliers enable row level security;
alter table public.cs_purchase_orders enable row level security;
alter table public.cs_purchase_order_lines enable row level security;
alter table public.cs_purchase_payments enable row level security;
alter table public.cs_audit_events enable row level security;
