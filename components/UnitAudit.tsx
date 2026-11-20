'use client';
/**
 * v9.43 — Unit costs (simplified Unit Audit).
 * One list of everything spent on this unit: Parts Buyer purchase orders and the cashier's
 * other expenses. Each row shows whether its proof is complete, so missing receipts stand out.
 */
import { useMemo, useState } from 'react';
import { Camera, CheckCircle2, CircleAlert, Clock3, FileImage, PackageMinus, Plus, Undo2, Upload, X } from 'lucide-react';
import { readFile } from '@/components/PurchaseOrders';
import { listOnlineProducts, type OnlineProduct } from '@/lib/online-cashier';
import { posStockUseCost } from '@/lib/online-inventory';
import type { Database, FundEntry, POS, RFPReceiptRecord } from '@/lib/data';
import { expenseGross, pesos, posTotal, rfpUnitPosId } from '@/lib/data';

type Doc = { name: string; data: string };
type Row = { key: string; kind: 'Parts' | 'Expense' | 'Stock'; returnable?: number; noPrice?: boolean; po?: { total: number; firstId: string; branch: string; currentId?: string }; title: string; sub: string; amount: number; state: 'ok' | 'missing' | 'bad'; note: string; docs: { label: string; doc?: Doc }[] };

export default function UnitAudit({ db, pos, canAddExpense, onAddExpense, canUseStock = false, onTakeStock, onReturnStock, canAttachReceipt = false, userName = '', onSaveReceipts }: {
  db: Database; pos: POS; canAddExpense: boolean; onAddExpense: () => void;
  canUseStock?: boolean; onTakeStock?: (productId: string, qty: number, note: string) => Promise<void>; onReturnStock?: (useId: string, qty: number) => Promise<void>;
  canAttachReceipt?: boolean; userName?: string; onSaveReceipts?: (next: RFPReceiptRecord[]) => boolean;
}) {
  // v9.58: attach the supplier receipt for a Parts Buyer PO right here, next to PB's payment
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [rcFile, setRcFile] = useState<Doc | null>(null); const [rcAmt, setRcAmt] = useState(''); const [rcRef, setRcRef] = useState(''); const [rcMsg, setRcMsg] = useState('');
  function startAttach(r: Row) { setAttachFor(r.key); setRcFile(null); setRcAmt(String(r.po?.total ?? '')); setRcRef(''); setRcMsg(''); }
  function saveAttach(r: Row) {
    if (!r.po || !onSaveReceipts) return;
    const n = Number(rcAmt);
    if (!rcFile) { setRcMsg('Take a photo or attach the supplier receipt first.'); return; }
    if (!Number.isFinite(n) || n <= 0) { setRcMsg('Enter the amount written on the receipt.'); return; }
    const matches = Math.abs(n - r.po.total) < 0.01;
    const entry: RFPReceiptRecord = {
      id: crypto.randomUUID(), branch: r.po.branch as RFPReceiptRecord['branch'], purchaseId: r.po.firstId, type: 'receipt', amount: n, reference: rcRef.trim(),
      proof: rcFile.data, proofName: rcFile.name, status: matches ? 'Matched' : 'Discrepancy', by: userName, at: new Date().toISOString(),
      ...(matches ? {} : { reason: `Receipt ${pesos(n)} vs PO ${pesos(r.po.total)}` }),
      ...(r.po.currentId ? { replacesId: r.po.currentId } : {}),
    };
    if (onSaveReceipts([entry, ...receipts])) { setAttachFor(null); setRcFile(null); }
    else setRcMsg('Could not save. Please try again.');
  }
  const [preview, setPreview] = useState<Doc | null>(null);
  // v9.56: parts taken from the branch's live inventory for this unit
  const [stockOpen, setStockOpen] = useState(false);
  const [products, setProducts] = useState<OnlineProduct[] | null>(null);
  const [search, setSearch] = useState(''); const [pick, setPick] = useState<OnlineProduct | null>(null);
  const [qty, setQty] = useState('1'); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function openStock() {
    setStockOpen(true); setErr(''); setPick(null); setSearch(''); setQty('1'); setNote('');
    if (!products) { try { setProducts(await listOnlineProducts(pos.branch)); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load inventory.'); } }
  }
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase(); const list = products || [];
    return (q ? list.filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(q)) : list).slice(0, 30);
  }, [products, search]);
  async function take() {
    if (!pick || !onTakeStock) return; const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) { setErr('Enter how many were used.'); return; }
    if (n > Number(pick.stock_qty)) { setErr(`Only ${Number(pick.stock_qty)} in stock.`); return; }
    setBusy(true); setErr('');
    try { await onTakeStock(pick.id, n, note); setStockOpen(false); setProducts(null); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not take the item.'); }
    finally { setBusy(false); }
  }
  // v9.61: return to stock with a small form in the row (no browser popup)
  const [retFor, setRetFor] = useState<string | null>(null); const [retQty, setRetQty] = useState(1); const [retBusy, setRetBusy] = useState(false); const [retErr, setRetErr] = useState('');
  function startReturn(id: string) { setRetFor(id); setRetQty(1); setRetErr(''); }
  async function giveBack(id: string, max: number) {
    if (!onReturnStock) return;
    if (!Number.isInteger(retQty) || retQty < 1 || retQty > max) { setRetErr(`Mula 1 hanggang ${max} lang.`); return; }
    setRetBusy(true); setRetErr('');
    try { await onReturnStock(id, retQty); setProducts(null); setRetFor(null); }
    catch (e) { setRetErr(e instanceof Error ? e.message : 'Could not return the item.'); }
    finally { setRetBusy(false); }
  }

  const live = (e: FundEntry) => e.kind === 'expense' && e.status !== 'Rejected';
  const poLines = db.fundEntries.filter(e => e.fund === 'RFP' && live(e) && rfpUnitPosId(db, e) === pos.id);
  const receipts = (db.rfpReceipts || []) as RFPReceiptRecord[];
  const current = (ids: Set<string>) => receipts.filter(r => r.type === 'receipt' && ids.has(r.purchaseId) && !receipts.some(x => x.replacesId === r.id)).sort((a, b) => b.at.localeCompare(a.at))[0];

  const rows: Row[] = [
    ...[...new Set(poLines.map(l => l.no))].map(no => {
      const ls = poLines.filter(l => l.no === no);
      const amount = ls.reduce((n, l) => n + expenseGross(l), 0);
      const r = current(new Set(ls.map(l => l.id)));
      const state: Row['state'] = !r ? 'missing' : r.status === 'Discrepancy' ? 'bad' : 'ok';
      return {
        key: no, kind: 'Parts' as const, title: ls[0].payee, sub: `${no} · ${ls.map(l => l.description).join(', ')}`, amount, state, po: { total: amount, firstId: ls[0].id, branch: ls[0].branch, currentId: r?.id },
        note: state === 'missing' ? 'Supplier receipt missing' : state === 'bad' ? `Receipt ${pesos(r!.amount)} ≠ PO` : 'Payment + receipt complete',
        docs: [{ label: 'PB payment', doc: ls.find(l => l.proof?.data)?.proof }, { label: 'Supplier receipt', doc: r?.proof ? { name: r.proofName || 'Receipt', data: r.proof } : undefined }],
      };
    }),
    ...db.fundEntries.filter(e => e.fund === 'RF' && live(e) && e.linkedPosId === pos.id).map(e => ({
      key: e.id, kind: 'Expense' as const, title: `${e.category} · ${e.payee}`, sub: `${e.no} · ${e.description}`, amount: expenseGross(e),
      state: (e.proof?.data ? 'ok' : 'missing') as Row['state'], note: e.proof?.data ? (e.status === 'Approved' ? 'Approved' : 'Waiting for Admin review') : 'Receipt missing',
      docs: [{ label: 'Receipt', doc: e.proof }],
    })),
    ...(db.posStockUses || []).filter(u => u.posId === pos.id && u.qty - u.returned > 0).map(u => {
      const c = posStockUseCost(u); const left = u.qty - u.returned;
      return {
        key: u.id, kind: 'Stock' as const, title: u.name, sub: `${u.sku ? u.sku + ' · ' : ''}${left} pc${left === 1 ? '' : 's'} from branch stock${u.returned ? ` (${u.returned} returned)` : ''}`,
        amount: c ?? 0, noPrice: c === null, state: 'ok' as Row['state'], note: 'Taken from branch stock',
        docs: [], returnable: left,
      };
    }),
  ];
  const cost = rows.reduce((n, r) => n + r.amount, 0);
  const sale = posTotal(pos);
  const missing = rows.filter(r => r.state !== 'ok').length;

  return <section className="unit-costs" aria-label="Unit costs">
    <div className="uc-head">
      <div><h4>Costs for this unit</h4><p>Parts bought by the Parts Buyer, parts taken from branch stock, and other expenses.</p></div>
      <div className="uc-actions">{canUseStock && <button type="button" className="uc-add" onClick={() => void openStock()}><PackageMinus size={14} /> Use from inventory</button>}{canAddExpense && <button type="button" className="uc-add" onClick={onAddExpense}><Plus size={14} /> Add expense for this unit</button>}</div>
    </div>
    {stockOpen && <div className="uc-stock">
      <div className="uc-stock-head"><strong>Use a part from {pos.branch} inventory</strong><button type="button" aria-label="Close" onClick={() => setStockOpen(false)}><X size={15} /></button></div>
      {!pick ? <>
        <input autoFocus placeholder="Search product name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
        {!products && !err && <p className="uc-muted">Loading inventory…</p>}
        {products && <ul className="uc-pick">{matches.map(p => <li key={p.id}><button type="button" disabled={Number(p.stock_qty) <= 0} onClick={() => { setPick(p); setErr(''); }}><span>{p.name}<small>{p.sku}</small></span><em className={Number(p.stock_qty) <= 0 ? 'out' : ''}>{Number(p.stock_qty) <= 0 ? 'Out of stock' : `${Number(p.stock_qty)} in stock`}</em></button></li>)}{matches.length === 0 && <li className="uc-muted">No product matches “{search}”.</li>}</ul>}
      </> : <div className="uc-stock-form">
        <div className="uc-picked"><span>{pick.name}<small>{pick.sku} · {Number(pick.stock_qty)} in stock{Number(pick.unit_price) > 0 ? ` · ${pesos(Number(pick.unit_price))} each` : ' · price not set'}</small></span><button type="button" onClick={() => setPick(null)}>Change</button></div>
        <label>How many used<input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label>Note (optional)<input value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="e.g. front brake" /></label>
        <div className="uc-stock-actions"><button type="button" className="button button-secondary" onClick={() => setStockOpen(false)} disabled={busy}>Cancel</button><button type="button" className="button button-primary" disabled={busy} onClick={() => void take()}>{busy ? 'Saving…' : 'Take from stock'}</button></div>
      </div>}
      {err && <p className="uc-err" role="alert">{err}</p>}
    </div>}
    <div className="uc-sum">
      <div><small>Sale</small><strong>{pesos(sale)}</strong></div>
      <div><small>Costs</small><strong>{pesos(cost)}</strong></div>
      <div><small>Margin</small><strong className={sale - cost < 0 ? 'neg' : ''}>{pesos(sale - cost)}</strong></div>
    </div>
    {rows.length === 0 ? <p className="uc-empty">No parts or expenses recorded for this unit yet.</p> : <>
      {missing > 0 && <p className="uc-alert"><CircleAlert size={14} /> {missing} item{missing === 1 ? '' : 's'} still need{missing === 1 ? 's' : ''} attention (a receipt or a price). See the notes below.</p>}
      <ul className="uc-list">{rows.map(r => <li key={r.key} className={'uc-' + r.state}>
        <span className="uc-icon">{r.state === 'ok' ? <CheckCircle2 size={17} /> : r.state === 'bad' ? <CircleAlert size={17} /> : <Clock3 size={17} />}</span>
        <span className="uc-main"><span className="uc-kind">{r.kind === 'Parts' ? 'Parts (PO)' : r.kind === 'Stock' ? 'From inventory' : 'Expense'}</span><strong>{r.title}</strong><small>{r.sub}</small>
          <span className="uc-docs">{r.docs.map(d => d.doc?.data ? <button key={d.label} type="button" onClick={() => setPreview(d.doc!)}><FileImage size={12} /> {d.label}</button> : <em key={d.label}>{d.label}: none</em>)}<i>{r.note}</i>{r.kind === 'Stock' && canUseStock && onReturnStock && retFor !== r.key && <button type="button" onClick={() => startReturn(r.key)}><Undo2 size={12} /> Return to stock</button>}{r.kind === 'Parts' && canAttachReceipt && onSaveReceipts && attachFor !== r.key && <button type="button" className="uc-attach-btn" onClick={() => startAttach(r)}><Upload size={12} /> {r.state === 'missing' ? 'Attach supplier receipt' : 'Replace receipt'}</button>}</span>
          {retFor === r.key && <span className="uc-return">
            <strong>Ibabalik sa stock</strong>
            <span className="uc-return-row">
              <button type="button" aria-label="Bawasan" disabled={retBusy || retQty <= 1} onClick={() => { setRetQty(q => Math.max(1, q - 1)); setRetErr(''); }}>−</button>
              <input type="number" min={1} max={r.returnable || 1} step={1} value={retQty} onChange={e => { setRetQty(Math.floor(Number(e.target.value) || 0)); setRetErr(''); }} aria-label="Ilan ang ibabalik" />
              <button type="button" aria-label="Dagdagan" disabled={retBusy || retQty >= (r.returnable || 1)} onClick={() => { setRetQty(q => Math.min(r.returnable || 1, q + 1)); setRetErr(''); }}>+</button>
              <small>sa {r.returnable} na ginamit</small>
              <span className="uc-return-actions"><button type="button" className="button button-secondary" disabled={retBusy} onClick={() => setRetFor(null)}>Cancel</button><button type="button" className="button button-primary" disabled={retBusy} onClick={() => void giveBack(r.key, r.returnable || 0)}><Undo2 size={14} /> {retBusy ? 'Ibinabalik…' : `Ibalik ${retQty} pc${retQty === 1 ? '' : 's'}`}</button></span>
            </span>
            {retErr && <em className="uc-err">{retErr}</em>}
          </span>}
          {attachFor === r.key && <span className="uc-attach">
            <label className="uc-file"><Camera size={14} /> {rcFile ? rcFile.name : 'Take photo or choose file'}<input type="file" accept="image/*,application/pdf" capture="environment" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setRcFile(await readFile(f)); setRcMsg(''); } catch (er) { setRcMsg(er instanceof Error ? er.message : 'Could not read file.'); } }} /></label>
            <label>Amount on receipt<input type="number" min="0" step="0.01" value={rcAmt} onChange={e => setRcAmt(e.target.value)} /></label>
            <label>Receipt no. (optional)<input value={rcRef} maxLength={60} onChange={e => setRcRef(e.target.value)} /></label>
            {rcMsg && <em className="uc-err">{rcMsg}</em>}
            <span className="uc-attach-actions"><button type="button" className="button button-secondary" onClick={() => setAttachFor(null)}>Cancel</button><button type="button" className="button button-primary" onClick={() => saveAttach(r)}>Save receipt</button></span>
          </span>}
        </span>
        <b className="uc-amt">{r.noPrice ? <span className="uc-noprice">No price</span> : pesos(r.amount)}</b>
      </li>)}</ul>
    </>}
    {preview && <div className="ua-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
      <div onClick={e => e.stopPropagation()}>
        <div className="ua-preview-head"><span><FileImage size={14} /> {preview.name}</span><button type="button" aria-label="Close" onClick={() => setPreview(null)}><X size={16} /></button></div>
        {preview.data.startsWith('data:image/') ? <img src={preview.data} alt={preview.name} /> : <iframe src={preview.data} title={preview.name} />}
      </div>
    </div>}
  </section>;
}
