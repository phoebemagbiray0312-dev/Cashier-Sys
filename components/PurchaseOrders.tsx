'use client';
/**
 * v9.43 — Purchase Orders (simpler replacement of RFPReconciliation).
 * Flow: (1) Parts Buyer buys parts for a unit and uploads the payment screenshot
 *       (2) Cashier attaches the supplier's receipt for that PO
 *       (3) Done when the receipt amount matches the PO; a mismatch is marked "Doesn't match".
 * Receipts are saved online in the `rfpReceipts` collection (same records as before).
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileImage, Search, Upload, X } from 'lucide-react';
import type { BranchId, FundEntry, POS, RFPReceiptRecord } from '@/lib/data';
import { BRANCH_NAME, expenseGross, normalizePlate, pesos } from '@/lib/data';

type Stage = 'receipt' | 'done' | 'problem';
type Doc = { name: string; data: string };
type PO = {
  no: string; date: string; branch: BranchId; plate: string; car: string; supplier: string;
  lines: FundEntry[]; total: number; payment?: Doc; receipt?: RFPReceiptRecord; refunds: RFPReceiptRecord[]; stage: Stage; unit?: POS;
};
const STAGE: Record<Stage, { label: string; cls: string }> = {
  receipt: { label: 'Needs supplier receipt', cls: 'po-st-wait' },
  done: { label: 'Complete', cls: 'po-st-ok' },
  problem: { label: "Receipt doesn't match", cls: 'po-st-bad' },
};

function readFile(file: File): Promise<Doc> {
  return new Promise((resolve, reject) => {
    if (file.size > 2_500_000) return reject(new Error('File is too large (max 2.5 MB). Take a smaller photo or compress it.'));
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) return reject(new Error('Use a photo (JPG/PNG/WebP) or a PDF.'));
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file. Try again.'));
    r.onload = () => resolve({ name: file.name, data: String(r.result || '') });
    r.readAsDataURL(file);
  });
}

export default function PurchaseOrders({ purchases, pos, role, branch, userName, records, onSave }: {
  purchases: FundEntry[]; pos: POS[]; role: string; branch: BranchId | 'ALL'; userName: string;
  records: RFPReceiptRecord[]; onSave: (next: RFPReceiptRecord[]) => boolean;
}) {
  const cashier = role === 'cashier' || role === 'admin';
  const [openNo, setOpenNo] = useState('');
  const [filter, setFilter] = useState<'all' | Stage>('all');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Doc | null>(null);
  const [msg, setMsg] = useState('');
  // receipt form
  const [file, setFile] = useState<Doc | null>(null);
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [replacing, setReplacing] = useState(false);
  // refund form (PB)
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmt, setRefundAmt] = useState('');
  const [refundRef, setRefundRef] = useState('');

  const superseded = (r: RFPReceiptRecord) => records.some(x => x.replacesId === r.id);

  const orders = useMemo<PO[]>(() => {
    const lines = purchases.filter(p => p.fund === 'RFP' && p.kind === 'expense' && p.status !== 'Rejected' && (branch === 'ALL' || p.branch === branch));
    const nos = [...new Set(lines.map(l => l.no))];
    return nos.map(no => {
      const ls = lines.filter(l => l.no === no);
      const first = ls[0];
      const ids = new Set(ls.map(l => l.id));
      const receipt = records.filter(r => r.type === 'receipt' && ids.has(r.purchaseId) && !superseded(r)).sort((a, b) => b.at.localeCompare(a.at))[0];
      const refunds = records.filter(r => r.type === 'refund' && ids.has(r.purchaseId));
      const total = ls.reduce((n, l) => n + expenseGross(l), 0);
      const stage: Stage = !receipt ? 'receipt' : receipt.status === 'Discrepancy' ? 'problem' : 'done';
      const unit = pos.find(p => p.id === first.linkedPosId) || pos.filter(p => p.branch === first.branch && normalizePlate(p.plate) === normalizePlate(first.plate || '')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return { no, date: first.date, branch: first.branch, plate: first.plate || '', car: first.car || unit?.vehicle || '', supplier: first.payee, lines: ls, total, payment: ls.find(l => l.proof?.data)?.proof, receipt, refunds, stage, unit };
    }).sort((a, b) => (a.stage === 'done' ? 1 : 0) - (b.stage === 'done' ? 1 : 0) || b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  }, [purchases, pos, branch, records]);

  const count = (s: 'all' | Stage) => s === 'all' ? orders.length : orders.filter(o => o.stage === s).length;
  const q = query.trim().toLowerCase();
  const shown = orders.filter(o => (filter === 'all' || o.stage === filter) && (!q || [o.no, o.plate, o.car, o.supplier, ...o.lines.map(l => l.description)].join(' ').toLowerCase().includes(q)));
  const po = orders.find(o => o.no === openNo);

  function open(no: string) { setOpenNo(no); setMsg(''); setFile(null); setRef(''); setReplacing(false); setRefundOpen(false); const o = orders.find(x => x.no === no); setAmount(o ? String(o.total) : ''); window.scrollTo({ top: 0 }); }

  async function pick(f?: File) { if (!f) return; try { setFile(await readFile(f)); setMsg(''); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not read file.'); } }

  function saveReceipt() {
    if (!po) return;
    const n = Number(amount);
    if (!file) return setMsg('Take a photo or attach the supplier receipt first.');
    if (!Number.isFinite(n) || n <= 0) return setMsg('Enter the amount written on the receipt.');
    const matches = Math.abs(n - po.total) < 0.01;
    const entry: RFPReceiptRecord = {
      id: crypto.randomUUID(), branch: po.branch, purchaseId: po.lines[0].id, type: 'receipt', amount: n, reference: ref.trim(),
      proof: file.data, proofName: file.name, status: matches ? 'Matched' : 'Discrepancy', by: userName, at: new Date().toISOString(),
      ...(matches ? {} : { reason: `Receipt ${pesos(n)} vs PO ${pesos(po.total)}` }),
      ...(replacing && po.receipt ? { replacesId: po.receipt.id } : {}),
    };
    if (onSave([entry, ...records])) { setMsg(matches ? 'Receipt saved. This PO is complete.' : `Saved, but the receipt (${pesos(n)}) doesn't match the PO (${pesos(po.total)}). Admin will see this.`); setFile(null); setReplacing(false); }
    else setMsg('Could not save. Please try again.');
  }

  function saveRefund() {
    if (!po) return;
    const n = Number(refundAmt);
    const already = po.refunds.reduce((s, r) => s + r.amount, 0);
    if (!Number.isFinite(n) || n <= 0 || n + already > po.total) return setMsg('Enter a refund amount that is not more than the PO total.');
    const entry: RFPReceiptRecord = { id: crypto.randomUUID(), branch: po.branch, purchaseId: po.lines[0].id, type: 'refund', amount: n, reference: refundRef.trim(), status: 'Pending', by: userName, at: new Date().toISOString() };
    if (onSave([entry, ...records])) { setMsg('Refund reported. The cashier will confirm when the money is received.'); setRefundOpen(false); setRefundAmt(''); setRefundRef(''); }
  }
  function confirmRefund(id: string) {
    if (onSave(records.map(r => r.id === id ? { ...r, status: 'Received' as const, reviewBy: userName, reviewAt: new Date().toISOString() } : r))) setMsg('Refund marked as received.');
  }

  const docBtn = (d: Doc | undefined, label: string) => d?.data
    ? <button type="button" className="po-doc" onClick={() => setPreview(d)}>{d.data.startsWith('data:image/') ? <img src={d.data} alt="" /> : <FileImage size={28} />}<span>{label}</span></button>
    : null;

  const steps = <ol className="po-steps" aria-label="How purchase orders work">
    <li><b>1</b><span><strong>Parts Buyer</strong> buys the part for the unit and uploads the payment screenshot</span></li>
    <li><b>2</b><span><strong>Cashier</strong> attaches the supplier&apos;s receipt</span></li>
    <li><b>3</b><span><strong>Complete</strong> when the receipt amount matches the PO</span></li>
  </ol>;

  return <section className="po-wrap">
    {!po ? <>
      <div className="po-head"><div><h3>Purchase Orders</h3><p>Parts bought by the Parts Buyer for each unit, and their supplier receipts.</p></div></div>
      {steps}
      <div className="po-tools">
        <div className="po-chips">{(['all', 'receipt', 'problem', 'done'] as const).map(s => <button key={s} type="button" className={'po-chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : STAGE[s].label}<b>{count(s)}</b></button>)}</div>
        <label className="po-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search PO, plate, supplier or part" /></label>
      </div>
      {shown.length === 0 ? <p className="po-empty">{orders.length ? 'No purchase orders match.' : 'No purchase orders yet. They appear here when the Parts Buyer records a parts purchase.'}</p>
        : <ul className="po-list">{shown.map(o => <li key={o.no}><button type="button" onClick={() => open(o.no)}>
          <span className="po-col-main"><strong>{o.plate || 'No plate'}{o.car ? <em> · {o.car}</em> : null}</strong><small>{o.no} · {o.supplier} · {o.lines.length} part{o.lines.length === 1 ? '' : 's'}{branch === 'ALL' ? ` · ${o.branch}` : ''}</small></span>
          <span className="po-col-amt">{pesos(o.total)}</span>
          <span className={'po-st ' + STAGE[o.stage].cls}>{o.stage === 'done' ? <CheckCircle2 size={13} /> : o.stage === 'problem' ? <CircleAlert size={13} /> : <Clock3 size={13} />}{STAGE[o.stage].label}</span>
          <ChevronRight size={18} className="po-chev" />
        </button></li>)}</ul>}
    </> : <>
      <button type="button" className="po-back" onClick={() => { setOpenNo(''); setMsg(''); }}><ArrowLeft size={15} /> All purchase orders</button>
      <div className="po-detail-head">
        <div><small>{po.no} · {po.date} · {BRANCH_NAME(po.branch)}</small><h3>{po.plate}{po.car ? ` · ${po.car}` : ''}</h3><p>{po.supplier}{po.unit ? ` · for ${po.unit.no} (${po.unit.client})` : ' · no POS yet for this plate'}</p></div>
        <div className="po-detail-total"><span className={'po-st ' + STAGE[po.stage].cls}>{STAGE[po.stage].label}</span><strong>{pesos(po.total)}</strong></div>
      </div>
      <table className="po-items"><thead><tr><th>Part</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{po.lines.map(l => <tr key={l.id}><td>{l.description}</td><td>{l.quantity || 1}</td><td>{pesos(expenseGross(l))}</td></tr>)}</tbody></table>

      <div className="po-pair">
        <div className="po-box">
          <h4><b>1</b> Parts Buyer payment</h4>
          {po.payment ? docBtn(po.payment, 'Payment screenshot') : <p className="po-missing">No payment screenshot uploaded.</p>}
        </div>
        <div className={'po-box' + (po.stage === 'receipt' ? ' po-box-todo' : '')}>
          <h4><b>2</b> Supplier receipt</h4>
          {po.receipt && !replacing ? <>
            {docBtn(po.receipt.proof ? { name: po.receipt.proofName || 'Receipt', data: po.receipt.proof } : undefined, 'Supplier receipt')}
            <p className="po-meta">{pesos(po.receipt.amount)}{po.receipt.reference ? ` · #${po.receipt.reference}` : ''} · by {po.receipt.by}</p>
            {po.stage === 'problem' && <p className="po-warn"><CircleAlert size={14} /> Receipt is {pesos(po.receipt.amount)} but the PO is {pesos(po.total)}.</p>}
            {cashier && <button type="button" className="po-btn" onClick={() => { setReplacing(true); setAmount(String(po.total)); }}>Replace receipt</button>}
          </> : cashier ? <div className="po-form">
            <label className="po-drop"><input type="file" accept="image/*,application/pdf" capture="environment" onChange={e => void pick(e.target.files?.[0])} />{file ? <><FileImage size={18} /> {file.name}</> : <><Camera size={18} /> Take photo or attach receipt</>}</label>
            <div className="po-row"><label>Amount on receipt (₱)<input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Receipt no. (optional)<input value={ref} onChange={e => setRef(e.target.value)} /></label></div>
            <div className="po-row-end">{replacing && <button type="button" className="po-btn" onClick={() => setReplacing(false)}>Cancel</button>}<button type="button" className="po-btn po-btn-main" onClick={saveReceipt}><Upload size={14} /> Save receipt</button></div>
          </div> : <p className="po-missing">Waiting for the cashier to attach the supplier receipt.</p>}
        </div>
      </div>

      {(po.refunds.length > 0 || !cashier) && <details className="po-refund" open={po.refunds.length > 0}>
        <summary>Supplier refund {po.refunds.length ? `(${po.refunds.length})` : ''}</summary>
        {po.refunds.map(r => <div key={r.id} className="po-refund-row"><span>{pesos(r.amount)}{r.reference ? ` · #${r.reference}` : ''} · reported by {r.by}</span><span className={'po-st ' + (r.status === 'Received' ? 'po-st-ok' : 'po-st-wait')}>{r.status === 'Received' ? 'Received by cashier' : 'Waiting for cashier'}</span>{cashier && r.status === 'Pending' && <button type="button" className="po-btn" onClick={() => confirmRefund(r.id)}>Mark received</button>}</div>)}
        {!cashier && (refundOpen ? <div className="po-row"><label>Refund amount (₱)<input type="number" min="0" step="0.01" value={refundAmt} onChange={e => setRefundAmt(e.target.value)} /></label><label>Reference<input value={refundRef} onChange={e => setRefundRef(e.target.value)} /></label><button type="button" className="po-btn po-btn-main" onClick={saveRefund}>Report refund</button></div>
          : <button type="button" className="po-btn" onClick={() => setRefundOpen(true)}>Supplier gave money back? Report a refund</button>)}
      </details>}
    </>}
    {msg && <p className="po-msg" role="status">{msg}</p>}

    {preview && <div className="ua-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
      <div onClick={e => e.stopPropagation()}>
        <div className="ua-preview-head"><span><FileImage size={14} /> {preview.name}</span><button type="button" aria-label="Close" onClick={() => setPreview(null)}><X size={16} /></button></div>
        {preview.data.startsWith('data:image/') ? <img src={preview.data} alt={preview.name} /> : <iframe src={preview.data} title={preview.name} />}
      </div>
    </div>}
  </section>;
}
