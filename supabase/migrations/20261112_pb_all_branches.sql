-- v9.41 — The Parts Buyer runs ONE RFP fund for every branch (UC + Mastermind), so a PB profile may
-- have no branch (= all branches). cms_private.can_access already treats a PB with no branch as all-branch.
alter table public.cms_profiles drop constraint cms_profiles_check;
alter table public.cms_profiles add constraint cms_profiles_check
  check (role in ('admin','pb') or branch_id is not null);
