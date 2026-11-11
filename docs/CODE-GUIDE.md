# Code Guide — Saan makikita ang code (v9.26 – v9.28)

Gabay ito sa mga binago noong **Nov 9–11, 2026** para makita mo kung saan nakalagay ang bawat bahagi ng system.
Puwede mong buksan ang bawat file sa GitHub: `https://github.com/phoebemagbiray0312-dev/Cashier-Sys/blob/main/<path>`

> **Tip:** Sa GitHub, pindutin ang `t` sa repo page para mag-search ng file, o `y` para makuha ang permanent link. Sa VS Code, `Ctrl/Cmd + P` para buksan ang file at `Ctrl/Cmd + G` para pumunta sa line number.

---

## Paano gumagana ang system ngayon (malaking larawan)

```
Browser (app/page.tsx)
   │  nag-login → app/api/auth/username-login/route.ts → Supabase Auth
   │
   ├─ POS & Sales ────────► lib/pos-sync.ts ───────► RPC cms_save_pos / cms_delete_pos_draft ─► table cms_sales (+ lines, payments)
   ├─ Funds, counts, ... ─► lib/record-sync.ts ────► RPC cms_save_record / cms_delete_record ─► table cms_records
   ├─ Inventory ──────────► components/OnlineInventoryWorkspace.tsx ─► cms_products, cms_stock_movements
   └─ Staff accounts ─────► components/StaffManagement.tsx ─► app/api/admin/staff/route.ts ─► cms_profiles + Supabase Auth
```

- **Ang browser ay "cache" na lang.** Ang totoong data ay nasa Supabase. Pag-login, kinukuha ng app ang data mula sa Supabase; bawat pagbabago ay ipinapadala pabalik.
- **Ang mga patakaran (sino ang puwede gumawa ng ano) ay nasa database functions (RPC)**, hindi sa browser — kaya hindi malulusutan kahit baguhin ang code sa browser.

---

## 1. POS & Sales sa Supabase — v9.26 (commit `b444838`)

| Ano | Saan |
|---|---|
| Database: dagdag na columns + patakaran | `supabase/migrations/20261109_pos_online_sales.sql` |
| ├ Pag-save ng POS (role, branch, isang open POS kada plate, version check) | same file, line ~57 → `cms_save_pos` |
| └ Pag-delete ng draft (soft delete, may dahilan) | same file, line ~184 → `cms_delete_pos_draft` |
| App: pag-load at pag-save ng POS | `lib/pos-sync.ts` → `loadRemotePOS` (line ~30), `POSSyncer` (line ~84) |
| Saan nakakabit sa main page | `app/page.tsx` line ~159 (`// v9.26: POS & Sales live in Supabase`) at `refreshRemotePOS` (line ~177) |

## 2. Totoong Change Password — v9.26.1 / v9.26.2 / v9.27.1

| Ano | Saan |
|---|---|
| Pag-check ng lumang password + pagpalit sa Supabase | `lib/supabase-auth.ts` line ~82 → `changeStaffPassword` |
| Button handler sa Settings | `app/page.tsx` line ~630 → `changeMyPassword` |
| Itsura ng Settings › Account card (Confirm field, Show passwords) | `app/page.tsx` line ~798 (`account-card`) + styles sa `app/clean-ui.css` line ~180 |

## 3. Super Admin + Admin accounts — v9.27 (commit `0ea0a2c`)

| Ano | Saan |
|---|---|
| Database: `is_super_admin` flag | `supabase/migrations/20261111_super_admin_flag.sql` |
| Server rules (Super Admin lang ang gagawa/mag-e-edit ng Admin) | `app/api/admin/staff/route.ts` → `validRoleBranch` (line ~10), `staffTarget` (line ~79) |
| User Management screen (Admin option, role labels) | `components/StaffManagement.tsx` → `roleLabel` (line ~6), Role dropdowns (line ~61, ~72) |

## 4. Lahat ng ibang records sa Supabase — v9.28 (commits `9f05619`, `15a5a2b`)

Kasama: RF/RFP fund entries, disbursement requests, cash counts, turnovers, incidents, approval requests, terminal events/settlements, stock requests, audit log, Settings.

| Ano | Saan |
|---|---|
| Database: table `cms_records` + read rules | `supabase/migrations/20261111_online_records.sql` line ~4 |
| ├ Pag-save (branch, Admin-only approvals/settings, audit append-only, version check) | same file, line ~36 → `cms_save_record` |
| └ Pag-delete (Admin lang, soft delete) | same file, line ~107 → `cms_delete_record` |
| App: listahan ng collections na sine-save | `lib/record-sync.ts` → `RECORD_COLLECTIONS` (taas ng file) |
| App: pag-load at pag-save | `lib/record-sync.ts` → `loadRemoteRecords` (line ~38), `RecordSyncer` (line ~75) |
| Saan nakakabit sa main page | `app/page.tsx` line ~189 (`// v9.28: funds, disbursements…`) at `refreshRemoteRecords` (line ~209) |
| Status sa sidebar ("All changes saved online") | `app/page.tsx` — hanapin ang `All changes saved online` |

---

## Mga patakarang ipinapatupad ng database

| Patakaran | Saan nakasulat |
|---|---|
| Cashier/PB: sariling branch lang | `cms_private.can_access()` — ginagamit sa lahat ng RPC |
| Admin lang ang mag-approve/reject/verify | `cms_save_record` (v_decided) |
| Admin lang ang magbago ng Settings at magbura | `cms_save_record`, `cms_delete_record` |
| Audit log: hindi nababago, Admin lang ang nakakakita | `cms_save_record` + policy `records branch read` |
| Isang open POS lang kada plate sa lahat ng branch | `cms_save_pos` + index `cms_sales_one_open_per_plate` |
| Hindi mapapatungan ang edit ng ibang device | column `version` + `p_expected_version` sa bawat RPC |

## Paano maghanap ng isang bagay

- **Text na nakikita sa screen** → i-search ang mismong text sa repo (GitHub search o `Ctrl/Cmd + Shift + F` sa VS Code). Halos lahat ng screen ay nasa `app/page.tsx` o sa `components/`.
- **Database tables/functions** → `supabase/migrations/` (naka-ayos ayon sa petsa).
- **Kasaysayan ng pagbabago** → `README.md` (pinakabago sa itaas) o GitHub → *Commits*.
