'use client';
/**
 * v9.45 — RFP Disbursement Report in the same layout as the Parts Buyer's Google Sheet
 * ("2026 Phoebe - GEN PETTY DISBURSEMENT"). Built from live RFP purchase orders, ready to print
 * or download as Excel. One row per PO; the amount goes under the branch the parts were for.
 */
import { useMemo, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { Database, FundEntry } from '@/lib/data';
import { rfpPoolBase } from '@/lib/data';
import { SignaturePad } from '@/components/Ui';

const BR = [['MMM', 'MASTER MIND AMOUNT PAID'], ['UCLP', 'LAS PIÑAS BRANCH AMOUNT PAID'], ['UCQC', 'QC BRANCH AMOUNT PAID'], ['UCM', 'MANDA BRANCH AMOUNT PAID']] as const;
const HEADS = ['Date', ...BR.map(b => b[1]), 'SUPPLIER', 'SUPPLIER TIN No.', 'ONLINE PAYMENT/ REFUND', 'ONLINE PAYMENT CHARGE', 'TOTAL AMOUNT EXPENSES', 'Remarks', 'Notes'];
const peso = (n: number) => n ? '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
const pesoZ = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ph = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
const dShort = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`; };
const dLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
/** "Toyota Vios 2020" + "NBW7568" → "2020 TOYOTA VIOS NBW7568" (same style as the sheet's Remarks) */
const unitLabel = (car: string, plate: string) => { const m = car.trim().match(/^(.*?)\s+(\d{4})$/); return [m ? m[2] : '', (m ? m[1] : car).toUpperCase(), plate].filter(Boolean).join(' ').trim(); };

type Row = { date: string; branch: string; amount: number; supplier: string; tin: string; refund: number; charge: number; total: number; remarks: string; notes: string };

export default function RFPDisbursementSheet({ db, preparedBy, preparedById, onClose }: { db: Database; preparedBy: string; preparedById?: string; onClose: () => void }) {
  const today = ph(new Date());
  const reps = db.fundEntries.filter(e => e.fund === 'RFP' && e.kind === 'replenishment' && e.status !== 'Rejected').sort((a, b) => a.date.localeCompare(b.date));
  const lastRep = reps[reps.length - 1];
  const [from, setFrom] = useState(lastRep ? lastRep.date : today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const prevReq = [...reps].reverse().find(r => r.date < from);
  const receivedInRange = reps.filter(r => r.status === 'Approved' && r.date >= from && r.date <= to).reduce((n, r) => n + r.amount, 0);
  const [refund, setRefund] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [lastReq, setLastReq] = useState('');
  const [checkedBy, setCheckedBy] = useState(db.settings.signatories?.checked || '');
  const [approvedBy, setApprovedBy] = useState(db.settings.signatories?.approved || 'PRESIDENT');
  // v9.45.3: preparer's signature — starts from the signature on their latest RFP purchase
  const lastSig = db.fundEntries.filter(e => e.fund === 'RFP' && e.signature && (!preparedById || e.createdBy === preparedById)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.signature || '';
  const [signature, setSignature] = useState(lastSig);
  const [signing, setSigning] = useState(!lastSig);

  const rows = useMemo<Row[]>(() => {
    const lines = db.fundEntries.filter(e => e.fund === 'RFP' && e.kind === 'expense' && e.status !== 'Rejected' && e.date >= from && e.date <= to);
    const refunds = (db.rfpReceipts || []).filter(r => r.type === 'refund' && r.status === 'Received');
    return [...new Set(lines.map(l => l.no))].map(no => {
      const ls: FundEntry[] = lines.filter(l => l.no === no); const f = ls[0];
      const amount = ls.reduce((n, l) => n + Number(l.amount || 0), 0);
      const charge = ls.reduce((n, l) => n + Number(l.onlineCharge || 0), 0);
      const ids = new Set(ls.map(l => l.id));
      const refund = refunds.filter(r => ids.has(r.purchaseId)).reduce((n, r) => n + r.amount, 0);
      return { date: f.date, branch: f.branch, amount, supplier: f.payee, tin: f.tin || '', refund, charge, total: amount + charge - refund, remarks: unitLabel(f.car || '', f.plate || ''), notes: [ls.map(l => l.description).join(', '), f.notes].filter(Boolean).join(' · ') };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [db, from, to]);

  const sum = (k: keyof Row) => rows.reduce((n, r) => n + Number(r[k] || 0), 0);
  const branchSum = (b: string) => rows.filter(r => r.branch === b).reduce((n, r) => n + r.amount, 0);
  const bf = rfpPoolBase(db);
  const expenses = sum('total');
  const remaining = bf - expenses;
  const refundAmt = refund === '' ? receivedInRange : Number(refund) || 0;
  const totalBalance = remaining + refundAmt;
  const requested = bf - totalBalance;
  const lastReqAmt = lastReq === '' ? (prevReq?.amount || 0) : Number(lastReq) || 0;
  const title = `${from === to ? dLong(from) : `${dLong(from)} – ${dLong(to)}`} DISBURSEMENT REPORT`;
  const summary: [string, string, string?][] = [
    ['Balance forwarded', pesoZ(bf), prevReq ? new Date(prevReq.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''],
    ['Less: Expenses', pesoZ(expenses)], ['Remaining fund', pesoZ(remaining)], ['Refund', pesoZ(refundAmt), refundNote], ['Total Balance', pesoZ(totalBalance)],
    ['Amount Requested', pesoZ(requested)], ['Amount Requested last cut off:', pesoZ(lastReqAmt)], ['Remaining fund last cut off :', pesoZ(bf - lastReqAmt)], ['TOTAL:', pesoZ(totalBalance + requested)],
  ];

  const sheetHtml = () => `<table class="ds"><colgroup><col style="width:8%"/>${BR.map(() => '<col style="width:6.5%"/>').join('')}<col style="width:9%"/><col style="width:7%"/><col style="width:6%"/><col style="width:6%"/><col style="width:7%"/><col style="width:21%"/><col style="width:9%"/></colgroup>
<tr><td colspan="11" class="ds-title">${esc(title)}</td><td class="ds-title"></td></tr>
<tr>${HEADS.map((h, i) => `<th class="${i === 9 ? 'ds-tot' : ''}">${esc(h)}</th>`).join('')}</tr>
${rows.map(r => `<tr><td class="c">${dShort(r.date)}</td>${BR.map(b => `<td class="n">${r.branch === b[0] ? peso(r.amount) : ''}</td>`).join('')}<td>${esc(r.supplier)}</td><td>${esc(r.tin)}</td><td class="n">${peso(r.refund)}</td><td class="n">${peso(r.charge)}</td><td class="n">${pesoZ(r.total)}</td><td class="r">${esc(r.remarks)}</td><td>${esc(r.notes)}</td></tr>`).join('')}
${rows.length ? '' : '<tr><td colspan="12" class="c" style="padding:14px;color:#888">No RFP purchases in this period.</td></tr>'}
<tr class="ds-sum"><td class="c">TOTAL</td>${BR.map(b => `<td class="n">${pesoZ(branchSum(b[0]))}</td>`).join('')}<td></td><td></td><td class="n">${pesoZ(sum('refund'))}</td><td class="n">${pesoZ(sum('charge'))}</td><td class="n ds-tot">${pesoZ(expenses)}</td><td></td><td></td></tr>
</table>
<div class="ds-bottom"><table class="ds-s">${summary.map(([l, v, x], i) => `<tr class="${i === 0 || i === 8 ? 'cy' : i === 5 ? 'yl' : ''}"><td>${esc(l)}</td><td class="n">${v}</td><td>${esc(x || '')}</td></tr>`).join('')}</table>
<table class="ds-sig"><tr><td>PREPARED BY:</td><td class="sigcell">${signature.startsWith('data:image/') ? `<img src="${signature}" alt="Signature"/>` : ''}<div>${esc(preparedBy.toUpperCase())}</div></td></tr><tr><td>CHECKED BY:</td><td>${esc(checkedBy)}</td></tr><tr><td>APPROVED BY:</td><td>${esc(approvedBy)}</td></tr></table></div>`;

  const sheetCss = `.ds{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:9.5px;table-layout:fixed}
.ds td,.ds th{border:1px solid #9aa0a6;padding:3px 4px;vertical-align:middle;overflow-wrap:anywhere}
.ds .ds-title{background:#ffff00;text-align:center;font-weight:700;font-size:13px;padding:8px}
.ds th{background:#fce5cd;color:#e00000;font-weight:700;font-size:9px;text-align:center}
.ds th.ds-tot,.ds td.ds-tot{background:#00ffff;color:#000}
.ds .n{text-align:right;font-weight:700}.ds .c{text-align:center;font-weight:700}.ds .r{text-align:right;font-weight:700}
.ds .ds-sum td{background:#ffff00;font-weight:700}
.ds-bottom{display:flex;gap:24px;margin-top:14px;font-family:Arial,sans-serif;align-items:flex-start}
.ds-s{border-collapse:collapse;font-size:11px;min-width:42%}.ds-s td{padding:4px 8px;font-weight:700}.ds-s td.n{text-align:right}
.ds-s .cy td:first-child,.ds-s .cy td.n{background:#00ffff}.ds-s .yl td:first-child,.ds-s .yl td.n{background:#ffff00}
.ds-sig{border-collapse:collapse;font-size:11px;font-weight:700;margin-left:auto}.ds-sig td{padding:10px 12px;vertical-align:bottom}.ds-sig .sigcell{text-align:center;min-width:180px}.ds-sig .sigcell img{display:block;height:44px;max-width:200px;object-fit:contain;margin:0 auto -6px}.ds-sig .sigcell div{border-top:1px solid #333;padding-top:3px}`;

  /** v9.45.1: print from a hidden frame on the same page (pop-up windows are often blocked) */
  function print() {
    const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:8mm}html,body{margin:0;background:#fff}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}${sheetCss}</style></head><body>${sheetHtml()}</body></html>`;
    document.getElementById('rfp-ds-print')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'rfp-ds-print';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const w = frame.contentWindow;
    if (!w) { window.alert('Printing is not available in this browser.'); return; }
    w.document.open(); w.document.write(doc); w.document.close();
    const go = () => { try { w.focus(); w.print(); } catch { window.alert('Could not open the print window. Try Download Excel, or open the system in Chrome.'); } };
    // wait for layout/fonts before printing
    if (w.document.readyState === 'complete') setTimeout(go, 250); else frame.onload = () => setTimeout(go, 250);
  }

  async function downloadExcel() {
    const XLSX = await import('xlsx');
    const aoa: (string | number)[][] = [[title], HEADS,
      ...rows.map(r => [dShort(r.date), ...BR.map(b => r.branch === b[0] ? r.amount : ''), r.supplier, r.tin, r.refund || '', r.charge || '', r.total, r.remarks, r.notes]),
      ['TOTAL', ...BR.map(b => branchSum(b[0])), '', '', sum('refund'), sum('charge'), expenses, '', ''], [],
      ...summary.map(([l, v, x]) => [l, Number(v.replace(/[₱,]/g, '')), x || '']), [],
      ['PREPARED BY:', preparedBy.toUpperCase()], ['CHECKED BY:', checkedBy], ['APPROVED BY:', approvedBy]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [12, 14, 16, 14, 16, 20, 14, 14, 14, 16, 40, 24].map(w => ({ wch: w }));
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (from === to ? from : `${from} to ${to}`).slice(0, 31));
    XLSX.writeFile(wb, `RFP Disbursement ${from}${from === to ? '' : ' to ' + to}.xlsx`);
  }

  return <div className="dsm-scrim" onClick={onClose}>
    <div className="dsm" role="dialog" aria-modal="true" aria-label="RFP disbursement report" onClick={e => e.stopPropagation()}>
      <div className="dsm-head"><div><h3>RFP Disbursement Report</h3><p>Same layout as your disbursement sheet. Built from Parts Buyer purchases — check, then print or download.</p></div><button type="button" className="dsm-x" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
      <div className="dsm-controls">
        <label>From<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <label>Refund / received (₱)<input type="number" min="0" step="0.01" placeholder={String(receivedInRange)} value={refund} onChange={e => setRefund(e.target.value)} /></label>
        <label>Refund note<input placeholder="e.g. FROM MS KATE" value={refundNote} onChange={e => setRefundNote(e.target.value)} /></label>
        <label>Requested last cut off (₱)<input type="number" min="0" step="0.01" placeholder={String(prevReq?.amount || 0)} value={lastReq} onChange={e => setLastReq(e.target.value)} /></label>
        <label>Checked by<input value={checkedBy} onChange={e => setCheckedBy(e.target.value)} /></label>
        <label>Approved by<input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} /></label>
      </div>
      <div className="dsm-sign">
        <div><strong>Your signature (Prepared by)</strong><span>{signature ? (signing ? 'Sign below, it updates the report right away.' : 'Using your signature from your latest purchase.') : 'Sign below to put your signature on the report.'}</span></div>
        {signing ? <div className="dsm-pad"><SignaturePad value={signature} onChange={setSignature} />{signature && <button type="button" className="dsm-btn" onClick={() => setSigning(false)}>Done</button>}</div>
          : <div className="dsm-sig-preview">{signature && <img src={signature} alt="Your signature" />}<button type="button" className="dsm-btn" onClick={() => { setSignature(''); setSigning(true); }}>Sign again</button></div>}
      </div>
      <div className="dsm-actions"><span>{rows.length} PO{rows.length === 1 ? '' : 's'} · expenses {pesoZ(expenses)} · amount requested <b>{pesoZ(requested)}</b></span><button type="button" className="dsm-btn" onClick={() => void downloadExcel()}><Download size={15} /> Download Excel</button><button type="button" className="dsm-btn dsm-main" onClick={print}><Printer size={15} /> Print</button></div>
      <div className="dsm-preview"><style>{sheetCss}</style><div dangerouslySetInnerHTML={{ __html: sheetHtml() }} /></div>
    </div>
  </div>;
}
