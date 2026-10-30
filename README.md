## v9.25 — Admin Profitability Analytics (management estimate)

Admin sidebar → **Profitability Analytics**: an operational management report using browser-local POS, cost/stock and RF/RFP records. Filters cover current/previous month, year or custom dates and combined Underchargers, Mastermind, or an individual branch. The management total in ALL mode is only a comparison; companies remain reported separately. Data is read-only with source-record drilldown and CSV export.

**Logic:** Closed POS sales (by closing date) − existing `posCOGS` (matching PB and stock consumption) = gross profit. Less RF expense totals and RFP online payment charges = **estimated earnings from recorded costs**. Paid customer deposits in open POS, fund replenishments/transfers and inventory receipts are **not** sales or expenses; unallocated RFP purchase principal is disclosed but not deducted again.

**Not final net earnings:** CMS does not yet maintain complete payroll, rent, depreciation, interest, tax, accruals, or verified bank reconciliation, and source COGS may need duplicate-cost review. Pending expenses, zero-COGS closed POS, refunds and unallocated purchases are flagged. The separate Accounting system remains responsible for final accounting net income. The frontend-only Admin role guard is not server-side authorization until shared-backend security is implemented. No database migration or reset is required.

Validation: `npm run test:profitability`, `npm run check:components`, `npm run check:view-maps`. Full Next.js build requires npm packages/network and must be verified in Vercel.

## v9.24 — Cleaner multi-device UI (October 2026)

- Unified readable sizing and responsive spacing via `app/clean-ui.css`.
- Phone: role-aware five-slot nav with a New/Review center action; tablet: icon sidebar rail; desktop: full labelled navigation.
- POS progress, unified Today alert, accessible dialogs, accurate status badges and confirmation overlays.
- Important: source tests pass, but full Vercel production build / actual browser QA still need verification. See `REVISION_STATUS_V9_24.md`.

> **Latest frontend revision: v9.21 — Auto-Generated Disbursements.** PB and Cashier select already-recorded RFP/RF expenses to prepare one request with automatically computed charges, consolidated four-branch PB summary or one-branch Cashier summary, source-linked receipts, A4 portrait paper, downloadable PDF with receipts, approval timeline, and contextual Reports actions. No duplicated expenses, copied receipt blobs or fabricated Accounting/Ms Kate approvals. See `REVISION_STATUS_V9_21.md`.

> **Latest frontend revision: v9.17.1** — Login upgrade hotfix: existing accounts are no longer silently deleted when upgrading. New installs remain empty. First-time Admin setup includes **Restore existing backup (JSON)** to recover a prior local account database if a backup exists. See `REVISION_STATUS_V9_17_1.md`.

> **Latest frontend revision: v9.17** — Parts Purchase now shows assigned Branch, Brand/Model and Year are optional, and Admin Settings includes confirmed Clear App Local Storage with complete backup/restore. See `REVISION_STATUS_V9_17.md`.

# v9.16 — Clean Install (No Seed Data)

See `REVISION_STATUS_V9_16.md`. New browsers start with an empty business database **and no demo login accounts**. On first visit, create the Administrator in the setup screen, then add staff accounts under User Management. Existing real browser data and Docs/Sheets files are preserved; legacy sample cleanup is conservative. Frontend-only authentication is not secure for production.

# v9.15 — Downpayment-first POS Wizard

See `REVISION_STATUS_V9_15.md`. This is still a frontend-only prototype.

# v9.11 — Receipt-style POS and COGS Review

For the latest changes, see `REVISION_STATUS_V9_11.md`.

# Underchargers Fund Management System — Frontend PWA v9.9

Next.js / React / TypeScript responsive PWA for Admin, Cashier, and Parts Buyer. This is a **browser-local frontend prototype**. No Supabase connection, trusted server, multi-device synchronization, or tamper-resistant access control exists yet.

## Controlled inventory workflow (v9.2 UI)

### 1. Product setup (Admin)

1. Go to **Inventory → Add Product** or **Bulk Scan**. Register barcode, name, branch, category, unit, tracking type, and reorder threshold.
2. New products begin with **zero available stock**. **Cost Configuration** sets unit COGS without manufacturing any physical quantity for new products.
3. Subsequent physical stock must enter the separate receiving workflow below. Existing historical v9.1 pending-initial records are retained for migration; see caveats.

### 2. Inbound delivery: Cashier / Admin submits, separate Admin verifies

1. Open **Inventory → Add Stock · Single/Bulk Scan** or a product's **Add Stock** button.
2. Scan the registered product barcode; set actual units (duplicate scans do **not** silently increase quantities). For serialized items, enter each unique unit code.
3. Enter a delivery/supplier reference; upload delivery photo or PDF (max 1.5 MB), and optionally add condition/notes.
4. Submit: the receipt becomes **Pending**. Available stock **does not change**, including if Admin prepared the receipt.
5. A **different Admin** visits **Approvals & Exceptions → Stock In — Physical Verification Queue** and selects **Open Independent Count**.
6. Independently rescan each product barcode, enter physical quantities and serialized unit codes as applicable, review evidence, check acknowledgment, and write verification findings.
7. If actual quantity differs, **Reject** and create a corrected new receipt. Original and rejection remain in history; no rewriting or quietly editing posted quantities.
8. Only a matching, independently verified approval creates branch-specific Stock In movements.

### 3. Outbound stock: POS-linked request and Admin authorization

1. Create an **existing, open POS Draft** with a real customer and vehicle plate before requesting inventory. The scanner no longer silently creates a dummy POS for a release.
2. Cashier opens **Request Stock Release** (from POS or Inventory), scans product(s), specifies physical quantities/unit codes, and explains the customer job/reason (required).
3. The request remains **Pending**. It **reserves** quantities against other requests but **does not deduct stock**; items **must not physically leave** while Pending.
4. Admin checks **Approvals → Stock Release Requests**, confirms physical items and the POS/job, rescans product barcodes and serial numbers if applicable, enters count and findings, then **Authorize & Deduct** or **Reject**.
5. Approval atomically deducts Stock Out from branch ledger with a POS link, request ID, reviewer identity, and notes. A rejected request leaves stock unchanged. POS cannot be closed with a pending release.
6. Return of a previously posted Stock Out continues via a separate request and Admin physical check. Original Stock Out remains in movement history.

Inventory now displays **Available / Pending In / Pending Out** separately, and POS shows its pending/approved/rejected issue requests.

### Why physical controls still matter

The frontend demo **cannot prevent someone from altering browser localStorage, using a shared Admin login, forging uploads, editing timestamps, bypassing role checks through code, or physically removing an item without scanning**. Also, legacy API helpers and old pending-initial records are retained to preserve existing demo integrations; do not regard them as production-secure inventory posting pathways.

Before live deployment, move the final transition/approval logic into an authenticated backend with a database transaction, row-level permissions, immutable append-only audit logs, protected uploads, and independent stocktake/variance reconciliation. Require unique individual accounts, not shared Admin passwords. A physical cycle-count program, stockroom handoff controls, and periodic discrepancy reviews are essential to detect concealed shrinkage.

## Start locally

```sh
npm install
npm run dev
npm run test:logic
npm run build
```

Open the deployed Vercel domain (or http://localhost:3000 in development). The first visit opens **Create the Administrator**; there are no seeded default credentials. Add Cashier and Parts Buyer accounts from User Management afterward.

### Validation for this bundle

- Existing and new **logic smoke tests** passed, including v9.2 controlled inventory tests.
- `lib/data.ts` passed standalone TypeScript type checking; changed TSX files passed TypeScript parsing/transpilation.
- Full Next.js build and actual camera/barcode hardware testing **were not performed**: npm dependencies could not be installed in this environment.
- To carry over old local demo data, use the same browser and domain and **do not clear localStorage**. Export a backup using Settings before upgrading.

## Spreadsheets & Documents (v9.4)

Choose **Spreadsheets** or **Documents** directly from the main sidebar, or use the separate shortcuts on **Reports & Exports**. Each is a standalone workspace with its own file list and create action. Create editable spreadsheet reports or formatted documents, optionally starting from a filtered transaction report snapshot. Staff can submit finished reports for Admin review; submitted and approved copies are locked. Spreadsheet formulas and CSV export, document formatting and Word-compatible .doc export, and print/PDF preview are supported. A spreadsheet can also be converted directly into the Documents workspace.

Use the **trash icon** beside an individual saved file or **Delete File** in its editor to remove files you own in **Draft** or **Changes Requested** status. Deletion always requests confirmation. Submitted/approved files cannot be deleted in this frontend workflow to preserve the review trail.

**Demo limitations:** Files are stored only in this browser (`uc_report_studio_v1`) and do not sync across machines. Report drafts do not affect source ledger records. Spreadsheet CSV export and Word-compatible `.doc` export are provided; native `.xlsx`/`.docx` and secure backend approvals are not implemented. See `REVISION_STATUS_V9_4.md` for the separate workspaces and deletion policy.

## v9.5 — Standalone Office Workspaces (important navigation change)

This release fixes the earlier **mini-tab** problem. **Spreadsheets and Documents no longer render inside the Cashier System main dashboard**. They are independently addressable Next.js App Router pages:

- `https://<your-vercel-project>.vercel.app/sheets` — Spreadsheet file library
- `https://<your-vercel-project>.vercel.app/sheets/<file-id>` — Full-page spreadsheet editor
- `https://<your-vercel-project>.vercel.app/docs` — Document file library
- `https://<your-vercel-project>.vercel.app/docs/<file-id>` — Full-page document editor

In the original Cashier System, click **Spreadsheets** or **Documents** in the main sidebar. Each opens its respective dedicated page with an Office-style top navigation (Cashier System / Spreadsheets / Documents). Your recent files also appear directly on **Reports & Exports → Connected Spreadsheets & Documents**, so the system retains clickable links to individual files.

**Workspaces:** separate file-library landing pages, new blank/imported files, full-width spreadsheet grid and formula bar, multi-cell TSV paste, a document editing page with heading/text/list formatting, rename, copy file, copy local URL, auto-save, CSV or Word-compatible `.doc` export, and print/save as PDF. The owner can delete editable drafts and returned files after confirmation. Submitted and approved files remain locked; Admin can review others' submitted files. Conversion from a spreadsheet to a document creates a new linked file.

**Existing data:** v9.3/v9.4 saved files are retained under the unchanged browser storage key `uc_report_studio_v1`. Use the **same origin and browser storage** (`localhost` vs a different hostname/port counts as a different origin). Original POS, fund, stock and inventory data is **read-only source data** for snapshot imports; report edits cannot post to the ledger.

**Independent file links are not cloud shares.** These routes are real links, but a file exists only in the current browser's localStorage. A browser session must be active. Opening a URL while signed out takes you back to Cashier System sign-in and returns to the document after login in the same tab. Other devices cannot open those files until a shared database and proper authentication/storage are connected. This is a streamlined, Google-like editing experience, **not** the full Google Docs/Sheets feature set (no cloud collaboration, simultaneous editing, real-time syncing or native `.xlsx`/`.docx` exports).

Run `npm run test:studio` or `npm run test:logic`. v9.5 tests cover route locations, safe return-to-file links, stored-file compatibility, role permissions, deletes, editors and all previously shipped logic. A full Next.js production build and visual browser testing still require `npm install` and a supported browser (not available in the current packaging environment).


## v9.6 — Vercel-first Docs and Sheets links

Deploy this Next.js project to your existing **Vercel project**. The app works at `https://YOUR-PROJECT.vercel.app/`; navigate to `/docs` for documents or `/sheets` for spreadsheets. There is **no hard-coded hostname** in application navigation: `studioHomeHref` and `studioFileHref` use root-relative URLs and therefore work on the actual Vercel production/preview hostname or a custom domain without needing environment variables. A file URL is `/docs/<file-id>` or `/sheets/<file-id>`.

Previous `/documents` and `/spreadsheets` links issue temporary redirects to the new routes. Existing stored report files retain the same `uc_report_studio_v1` storage key and no data conversion is needed **if the deployment origin and browser profile remain the same**. After deployment, open `/docs` and `/sheets` on your real project hostname. The `localhost` URL above is only a local developer example.

**Important:** Vercel hosts the editor pages, not the files: report content still exists only in browser localStorage, and demo login session uses sessionStorage. URL sharing to another device is not possible until shared authenticated storage/database is built. `/docs` and `/sheets` are not third-party Google editors. This release does not deploy or change DNS/Vercel project settings.

## v9.9 — Simplified POS and no seeded business transactions

- **POS entry uses two clear steps:** Customer & Vehicle → Add Items & Save. The saved transaction opens for actual payment recording, then closure.
- Internal cost and Parts Buyer breakdown are available under optional details so daily cashier users can focus on items, payments and remaining balances.
- "Pay remaining" fills the payment amount; existing card/GCash/bank terminal reference validation stays intact.
- Manual addition of a registered inventory part during POS creation is blocked; use Admin-approved POS-linked Stock Release.
- **New browser installations start with zero transactions, zero inventory, zero audit events and zero demo fund balances**. The three role-based frontend login accounts remain until real backend authentication is implemented. Set opening RF/RFP balances explicitly through Admin Settings before using fund workflows.
- On existing browser installations, only *exactly identifiable unmodified legacy sample transactions* are removed on load; genuine transactions and linked/referenced sample records are preserved for traceability. Do **not** clear the entire browser storage to remove samples.
- A former `*-demo-v1` localStorage key is retained deliberately to protect genuine saved records and not silently reset a deployed browser. This remains frontend-only: files and records are not cross-device.
- The Vercel ZIP is **repository-root** layout, not nested under `cashier-ms-main`. The lightweight `prebuild` import validation reports missing local code files before a deployment compilation.

### Deployment verification

Run `npm run check:components` and `npm run test:logic` before `npm run build`. Logic and TypeScript-source parsing are verified in this bundle; a complete Next.js production build and physical browser workflow remain unverified if `npm install` cannot fetch dependencies. Verify the intended GitHub repository and Vercel project are connected before deploying.

## v9.12 — Receipt Quotation + Global Unit Lock (frontend/local data)
See `REVISION_STATUS_V9_12.md`. POS drafts are identified by normalized plate and branch. Open transactions on the same unit block other branches within the browser datastore. Same-branch open and unpaid drafts are revised with Draft History instead of duplicated. Quotation rows are entered inline. This is NOT cross-device protection until a backend database is connected.

### v9.13 POS Draft Deletion (frontend only)
From POS & Sales → Drafts, choose **Delete** next to an open unpaid POS, or open the draft and choose **Delete Draft**. Only the active cashier assigned to that branch may delete; a reason (minimum five characters) and confirmation are required. Drafts with payments, terminal activity, stock movement/release/correction history, PB-linked purchases, or linked POS child transactions are protected from deletion. Deleted drafts no longer appear in active POS or hold the unit lock. The full original draft/revision history is retained in `deletedPOSDrafts` and is shown read-only to Admin in Reports & Audit. POS numbers from deleted drafts remain reserved and are never reused. Browser-local storage is not tamper-proof; production needs protected server-side audit and transactional constraints.

## v9.18 — Clickable demo login shortcuts (frontend-only)

- New browser storage remains empty: no automatically seeded accounts, sales, inventory, fund balances or transactions.
- On the **Create Administrator** first-run screen, **Enable Demo Logins** is an explicit testing-only action. After confirmation, it creates three LOCAL test roles and shows Admin, Cashier and Parts Buyer clickable login shortcuts. Clicking a role fills its test username/password; then click Sign in.
- Existing accounts/data are never overwritten by this action. If previous records or Docs/Sheets files exist, recover the previous backup instead of generating test accounts.
- Quick-fill shortcuts are shown only when matching active test users still exist with their exact test credentials. Altered passwords/disabled users hide that shortcut.
- This is **not** secure production authentication and must not be used for real collections.
- The PWA cache has been bumped and JS/style assets favor fresh network bundles while online.

## v9.19 — CMS Disbursement Requests (PB & Cashier)

A separate **Disbursement Requests** sidebar page is available to PB, Cashier and Admin. PB/Cashier can create and save drafts, submit to *Pending Accounting Approval*, see their own branch-scoped requests, review timeline/history/attachments, and edit + resubmit externally returned requests. Admin has read-only branch-filtered CMS request oversight; no CMS role can impersonate Accounting, Ms Kate, or payment-release authority.

This new request ledger is **distinct from the existing RF/RFP expense and replenishment ledger**, which is preserved unchanged. New requests do not change fund balances, record payments or communicate with other applications. Local storage persists data in this browser only. See `DISBURSEMENT_SHARED_DATABASE_CONTRACT_V1.md` for the future shared-database schema and integration boundaries (Accounting and HRMS; **ERP excluded entirely**), and `REVISION_STATUS_V9_19.md` for the changed files and tests.

## v9.20 — Parts Buyer Multi-Branch Access

- Parts Buyer may select any configured active CMS branch from the top-right workspace selector: UCQC, UCM, UCLP, MMM. Their account's stored branch is a **default branch**, not an access restriction. Cashiers remain restricted to their assigned branch.
- **Parts Fund (RFP):** purchases can be recorded in any configured branch. Every purchase explicitly stores its selected branch and debits only that branch's RFP balance. POS matching and per-branch document/transaction numbering remain scoped to the selected branch. Existing replenishment actions use the selected workspace branch.
- **Disbursement Requests:** PB can choose any configured branch in a new request, and view/edit their own requests across branches; Cashier cannot submit outside their assigned branch. A request's branch is immutable after creation; make a new request for a different branch. External Accounting and Ms Kate approvals are still **not connected** and cannot be entered by CMS requesters.
- Account Management shows PB access as `All branches` and keeps the existing assigned branch as their initial/default selection. No new accounts, demo transactions, or data resets were introduced.
- This is **frontend-only / local browser data**. Cross-device access restrictions and role/branch membership will require server-side authorization in the future shared database.
- Validation: `npm run test:logic`, `npm run check:components`, `npm run check:view-maps` passed. Full Next.js production build/typecheck requires installed project dependencies and has **not** been verified in this environment.

## v9.22 — Automatic Disbursement Paper Review

The **Disbursement Requests** page now opens a consolidated, paper-style request generated automatically from all eligible RF/RFP expense records: **PB: four branches; Cashier: assigned branch only**. There is no longer an expense checkbox/selection stage. Existing saved requests remain accessible and previous submitted snapshots are retained. From the paper view, staff can open original receipts and download/print the A4 document. Pending external approvals are not simulated. See `REVISION_STATUS_V9_22.md` for details and release-cycle caveats.


## v9.23 — UI Spacing & Container Cleanup

Screen-only CSS revision to normalize outer page gutters, panel spacing, transaction details, Reports actions, POS quotation/COGS controls, Disbursement Paper, modals, and standalone Office workspaces. Mobile layouts now inset dialogs from device edges and keep wide tables scrollable within their section. The A4 disbursement print rules remain in effect. The PWA cache version was bumped to load the newer stylesheet. No accounts, transactions, role settings, localStorage schema, or approval logic changed. See `REVISION_STATUS_V9_23.md`.
