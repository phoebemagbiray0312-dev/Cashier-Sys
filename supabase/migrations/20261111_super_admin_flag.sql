-- v9.27 — Super Admin flag. Role stays 'admin' so every existing admin check keeps working;
-- only the staff API reads is_super_admin to decide who may create/edit/deactivate Admin accounts.
alter table public.cms_profiles add column if not exists is_super_admin boolean not null default false;
alter table public.cms_profiles drop constraint if exists cms_profiles_super_admin_is_admin;
alter table public.cms_profiles add constraint cms_profiles_super_admin_is_admin check (not is_super_admin or role = 'admin');
-- The original System Admin becomes the Super Admin.
update public.cms_profiles set is_super_admin = true where user_id = '4ef6e4ef-196a-47c2-9e87-003edac0c8e3' and role = 'admin';
-- Profiles are only written by the server-side staff API (service role).
revoke insert, update, delete, truncate on public.cms_profiles from anon, authenticated;
