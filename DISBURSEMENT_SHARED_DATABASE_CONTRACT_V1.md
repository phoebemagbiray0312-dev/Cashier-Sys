# CMS Disbursement Requests — Shared Database Contract v1 (Future Only)

Status: **frontend local prototype, NOT integrated**. This document is a future integration contract, not a statement that Accounting or HRMS communicate with CMS. ERP must remain fully standalone: no ERP imports, references required, API calls, or synchronization.

## Ownership and shared data

One shared, transactional database will eventually support CMS, Accounting and HRMS. **CMS is the creator/source of truth for CMS-created disbursement requests.** Accounting and HRMS must use the *same record ID* through authorized updates to the shared request and append-only events, never create independently synced copies. CMS cannot decide Accounting or HRMS approvals. Avoid independent per-app copies, webhook-based double posting, or duplicate release ledger entries.

Current local model: `lib/disbursement-requests.ts` (`DisbursementRequest`, `ExternalDecision`, `DisbursementRelease`, `DisbursementTimeline`). Local `Database.disbursementRequests` array is new and separate from existing `fundEntries` replenishment, POS collections, inventory and payroll. Never treat a request as actual expense, fund cash receipt, accounts payable disbursement, or bank payment.

### Proposed authoritative tables / shared views

- `cms_disbursement_requests`: `id uuid PK`, `request_no unique`, `source_app='CMS'`, `schema_version`, `requestor_user_id`, `employee_id` (HRMS linkage pending), `requestor_name_snapshot`, `requestor_role`, `branch_id`, `request_date`, `category`, `purpose`, `amount_php numeric(15,2) CHECK(amount_php>0)`, `remarks`, `status enum`, `revision int`, `created_at`, `updated_at`, `submitted_at`, `row_version` (optimistic locking). No ERP fields or dependencies.
- `cms_disbursement_attachments`: `id`, `request_id`, `storage_key`, `filename`, `mime`, `byte_size`, `uploaded_by`, `created_at`; private object storage with short-lived authorized URLs, no large browser-local data URLs in production.
- `cms_disbursement_approval_events`: append-only `id`, `request_id`, `revision`, `stage` (`Accounting` / `Ms Kate`), `decision` (`Approved` / `Rejected` / `Returned`), `actor_user_id`, `actor_role`, `decision_at`, `reason`, `authenticated_application`, `idempotency_key`. Approvals valid only for the request's current materially unchanged revision.
- `cms_disbursement_history`: append-only `id`, `request_id`, `actor`, `role`, `branch`, `timestamp_timestamptz`, `action`, `before_json`, `after_json`, `reason`, `revision`, `origin_app`. Audit timestamps stored in UTC; presented in `Asia/Manila`.
- `cms_disbursement_release`: future authorized-release record `id`, `request_id unique`, `amount`, `method`, `release_at`, `payment_reference`, `releasing_user_id`, `proof_storage_key`, `created_at`; idempotent and permission protected.
- `cms_disbursement_reconciliation`: future Accounting-owned reconciliation evidence `id`, `request_id`, `release_id`, `reconciled_by`, `reconciled_at`, `bank_reference`, `variance`, `notes`.

### Required transitions and permissions

1. CMS PB/Cashier can create Draft, edit own Draft/Returned request in own branch, submit or resubmit. Submission -> `Pending Accounting Approval`.
2. **Accounting** (authenticated separately and authorized by shared-db policy) may approve -> `Pending Ms Kate Approval`, reject -> `Rejected by Accounting`, or return -> `Returned by Accounting`, with a reason for rejection/return.
3. **Ms Kate** through HRMS with independently verified identity and required approval authority may approve -> `Approved for Release`, reject -> `Rejected by Ms Kate`, or return -> `Returned by Ms Kate`. She cannot skip Accounting approval. On a material revision, the request must re-enter Accounting approval before she can approve again.
4. Approved for Release ≠ Released/Paid. Only a configured **authorized releaser** with both valid, revision-matched approvals may record an actual release. Use a transaction containing the unique release record, funds posting, and audit event. Reject duplicate references/payment posting.
5. Accounting reconciliation after actual release, with bank / terminal proof, can change status to `Reconciled`. Approval must not automatically pay or reconcile.
6. Rejected records are terminal until an explicit, auditable process is designed. Submitted/released records are never editable by ordinary CMS creators; return states require revision and resubmission.
7. All writes enforce record ownership, branch access, valid source-app role, request version, legal transitions, and idempotency **on the server/database**, not in the frontend.

### Future adapter interface

A future trusted data adapter should expose read-only CMS list/detail subscriptions for external decisions, authenticated CMS create/update/submit methods, and separate authenticated Accounting/HRMS/release/reconciliation server operations. No Accounting/HRMS API stubs, status fabrication, or automated syncing are implemented in this release.

### Migration plan

1. Implement shared authentication and role permissions. Map CMS user IDs to canonical employee IDs **without requiring ERP**.
2. Migrate local requests only after explicit backup, account mapping and conflict resolution; preserve request IDs and audit history; verify attachment ownership.
3. Use one source database and transactional constraints for state transitions and release; implement immutable/tamper-evident audit and row-level security.
4. Build Accounting and HRMS interfaces in their own projects, using the shared schema and verified roles. CMS remains the origin for CMS requests.
5. Add real data freshness, notifications, protected storage, error recovery, and end-to-end workflow tests across the three apps.

### Prototype limitation

Browser `localStorage` is editable and per-browser; it is not cross-device, tamper-proof or a legitimate financial approval system. CMS currently shows external approval states only if the request record genuinely contains corresponding fields (future shared DB); the current CMS UI cannot create those decisions or release payments. No live external events are being received.

## v9.21 source-expense generation additions (future shared database)

- `cms_disbursement_request_expenses`: one mapping row per included ledger expense, with `request_id`, `source_expense_id` (unique among active requests), `fund`, `branch`, `line_order`, `base_amount`, `online_payment_charge`, `expense_total`, `receipt_object_id`, `source_version`, and `snapshot_at`. Do **not** duplicate the cash-out or purchase as a separate accounting expense just because it is included in a request.
- Approval papers and review panels show **Date | Amount & Branch | Online Payment Charge | Total Expenses | Remarks** above a **Total per Branch** summary and a **Fund Balance / Less Expenses / Remaining Fund / Amount Requested** section. PB RFP is consolidated over UCQC, UCM, UCLP and MMM; Cashier RF is restricted to the logged-in Cashier's assigned branch.
- Preserve a stable source expense ID. Bind attachment references to secure object-storage IDs; do not copy base64 receipt bytes into every disbursement request. In the current frontend, `sourceExpenseIds` point to the original `FundEntry.proof` in the same browser, and PDFs resolve those references only when opened/exported. Actual immutable snapshots, secure storage, cross-device access, and proof tamper checks are **not yet implemented**.
- Compute expense totals as `base_amount + online_payment_charge`, rounded to cents. Do not use online charge as a new independently postable payment. Rejected, already-reserved, or invalid expenses must not enter new generated requests. A request can be saved as Draft and explicitly submitted to Accounting; no approval or release is implied.
- **Legacy records:** do not delete previously generated manual-request, RF/RFP replenishment or approval records. Existing legacy requests remain accessible as read-only history in the v9.21 UI; new submission is from linked RF/RFP expenses only. No existing replenishment is auto-converted to a payment.
- Before enabling a shared backend: add server/database uniqueness for request-source mappings, transactional request creation, RLS for Cashier branches/PB authorized branches, version-bound approval signatures, auditable corrections, immutable receipt references and authorized release/reconciliation. ERP remains entirely separate.

## v9.22 — generated-cycle and cutoff semantics (frontend prototype)

- `sourceExpenseIds` are automatically derived from all eligible ledger entries for the appropriate role's fund/scope; the UI no longer accepts an arbitrary subset.
- `coverageCutoffs[branch] = {at, source}` and `coverageUntil` are optional, backward-compatible request snapshot metadata. They are informational and preserve what was used at draft generation/revision.
- Only an actual recorded `Released / Paid` or `Reconciled` disbursement with valid release timestamp advances a confirmed release boundary. Status-only Accounting or Ms Kate approval **does not** advance this boundary.
- Legacy Approved replenishment entries may still define an **explicitly unverified legacy boundary** when no later released disbursement exists; these must be reconciled during database migration. Do not silently assert they were paid.
- Unclaimed expenses predating a confirmed release should carry forward to the next cycle rather than disappear. Expenses that have already been released/paid are never included again.
- One active generated request per RFP all-branch cycle, or per Cashier RF branch. On the shared database this requires unique/serializable server constraints and transactional conflict checks, not localStorage-only checks.
- After submission, the request retains its source and amount snapshot. Receipt bodies are resolved from source expense records by stable IDs to avoid localStorage duplication; the future backend must make attachments immutable/versioned for approval integrity.
