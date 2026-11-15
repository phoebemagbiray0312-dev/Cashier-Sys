-- v9.49 — allow the cashier's supplier receipts / PB refund reports (collection rfpReceipts) to be saved.
-- v9.41 added the collection in the app but missed this check, so saves were rejected.
alter table public.cms_records drop constraint cms_records_collection_check;
alter table public.cms_records add constraint cms_records_collection_check check (collection = any (array[
  'fundEntries','disbursementRequests','counts','turnovers','incidents','requests','terminalEvents',
  'terminalSettlements','stockRequests','stockReceipts','stockIssues','audit','settings','rfpReceipts']));
