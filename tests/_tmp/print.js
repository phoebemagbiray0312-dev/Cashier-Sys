"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapPrint = void 0;
exports.printConsolidatedDisbursement = printConsolidatedDisbursement;
exports.printFundReport = printFundReport;
exports.printRFPParts = printRFPParts;
exports.printPBDisbursement = printPBDisbursement;
exports.printSales = printSales;
exports.printPOS = printPOS;
exports.printCashCounts = printCashCounts;
exports.printTurnovers = printTurnovers;
exports.printReconciliation = printReconciliation;
exports.printAudit = printAudit;
exports.printReceipts = printReceipts;
const data_1 = require("./data");
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const dateTime = (x) => new Date(x).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const displayed = (s) => `<span class="clip" title="${esc(s)}">${esc(s)}</span>`;
const fmt = (v) => esc((0, data_1.pesos)(v));
const printStyles = `
@page{size:A4 landscape;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#232831;font:9px Arial,Helvetica,sans-serif;background:white}
.print-page{break-after:page;page-break-after:always;min-height:178mm}.print-page:last-child{break-after:auto;page-break-after:auto}
header{height:21mm;display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #ecc00c;margin-bottom:3.2mm;padding-top:2mm}
header .brand{font-size:13px;font-weight:800;letter-spacing:.55px}.logo-slot{font-size:8px;letter-spacing:0;color:#777;margin-top:4px}
header h1{font-size:15px;margin:0 0 3px;font-weight:800}header small{font-size:9px;color:#535b63}
.meta{display:flex;justify-content:space-between;gap:10px;margin:0 0 3mm;font-size:9px}.meta b{font-weight:700}
table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8px}th{height:6mm;background:#ffed9e;text-align:left;white-space:nowrap;overflow:hidden}td,th{border:1px solid #b9bec5;padding:1.05mm 1.25mm;vertical-align:middle}
.data-table tbody tr{height:4.7mm;max-height:4.7mm;page-break-inside:avoid}.data-table td{height:4.7mm;max-height:4.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.data-table .clip{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.num{text-align:right;white-space:nowrap}.center{text-align:center}.muted{color:#69727c}.mini{font-size:8px}.total{background:#ffed9e;font-weight:700}
.footline{display:flex;justify-content:space-between;margin-top:2mm;color:#626872;font-size:8px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:2mm 0}.metric{border:1px solid #c8ccd2;padding:2.1mm}.metric b{display:block;font-size:13px;margin-top:2mm}
.summary-section{margin:2.2mm 0;break-inside:avoid}.summary-section h2{font-size:12px;padding-bottom:2mm;margin:0 0 2mm;border-bottom:1px solid #ddd}.compact-table{max-width:165mm}.compact-table td,.compact-table th{height:5.2mm;font-size:9px}
.signature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10mm;margin-top:6mm}.signature{border-top:1px solid #2d2e35;text-align:center;padding-top:2mm;min-height:14mm}.signature .name{display:block;font-size:10px;font-weight:700}.signature .role{color:#6f7782;font-size:8px}.signature img{height:10mm;max-width:60mm;object-fit:contain;margin-top:-18mm;display:block;margin-left:auto;margin-right:auto}
.receipt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm}.receipt{border:1px solid #c3c8d2;padding:3mm;height:65mm;break-inside:avoid;display:flex;flex-direction:column}.receipt img{max-height:49mm;max-width:100%;object-fit:contain;align-self:center}.receipt .name{display:flex;justify-content:space-between;margin-bottom:2mm}.notice{padding:3mm;border:1px solid #e3c953;background:#fff6d5;margin:3mm 0}.cat-pair{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.voucher-series{font-size:7px;max-height:8mm;overflow:hidden}.notes{white-space:pre-line;line-height:1.5}
/* v4: a single combined Disbursement + Replenishment sheet whenever it fits. */
.fund-print{min-height:0;padding:0;}
.fund-print header{height:15mm;margin-bottom:1.5mm;padding-top:1mm}
.fund-print header h1{font-size:12px}.fund-print .brand{font-size:11px}.fund-print .logo-slot{font-size:7px}
.fund-print .meta{margin-bottom:1.5mm;font-size:8px}
.fund-print .data-table{font-size:6.7px;line-height:1.1}
.fund-print .data-table th{height:4.1mm;font-size:6.8px;padding:.4mm .65mm}
.fund-print .data-table tbody tr,.fund-print .data-table tbody td{height:3.2mm;max-height:3.2mm}
.fund-print .data-table td{padding:.25mm .65mm}
.fund-print .data-table .clip{line-height:2.3mm}
/* More legible expense rows on shorter requests; density only increases when required. */
.fund-print[data-density="roomy"] .data-table{font-size:8.5px}
.fund-print[data-density="roomy"] .data-table th{height:5.4mm;font-size:8px}
.fund-print[data-density="roomy"] .data-table tbody tr,.fund-print[data-density="roomy"] .data-table tbody td{height:4.4mm;max-height:4.4mm}
.fund-print[data-density="mid"] .data-table{font-size:7.5px}
.fund-print[data-density="mid"] .data-table th{height:4.5mm;font-size:7.5px}
.fund-print[data-density="mid"] .data-table tbody tr,.fund-print[data-density="mid"] .data-table tbody td{height:3.7mm;max-height:3.7mm}

.fund-print .footline{margin-top:.8mm;font-size:7px}
.fund-summary{margin-top:2mm;break-inside:avoid;page-break-inside:avoid;font-size:8px}
.fund-summary .fund-summary-title{border-bottom:1px solid #c5c8d0;padding-bottom:.8mm;margin-bottom:1mm;font-size:9px;font-weight:800}
.fund-figures{display:grid;grid-template-columns:repeat(5,1fr);gap:1.8mm}
.fund-figures>div{border:1px solid #d2d6dc;border-radius:2px;padding:1.2mm 1.5mm;min-height:9mm}
.fund-figures>div span{display:block;color:#58616c;font-size:7px;white-space:nowrap}
.fund-figures>div strong{font-size:10px;margin-top:1mm;display:block;font-weight:700;white-space:nowrap}
.fund-request-result{background:#fff0a5;border:1px solid #d9ad0a;display:flex;align-items:center;justify-content:space-between;padding:1.4mm 2mm;margin:1mm 0;font-size:9px}
.fund-request-result strong{font-size:13px}
.fund-summary small{font-size:7px;color:#59616b}
.fund-extra{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:1.2mm}
.fund-extra h3{font-size:8px;margin:0 0 .7mm}
.fund-categories{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7mm 1.8mm;font-size:7px}
.fund-category{display:flex;justify-content:space-between;gap:2mm;border-bottom:1px dotted #d9dce0;min-width:0}
.fund-category span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.fund-category b{white-space:nowrap}
.fund-deposits{width:100%;font-size:7px}
.fund-deposits td,.fund-deposits th{padding:.35mm .7mm;height:3.3mm}
.fund-summary .signature-grid{margin-top:4mm;gap:6mm}
.fund-summary .signature{min-height:11mm;padding-top:1mm}
.fund-summary .signature .name{font-size:9px}.fund-summary .signature .role{font-size:7px}
.fund-summary .signature img{max-height:7mm;margin-top:-11mm}
.branch-breakdown{margin-top:1.5mm;font-size:7.2px}
.branch-breakdown table{font-size:7px}
.branch-breakdown th,.branch-breakdown td{height:3.2mm;padding:.45mm 1mm}
.branch-breakdown .grand{font-weight:800;background:#fff2b5}
.approval-track{display:grid;grid-template-columns:repeat(3,1fr);gap:2.5mm;margin-top:2.6mm}
.approval-track .approval-actor{border-top:1px solid #444;text-align:center;padding:1mm 1mm 0;font-size:8px;min-height:12mm;position:relative}
.approval-track .approval-actor strong{display:block;font-size:9px}
.approval-track .approval-actor span{display:block;font-size:7px;color:#525965}
.approval-track .approval-actor img{height:6mm;max-width:56mm;object-fit:contain;display:block;margin:-7mm auto 1mm}
@media print{.branch-breakdown,.approval-track{break-inside:avoid;page-break-inside:avoid}}
.fund-summary .voucher-series{margin-top:1mm;line-height:1.4;max-height:4.2mm}
.actions{position:fixed;bottom:15px;right:15px;z-index:999;padding:9px;border-radius:8px;background:white;border:1px solid #cbd1d8;box-shadow:0 4px 14px #0002}.actions button{background:#facc15;border:none;padding:11px 18px;border-radius:6px;font-weight:700;cursor:pointer}
@media print{.actions{display:none!important}.print-page{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;
const wrapPrint = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title><style>${printStyles}</style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>${body}</body></html>`;
exports.wrapPrint = wrapPrint;
function openPrint(title, body, logo) { if (logo?.startsWith('data:image/'))
    body = body.replaceAll('<div class="brand">UNDERCHARGERS CORPORATION</div>', `<div class="brand"><img src="${logo}" alt="Underchargers Logo" style="height:12mm;max-width:75mm;object-fit:contain;display:block"/><span style="font-size:7px">UNDERCHARGERS CORPORATION</span></div>`); const w = window.open('', '_blank'); if (!w) {
    window.alert('Please allow pop-ups to preview the report.');
    return;
} w.document.open(); w.document.write((0, exports.wrapPrint)(title, body)); w.document.close(); w.focus(); }
const header = (title, subtitle) => `<header><div><div class="brand">UNDERCHARGERS CORPORATION</div><div class="logo-slot">FUND MANAGEMENT SYSTEM · OFFICIAL REPORT</div></div><div style="text-align:right"><h1>${esc(title)}</h1><small>${esc(subtitle)}</small></div></header>`;
const period = (from, to) => `${from ? (0, data_1.datePH)(from) : 'Beginning of records'} – ${to ? (0, data_1.datePH)(to) : 'Latest'}`;
const meta = (branch, range, reference) => `<div class="meta"><span><b>Branch:</b> ${esc(branch)}</span><span><b>Period:</b> ${esc(range)}</span>${reference ? `<span><b>Reference:</b> ${esc(reference)}</span>` : ''}</div>`;
const page = (body) => `<section class="print-page">${body}</section>`;
const cell = (value, num = false) => `<td class="${num ? 'num' : ''}">${num ? esc(value) : displayed(value)}</td>`;
const listTable = (heads, rows, widths) => `<table class="data-table">${widths ? `<colgroup>${widths.map(w => `<col style="width:${w}%"/>`).join('')}</colgroup>` : ''}<thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const pagination = (items, size = 30) => items.length ? Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size)) : [[]];
const reportPages = (title, branch, range, heads, rows, widths) => pagination(rows).map((chunk, i) => page(header(title, `${range} · Detail page ${i + 1} / ${Math.ceil(rows.length / 30) || 1}`) + meta(branch, range) + listTable(heads, chunk, widths) + `<div class="footline"><span>${chunk.length} transactions on this page · Max 30 / page</span><span>Total detail rows: ${rows.length}</span></div>`)).join('');
const metric = (title, amount) => `<div class="metric">${esc(title)}<b>${fmt(amount)}</b></div>`;
const tRow = (name, value) => `<tr><td>${esc(name)}</td><td class="num">${esc(value)}</td></tr>`;
function signatures(db, preparedById, signature, at) {
    const prepared = db.users.find(u => u.id === preparedById)?.name || 'Not assigned';
    const checked = db.settings.signatories?.checked?.trim() || 'Not configured';
    const approved = db.settings.signatories?.approved?.trim() || 'Not configured';
    return `<div class="signature-grid">${[
        ['Prepared by', prepared, signature], ['Checked / Verified by', checked, ''], ['Approved by', approved, '']
    ].map(([role, name, img]) => `<div class="signature">${img?.startsWith('data:image/') ? `<img src="${img}" alt="Recorded signature"/>` : ''}<span class="name">${esc(name)}</span><span class="role">${esc(role)}</span>${at ? `<div class="mini muted">${esc(at)}</div>` : ''}</div>`).join('')}</div>`;
}
/** The individual report exposes only its own branch. Only Admin invokes the four-branch report. */
function branchBreakdown(db, fund, branch) {
    const all = (0, data_1.branchFundTotals)(db, fund);
    const rows = branch ? all.rows.filter(r => r.branch === branch) : all.rows;
    const totals = branch ? { ...rows[0] } : all.grand;
    return `<div class="branch-breakdown"><strong>Fund balances by branch · ${esc(fund === 'RF' ? 'Revolving Fund' : 'RFP Parts Fund')}</strong><table><thead><tr><th>Branch</th><th class="num">Starting Fund</th><th class="num">Expenses</th><th class="num">Received</th><th class="num">Remaining</th><th class="num">Replenish</th></tr></thead><tbody>${rows.map(r => `<tr>${cell(r.name)}${[r.target, r.expenses, r.received, r.remaining, r.toReplenish].map(v => cell(fmt(v), true)).join('')}</tr>`).join('')}${branch ? '' : `<tr class="grand">${cell('GRAND TOTAL')}${[totals.target, totals.expenses, totals.received, totals.remaining, totals.toReplenish].map(v => cell(fmt(v), true)).join('')}</tr>`}</tbody></table></div>`;
}
function findReplenishment(db, branch, fund) {
    return db.fundEntries.filter(e => e.branch === branch && e.fund === fund && e.kind === 'replenishment').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
function disbursementSignatures(db, request, preparedById) {
    const name = db.users.find(u => u.id === (request?.createdBy || preparedById))?.name || 'To be signed by preparer';
    const accounting = db.settings.signatories?.checked?.trim() || 'Accounting · Name pending';
    const president = db.settings.signatories?.approved?.trim() || 'President · Name pending';
    const accountingStatus = request?.accountingStatus === 'Verified' ? 'Simulated verification only' : request?.accountingStatus === 'Returned' ? 'Returned' : 'Pending external verification';
    const presidentStatus = request?.presidentStatus === 'Approved' ? 'Simulated approval only' : request?.presidentStatus === 'Rejected' ? 'Rejected' : 'Pending President approval';
    return `<div class="approval-track"><div class="approval-actor">${request?.signature?.startsWith('data:image/') ? `<img src="${request.signature}" alt="Prepared by recorded signature"/>` : ''}<strong>${esc(name)}</strong><span>Prepared by · ${esc(request ? dateTime(request.createdAt) : 'Draft · not yet submitted')}</span></div><div class="approval-actor"><strong>${esc(accounting)}</strong><span>Verified by: Accounting · ${esc(accountingStatus)}</span></div><div class="approval-actor"><strong>${esc(president)}</strong><span>Approved by: President · ${esc(presidentStatus)}</span></div></div><small>Accounting and President approval signatures must originate from their authorized workflow on the future shared Supabase database; demo status does not constitute their signatures.</small>`;
}
/** Printable Admin-only consolidated view; Cashier/PB never see other branches' fund balances. */
function printConsolidatedDisbursement(db, fund) {
    const total = (0, data_1.branchFundTotals)(db, fund);
    const detail = data_1.BRANCHES.map(b => {
        const s = (0, data_1.disbursementSummary)(db, b.id, fund), last = findReplenishment(db, b.id, fund);
        return `<tr>${cell(b.name)}${[s.base, total.rows.find(r => r.branch === b.id).expenses, total.rows.find(r => r.branch === b.id).received, s.remaining, s.amountRequested].map(v => cell(fmt(v), true)).join('')}${cell(last?.no || 'Not submitted')}${cell(last?.status === 'Approved' ? 'Received' : last?.status === 'Pending' ? last.accountingStatus === 'Verified' ? 'Awaiting President/receipt' : 'Awaiting Accounting' : last?.status || '—')}</tr>`;
    }).join('');
    const summary = branchBreakdown(db, fund) + `<div class="notice">Every branch has a separately tracked fund balance and replenishment history. Replenishment = spent cash not yet received back for that branch. The grand total is for Admin financial oversight only.</div>`;
    const html = page(header(`${fund === 'RF' ? 'REVOLVING FUND' : 'RFP'} · ALL BRANCH DISBURSEMENT`, 'Consolidated branch totals') + meta('All 4 branches', 'Current ledger balances') + summary + `<div class="summary-section"><h2>Latest Disbursement References & Stages</h2><table class="compact-table" style="max-width:none"><thead><tr><th>Branch</th><th>Fund Target</th><th>Total Expenses</th><th>Received</th><th>Balance</th><th>Due</th><th>Latest Reference</th><th>Latest Stage</th></tr></thead><tbody>${detail}</tbody></table></div><div class="fund-request-result"><span>TOTAL AMOUNT TO REPLENISH · ALL BRANCHES</span><strong>${fmt(total.grand.toReplenish)}</strong></div><div class="approval-track"><div class="approval-actor"><strong>Assigned branch Cashier / PB</strong><span>Prepared by · each individual request</span></div><div class="approval-actor"><strong>${esc(db.settings.signatories?.checked || 'Accounting · Name pending')}</strong><span>Verified by: Accounting · separate system</span></div><div class="approval-actor"><strong>${esc(db.settings.signatories?.approved || 'President · Name pending')}</strong><span>Approved by: President · final authorization</span></div></div><p class="mini muted">This consolidated print is not a signed approval; signatures belong to each branch's individual request.</p>`);
    openPrint(`All Branches ${fund} Disbursement`, html, db.settings.reportLogo?.data);
}
/** Disbursement and replenishment are ONE request/document. The automatically
 * calculated replenishment amount is the spent amount that has not been restored.
 * The last detail sheet always includes the financial summary and signatories;
 * details paginate only when the transaction list no longer fits A4 landscape. */
function printFundReport(db, branch, fund, _entries, from = '', to = '', preparedById) {
    const s = (0, data_1.disbursementSummary)(db, branch, fund, from, to), range = period(from, to), branchName = (0, data_1.BRANCH_NAME)(branch);
    const title = fund === 'RF' ? 'REVOLVING FUND DISBURSEMENT & REPLENISHMENT' : 'RFP DISBURSEMENT & REPLENISHMENT';
    const expenses = s.period.filter(e => e.kind === 'expense').sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
    const rows = expenses.map(e => [
        displayed((0, data_1.datePH)(e.date)), displayed(e.no), displayed(e.payee), displayed(e.description), displayed(e.category), displayed(e.voucher), displayed(e.receiptNo),
        `<span class="num">${fmt(e.vat === 'VAT' ? e.amount : 0)}</span>`, `<span class="num">${fmt(e.vat === 'Non-VAT' ? e.amount : 0)}</span>`, displayed(e.status)
    ]);
    const refNos = expenses.map(e => e.voucher).filter(Boolean);
    const voucherDisplay = (() => { if (!refNos.length)
        return 'Not specified'; const parts = refNos.map(x => /^(.*?)(\d+)$/.exec(x)); if (parts.every(x => x && x[1] === parts[0]?.[1])) {
        const numbers = parts.map(x => Number(x[2])).sort((a, b) => a - b);
        if (numbers.every((x, i) => i === 0 || x === numbers[i - 1] + 1))
            return `${parts[0][1]}${numbers[0]} to ${parts[0][1]}${numbers.at(-1)} (${refNos.length} vouchers)`;
    } return refNos.length > 12 ? `${refNos.slice(0, 12).join(', ')} and ${refNos.length - 12} more (see details)` : refNos.join(', '); })();
    const catRows = Object.entries((0, data_1.categoryTotals)(s.period)).sort((a, b) => b[1] - a[1]);
    const catHTML = catRows.length ? `<div class="fund-categories">${catRows.map(([k, v]) => `<div class="fund-category"><span>${esc(k)}</span><b>${fmt(v)}</b></div>`).join('')}</div>` : '<small>No expenses in selected period</small>';
    const deposits = s.checkDeposits;
    const depositHTML = deposits.length ? `<table class="fund-deposits"><thead><tr><th>Date</th><th>Bank</th><th>Check / Reference</th><th class="num">Amount</th></tr></thead><tbody>${deposits.map(e => `<tr>${cell((0, data_1.datePH)(e.date))}${cell(e.bank || '—')}${cell(e.checkNo || e.no)}${cell(fmt(e.amount), true)}</tr>`).join('')}</tbody></table>` : '<small>None within selected period</small>';
    const last = expenses.at(-1), request = findReplenishment(db, branch, fund);
    const submittedAmount = request?.status === 'Pending' ? request.amount : s.amountRequested;
    const figures = [['Fund Target', s.base], ['Opening Cash on Hand', s.opening], ['Less: Expenses', s.expenses], ['Add: Replenishments', s.deposits], ['Closing Cash on Hand', s.remaining]];
    const figuresHTML = `<div class="fund-figures">${figures.map(([name, value]) => `<div><span>${esc(name)}</span><strong>${fmt(Number(value))}</strong></div>`).join('')}</div>`;
    const summary = `<div class="fund-summary"><div class="fund-summary-title">Fund Reconciliation & Replenishment Request (Combined)</div>${figuresHTML}` +
        `<div class="fund-request-result"><span>${request?.status === 'Pending' ? 'SUBMITTED AMOUNT TO REPLENISH · fixed at submission' : 'AUTOMATIC AMOUNT TO REPLENISH · spent cash not yet restored'}</span><strong>${fmt(submittedAmount)}</strong></div>` +
        `<small>Previous unreplenished cash: ${fmt(s.base - s.opening)} + period expenses: ${fmt(s.expenses)} − approved replenishments: ${fmt(s.deposits)} = ${fmt(s.base - s.remaining)} net amount outstanding (minimum request ₱0). Historical expenses can be carried forward. Rejected expenses are excluded.</small>` +
        `<div class="fund-extra"><div>${fund === 'RF' ? `<h3>Expense Category Subtotals</h3>${catHTML}` : `<h3>Parts Purchase Summary</h3><small>${expenses.length} parts purchases · ${fmt(s.expenses)} in period expenses</small>`}</div><div><h3>Check Deposits / Replenishments</h3>${depositHTML}</div></div>` +
        `<p class="voucher-series"><b>Disbursement Reference:</b> ${esc(request?.no || 'Draft · not submitted')} · <b>Cash Vouchers:</b> ${esc(voucherDisplay)} · <b>Branch:</b> ${esc(branchName)}</p>` +
        branchBreakdown(db, fund, branch) + disbursementSignatures(db, request, preparedById) + '</div>';
    // Reserve more room on the last detail sheet if numerous check deposits exist.
    // Up to 30 rows are still allowed per sheet. Short requests print as a single sheet.
    const finalPageCapacity = Math.max(8, Math.min(18, 30 - Math.max(0, deposits.length - 2) * 2));
    const batches = [];
    let remaining = rows.slice();
    while (remaining.length > finalPageCapacity) {
        const count = Math.min(30, remaining.length - finalPageCapacity);
        batches.push(remaining.splice(0, count));
    }
    batches.push(remaining);
    const detail = batches.map((part, index) => {
        const final = index === batches.length - 1;
        return `<section class="print-page fund-print" data-density="${part.length <= 15 ? 'roomy' : part.length <= 25 ? 'mid' : 'compact'}">` +
            header(title, `${range} · Sheet ${index + 1} of ${batches.length}`) + meta(branchName, range, expenses.at(-1)?.no) +
            listTable(['Date', 'Reference', 'Supplier', 'Description / Part', 'Category', 'CV No.', 'Receipt', 'VAT', 'Non-VAT', 'Status'], part, [9, 17, 12, 17, 12, 9, 8, 7, 7, 12]) +
            `<div class="footline"><span>${part.length} expense rows this sheet · maximum 30</span><span>Total expense rows: ${rows.length}</span></div>` +
            (final ? summary : '') + '</section>';
    }).join('');
    openPrint(`${title} · ${branchName}`, detail, db.settings.reportLogo?.data);
}
function printRFPParts(db, branch, from = '', to = '') {
    const items = db.fundEntries.filter(e => e.fund === 'RFP' && e.kind === 'expense' && e.branch === branch && (0, data_1.reportDateMatch)(e.date, from, to));
    const range = period(from, to), name = (0, data_1.BRANCH_NAME)(branch);
    const rows = items.map(e => { const linked = db.pos.find(p => p.id === e.linkedPosId); const car = linked?.vehicle || db.pos.find(p => p.branch === e.branch && (0, data_1.normalizePlate)(p.plate) === (0, data_1.normalizePlate)(e.plate || ''))?.vehicle || e.car || 'Not recorded'; return [displayed(e.date), displayed(e.no), displayed(e.description), displayed(e.payee), displayed(e.plate), displayed(car), displayed((0, data_1.BRANCH_NAME)(e.branch)), displayed(e.quantity || 1), displayed(fmt(e.unitCost || 0)), displayed(fmt(e.amount)), displayed(linked?.no || 'Unlinked'), displayed(e.proof?.name || 'MISSING'), displayed(e.status)]; });
    const total = items.filter(e => e.status !== 'Rejected').reduce((n, e) => n + e.amount, 0);
    const summary = `<div class="metrics">${metric('Included Expenses', total)}${metric('Unlinked Parts', items.filter(e => !e.linkedPosId).length)}${metric('Missing Receipts', items.filter(e => !e.proof).length)}${metric('Rejected Amount', items.filter(e => e.status === 'Rejected').reduce((n, e) => n + e.amount, 0))}</div>` + signatures(db, items.at(-1)?.createdBy);
    const chunks = [];
    let remaining = rows.slice();
    // Reserve space on the final sheet for totals/signatures. Small reports stay on one sheet.
    while (remaining.length > 18) {
        const n = Math.min(30, remaining.length - 18);
        chunks.push(remaining.splice(0, n));
    }
    chunks.push(remaining);
    const html = chunks.map((chunk, i) => page(header('RFP · PARTS EXPENSES', `${range} · Sheet ${i + 1} of ${chunks.length}`) + meta(name, range) + listTable(['Date', 'RFP Ref', 'Part', 'Supplier', 'Plate', 'Car', 'Branch', 'Qty', 'Unit Cost', 'Amount', 'Linked POS', 'Receipt', 'Status'], chunk, [7, 12, 10, 10, 7, 9, 9, 4, 7, 7, 9, 5, 4]) + `<div class="footline"><span>Details: ${chunk.length} rows · 30 maximum per sheet</span><span>Total records: ${rows.length}</span></div>` + (i === chunks.length - 1 ? summary : ''))).join('');
    openPrint('RFP Parts Expenses', html, db.settings.reportLogo?.data);
}
/** RFP replenishment request: only parts purchased after previous approved disbursement.
 * Includes summary on the final A4 sheet whenever it fits. */
function printPBDisbursement(db, branch, preparedById) {
    const name = (0, data_1.BRANCH_NAME)(branch);
    const previous = db.fundEntries.filter(e => e.branch === branch && e.fund === 'RFP' && e.kind === 'replenishment' && e.status === 'Approved').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastCutoff = previous?.createdAt;
    const activeRequest = db.fundEntries.filter(e => e.branch === branch && e.fund === 'RFP' && e.kind === 'replenishment' && e.status === 'Pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const items = (0, data_1.pendingRFPDisbursementRows)(db, branch).filter(e => !activeRequest || e.createdAt <= activeRequest.createdAt);
    const amount = items.reduce((n, e) => n + e.amount, 0);
    const currentFund = db.settings.rfpBase[branch] || 0;
    const cashOnHand = (0, data_1.balance)(db, branch, 'RFP');
    const due = activeRequest?.amount ?? (0, data_1.replenishmentDue)(db, branch, 'RFP');
    const request = findReplenishment(db, branch, 'RFP');
    const rows = items.map(e => [
        displayed((0, data_1.datePH)(e.date)), displayed(e.no), displayed(e.description), displayed(e.payee), displayed(e.plate),
        displayed(db.pos.find(p => p.id === e.linkedPosId)?.vehicle || e.car || 'Not recorded'), displayed(e.quantity || 1),
        displayed(fmt(e.unitCost || 0)), displayed(fmt(e.amount)), displayed(e.proof?.name || 'MISSING'), displayed(e.status)
    ]);
    const range = previous ? `After last approved disbursement request: ${dateTime(lastCutoff)}` : 'From start of recorded purchases (no completed replenishment)';
    const summary = `<div class="fund-summary"><div class="fund-summary-title">Automatic RFP Replenishment Request · ${esc(name)}</div>` +
        `<div class="fund-figures"><div><span>Original Parts Fund</span><strong>${fmt(currentFund)}</strong></div><div><span>Eligible Parts Expenses</span><strong>${fmt(amount)}</strong></div><div><span>Cash on Hand (Estimated)</span><strong>${fmt(cashOnHand)}</strong></div><div><span>Previous Replenishment</span><strong>${esc(previous?.no || 'None')}</strong></div><div><span>Purchases Covered</span><strong>${items.length}</strong></div></div>` +
        `<div class="fund-request-result"><span>AMOUNT TO REPLENISH · eligible unreplenished parts expenses</span><strong>${fmt(due)}</strong></div>` +
        `<small>This is a replenishment of spent parts money, not a new fund request. Pending and rejected purchase decisions are listed for review, but rejected expenses are excluded. Earlier completed disbursements are not duplicated.</small>` +
        `<p class="voucher-series"><b>Current request:</b> ${esc(request?.no || 'Draft · not submitted')} · <b>Previous completed:</b> ${esc(previous?.no || 'First disbursement')} · <b>Cutoff:</b> ${esc(lastCutoff ? dateTime(lastCutoff) : 'None')}</p>` +
        `<p class="mini"><b>Check / Deposit Details:</b> ${esc(request?.bank || 'Bank pending')} · ${esc(request?.checkNo || 'Check reference pending')} · Only funds actually received are credited.</p>` + branchBreakdown(db, 'RFP', branch) + disbursementSignatures(db, request, preparedById) + '</div>';
    const batches = pagination(rows, 18);
    const html = batches.map((batch, i) => `<section class="print-page fund-print" data-density="${batch.length <= 15 ? 'roomy' : batch.length <= 25 ? 'mid' : 'compact'}">` +
        header('RFP DISBURSEMENT / REPLENISHMENT', `Sheet ${i + 1} of ${batches.length}`) + meta(name, range, previous?.no || 'First disbursement') +
        listTable(['Date', 'RFP Ref', 'Part', 'Supplier', 'Plate', 'Car', 'Qty', 'Unit Cost', 'Total', 'Receipt', 'Status'], batch, [8, 14, 12, 12, 8, 11, 4, 8, 8, 8, 7]) +
        `<div class="footline"><span>${batch.length} purchases on this sheet · maximum 18 with signatures</span><span>${rows.length} transactions after last completed disbursement</span></div>` + (i === batches.length - 1 ? summary : '') + '</section>').join('');
    openPrint(`RFP Disbursement · ${name}`, html, db.settings.reportLogo?.data);
}
function printSales(db, branch, from = '', to = '') {
    const pos = db.pos.filter(p => p.branch === branch && p.status === 'Closed' && (0, data_1.reportDateMatch)((0, data_1.posClosedDate)(p), from, to));
    const name = (0, data_1.BRANCH_NAME)(branch), range = period(from, to);
    const rows = pos.map(p => [displayed((0, data_1.posClosedDate)(p)), displayed(p.no), displayed(p.client), displayed(p.vehicle), displayed(p.plate), displayed(fmt((0, data_1.posTotal)(p))), displayed(fmt((0, data_1.paidTotal)(p))), displayed(fmt((0, data_1.posCOGS)(p, db))), displayed(fmt((0, data_1.posTotal)(p) - (0, data_1.posCOGS)(p, db)))]);
    const detail = reportPages('CLOSED SALES SUMMARY', name, range, ['Closed Date', 'POS No.', 'Customer', 'Vehicle', 'Plate', 'Gross Sales', 'Payments', 'COGS', 'Gross Profit'], rows, [10, 19, 14, 11, 10, 9, 9, 9, 9]);
    const s = pos.reduce((v, p) => ({ sales: v.sales + (0, data_1.posTotal)(p), payments: v.payments + (0, data_1.paidTotal)(p), cogs: v.cogs + (0, data_1.posCOGS)(p, db) }), { sales: 0, payments: 0, cogs: 0 });
    openPrint('Closed Sales Summary', detail + page(header('CLOSED SALES · SUMMARY', range) + meta(name, range) + `<div class="metrics">${metric('Gross Sales', s.sales)}${metric('Payments', s.payments)}${metric('COGS (POS + RFP Linked)', s.cogs)}${metric('Gross Profit', s.sales - s.cogs)}</div><div class="notice">Only CLOSED POS transactions whose actual closure date falls in this period appear here. RFP-linked parts replace matching manually encoded part costs to avoid double counting.</div>${signatures(db, pos.at(-1)?.createdBy)}`));
}
function printPOS(db, p) {
    const title = 'POS QUOTATION / TRANSACTION', branch = (0, data_1.BRANCH_NAME)(p.branch);
    const lines = p.items.map((e, i) => `<tr>${cell(i + 1)}${cell(e.type)}${cell(e.name)}${cell(e.qty)}${cell(fmt(e.price), true)}${cell(fmt((0, data_1.posLineTotal)(e)), true)}${cell(e.supplier || '—')}${cell(e.receiptNo || '—')}</tr>`).join('');
    const payments = p.payments.map(x => `<tr>${cell(x.date)}${cell(x.mode)}${cell(fmt(x.amount), true)}</tr>`).join('');
    const costRows = (0, data_1.posCostBreakdown)(p, db);
    const categories = [['From Inventory', costRows.filter(x => x.source.startsWith('From Inventory'))], ['PB / RFP Purchases', costRows.filter(x => x.source.startsWith('PB / RFP'))], ['Other / Manual POS Costs', costRows.filter(x => x.source === 'POS / Manual COGS')]];
    const costs = categories.map(([label, rows]) => `<tr class="total"><td colspan="2">${esc(label)}</td><td class="num">${fmt(rows.reduce((n, x) => n + x.amount, 0))}</td></tr>${rows.map(x => `<tr>${cell(x.description)}${cell(x.source)}${cell(fmt(x.amount), true)}</tr>`).join('')}`).join('');
    const linked = db.pos.filter(x => x.id === p.id || x.parentId === p.id || x.id === p.parentId).map(x => x.no).join(' · ');
    const body = page(header(title, p.no) + meta(branch, p.date, p.no) + `<p><b>Customer:</b> ${esc(p.client)} &nbsp; <b>Phone:</b> ${esc(p.phone)} &nbsp; <b>Vehicle:</b> ${esc(p.vehicle)} &nbsp; <b>Plate:</b> ${esc((0, data_1.normalizePlate)(p.plate))} &nbsp; <b>Status:</b> ${esc(p.status)}</p><p><b>Concern:</b> ${esc(p.concern)} &nbsp; <b>Linked History:</b> ${esc(linked || '—')}</p><div class="summary-section"><h2>Itemized Charges</h2><table class="compact-table" style="max-width:none"><tr><th>#</th><th>Type</th><th>Service / Part</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Supplier</th><th>Receipt</th></tr>${lines}</table></div><div class="metrics">${metric('Quotation Total', (0, data_1.posTotal)(p))}${metric('Payments Received', (0, data_1.paidTotal)(p))}${metric('Balance Due', Math.max(0, (0, data_1.posTotal)(p) - (0, data_1.paidTotal)(p)))}${metric('Recorded COGS', (0, data_1.posCOGS)(p, db))}</div><div class="summary-section"><h2>Payment Records</h2><table class="compact-table"><tr><th>Date</th><th>Mode</th><th>Amount</th></tr>${payments}</table></div><div class="summary-section"><h2>Itemized Cost of Goods Sold · Inventory / PB / Manual</h2><table class="compact-table"><tr><th>Part / Service</th><th>Cost Source</th><th>Amount</th></tr>${costs}</table></div>${signatures(db, p.createdBy)}`);
    openPrint(`POS ${p.no}`, body, db.settings.reportLogo?.data);
}
function printCashCounts(db, branch, from = '', to = '') {
    const counts = db.counts.filter(c => c.branch === branch && (0, data_1.reportDateMatch)(c.date, from, to));
    const range = period(from, to), name = (0, data_1.BRANCH_NAME)(branch);
    const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '1', '0.25'];
    const pages = counts.map(c => page(header(`${c.kind} CASH COUNT SHEET`, c.date) + meta(name, (0, data_1.datePH)(c.date), c.id) + `<div class="metrics">${metric('Expected', c.expected)}${metric('Actual', c.actual)}${metric('Variance', c.difference)}${metric('Denomination Total', denoms.reduce((sum, d) => sum + Number(d) * (c.denominations?.[d] || 0), 0))}</div><div class="summary-section"><h2>Denomination Breakdown · ${esc(c.scope || 'Sales Cash')}</h2><table class="compact-table"><tr><th>Denomination</th><th>Quantity</th><th>Amount</th></tr>${denoms.map(d => `<tr>${cell('₱' + d)}${cell(c.denominations?.[d] ?? 'Not recorded')}${cell(fmt(Number(d) * (c.denominations?.[d] || 0)), true)}</tr>`).join('')}</table></div><p class="notes"><b>Cashier Notes:</b> ${esc(c.notes || '—')}</p>${signatures(db, c.userId, c.signature, dateTime(c.createdAt))}`)).join('');
    openPrint('BOD / EOD Cash Count', pages || page(header('CASH COUNT', range) + meta(name, range) + '<p>No cash-count records for the selected period.</p>'), db.settings.reportLogo?.data);
}
function printTurnovers(db, branch, from = '', to = '', kind = 'Sales') {
    const rows = db.turnovers.filter(t => t.branch === branch && (t.kind || 'Sales') === kind && (0, data_1.reportDateMatch)(t.date, from, to));
    const range = period(from, to), name = (0, data_1.BRANCH_NAME)(branch);
    const detail = reportPages(`FRIDAY ${kind.toUpperCase()} TURNOVER`, name, range, ['Date', 'Reference', 'Expected Cash', 'Actual Cash Received', 'Variance', 'Submitted By', 'Remarks'], rows.map(t => [displayed(t.date), displayed(t.id.slice(0, 12)), displayed(fmt(t.expected ?? t.amount)), displayed(fmt(t.actual ?? t.amount)), displayed(fmt(t.variance ?? 0)), displayed(db.users.find(u => u.id === t.createdBy)?.name), displayed(t.notes)]), [12, 18, 14, 16, 13, 15, 12]);
    const total = rows.reduce((v, t) => ({ expected: v.expected + (t.expected ?? t.amount), actual: v.actual + (t.actual ?? t.amount) }), { expected: 0, actual: 0 });
    openPrint(`${kind} Turnover`, detail + page(header(`FRIDAY ${kind.toUpperCase()} TURNOVER · SUMMARY`, range) + meta(name, range) + `<div class="metrics">${metric('Expected Cash', total.expected)}${metric('Actual Received', total.actual)}${metric('Variance', total.actual - total.expected)}</div>${signatures(db, rows.at(-1)?.createdBy, rows.at(-1)?.signature, rows.at(-1) ? dateTime(rows.at(-1).createdAt) : undefined)}`));
}
function printReconciliation(db, branch, from = '', to = '') {
    const range = period(from, to), name = (0, data_1.BRANCH_NAME)(branch);
    const closed = db.pos.filter(p => p.branch === branch && p.status === 'Closed' && (0, data_1.reportDateMatch)((0, data_1.posClosedDate)(p), from, to));
    const cashSales = closed.reduce((v, p) => v + p.payments.filter(x => x.mode === 'Cash').reduce((a, x) => a + x.amount, 0), 0);
    const counts = db.counts.filter(c => c.branch === branch && (0, data_1.reportDateMatch)(c.date, from, to));
    const rf = (0, data_1.disbursementSummary)(db, branch, 'RF', from, to);
    const turnovers = db.turnovers.filter(t => t.branch === branch && (0, data_1.reportDateMatch)(t.date, from, to));
    const salesTurnover = turnovers.filter(t => (t.kind || 'Sales') === 'Sales').reduce((a, t) => a + (t.actual ?? t.amount), 0);
    const discrepancy = counts.reduce((a, c) => a + c.difference, 0);
    const lines = [['Cash Sales (Closed POS)', cashSales], ['Opening Revolving Fund', rf.opening], ['RF Expenses', -rf.expenses], ['RF Replenishments', rf.deposits], ['RF Closing Balance', rf.remaining], ['Daily Sales Turnover', salesTurnover], ['Recorded Cash Count Variances', discrepancy]];
    const body = page(header('DAILY / PERIOD RECONCILIATION', range) + meta(name, range) + `<div class="metrics">${metric('Cash Sales', cashSales)}${metric('RF Movements', rf.deposits - rf.expenses)}${metric('Sales Turned Over', salesTurnover)}${metric('Cash Count Variance', discrepancy)}</div><div class="summary-section"><h2>Cash Movements & Reconciliation</h2><table class="compact-table">${lines.map(([label, val]) => tRow(String(label), fmt(Number(val)))).join('')}</table></div><div class="notice">Cash Sales, Revolving Fund, and RFP are separate accounts. Variance is the sum of recorded count differences, not an assumed settlement balance. Review cash counts against sales and turnover records.</div>${signatures(db, counts.at(-1)?.userId)}`);
    openPrint('Daily Cashier Reconciliation', body, db.settings.reportLogo?.data);
}
function printAudit(db, from = '', to = '') {
    const range = period(from, to), events = db.audit.filter(a => (0, data_1.reportDateMatch)(a.at.slice(0, 10), from, to));
    const rows = events.map(a => {
        const i = a.detail.indexOf(' · OLD '), j = a.detail.indexOf(' → NEW ');
        const subject = i >= 0 ? a.detail.slice(0, i) : a.detail, old = i >= 0 && j > i ? a.detail.slice(i + 7, j) : '—', next = j >= 0 ? a.detail.slice(j + 7) : '—';
        return [displayed(dateTime(a.at)), displayed(db.users.find(u => u.id === a.by)?.name || a.by), displayed(a.action), displayed(subject), displayed(old), displayed(next)];
    });
    const detail = reportPages('AUDIT TRAIL', 'All authorized branches', range, ['Timestamp', 'User', 'Action', 'Details', 'Original Value', 'New Value'], rows, [14, 14, 17, 19, 18, 18]);
    openPrint('Audit Trail', detail, db.settings.reportLogo?.data);
}
/** The independent receipt print view is period-aware and makes missing attachments explicit.
 * Image receipts are embedded. PDF attachments are linked to their original PDF data;
 * automated multi-page PDF rendering / merging is NOT implemented in the frontend preview. */
function printReceipts(entries, branch, fund, from = '', to = '', logo) {
    const rows = entries.filter(e => e.branch === branch && e.fund === fund && e.kind === 'expense' && (0, data_1.reportDateMatch)(e.date, from, to));
    const imageRows = rows.filter(e => e.proof?.data.startsWith('data:image/'));
    const pdfRows = rows.filter(e => e.proof && !e.proof.data.startsWith('data:image/'));
    const missing = rows.filter(e => !e.proof);
    const range = period(from, to), name = (0, data_1.BRANCH_NAME)(branch);
    const pages = pagination(imageRows, 6).map((chunk, i) => page(header(`${fund} RECEIPT ATTACHMENTS`, `${range} · Images page ${i + 1}`) + meta(name, range) + `<div class="receipt-grid">${chunk.map(e => `<div class="receipt"><div class="name"><b>${esc(e.no)}</b><span>${fmt(e.amount)} · ${esc((0, data_1.datePH)(e.date))}</span></div><img src="${e.proof.data}" alt="Receipt of ${esc(e.no)}"/><small>${esc(e.proof.name)}</small></div>`).join('')}</div>`)).join('');
    const references = page(header('RECEIPT ATTACHMENT INDEX', range) + meta(name, range) + `<div class="metrics">${metric('Expense Records', rows.length)}${metric('Image Receipts', imageRows.length)}${metric('Original PDF Receipts', pdfRows.length)}${metric('Missing Attachments', missing.length)}</div><div class="summary-section"><h2>Missing Attachments</h2>${missing.length ? `<table class="compact-table">${missing.map(e => `<tr>${cell(e.no)}${cell(e.payee)}${cell((0, data_1.datePH)(e.date))}${cell('MISSING')}</tr>`).join('')}</table>` : '<p>No missing attachments.</p>'}</div><div class="summary-section"><h2>Original PDF Receipts (Separate Original Files)</h2>${pdfRows.length ? `<table class="compact-table">${pdfRows.map(e => `<tr>${cell(e.no)}${cell(e.proof?.name)}<td><a href="${e.proof.data}" target="_blank" rel="noopener">Open original PDF</a></td></tr>`).join('')}</table>` : '<p>No PDF attachments.</p>'}</div><div class="notice">Uploaded PDF receipts are available as original files, not automatically rasterized or merged into this printable HTML. Save this print preview as PDF for embedded image receipts.</div>`);
    openPrint(`${fund} Receipts`, pages + references, logo);
}
