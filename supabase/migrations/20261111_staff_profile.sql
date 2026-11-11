-- v9.31 — Staff can edit their own display name and profile picture.
alter table public.cms_profiles add column if not exists avatar_url text;

-- Public-read bucket for small profile pictures; each user may only write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Only the signed-in user's own name/picture can change; role, branch and status stay Admin-controlled.
create or replace function public.cms_update_my_profile(p_display_name text, p_avatar_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text := regexp_replace(trim(coalesce(p_display_name,'')), '\s+', ' ', 'g');
begin
  if v_uid is null or not exists (select 1 from public.cms_profiles where user_id = v_uid and active) then
    raise exception 'PRO_DENIED: Sign in with an active staff account.' using errcode = '42501'; end if;
  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'PRO_INVALID: Name must contain 2–100 characters.' using errcode = '22023'; end if;
  if p_avatar_url is not null and p_avatar_url !~ ('/storage/v1/object/public/avatars/' || v_uid::text || '/') then
    raise exception 'PRO_INVALID: Profile picture must be uploaded to your own folder.' using errcode = '22023'; end if;
  update public.cms_profiles set display_name = v_name, avatar_url = p_avatar_url where user_id = v_uid;
end $$;
revoke all on function public.cms_update_my_profile(text,text) from public, anon;
grant execute on function public.cms_update_my_profile(text,text) to authenticated;
