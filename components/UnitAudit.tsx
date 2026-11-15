'use client';
/**
 * v9.43 — Unit costs (simplified Unit Audit).
 * One list of everything spent on this unit: Parts Buyer purchase orders and the cashier's
 * other expenses. Each row shows whether its proof is complete, so missing receipts stand out.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, FileImage, PackageMinus, Plus, Undo2, X } from 'lucide-react';
import { listOnlineProducts, type OnlineProduct } from '@/lib/online-cashier';
import { posStockUseCost } from '@/lib/online-inventory';
import type { Database, FundEntry, POS, RFPReceiptRecord } from '@/lib/data';
import { expenseGross, pesos, posTotal, rfpUnitPosId } from '@/lib/data';

type Doc = { name: string; data: string };
type Row = { key: string; kind: 'Parts' | 'Expense' | 'Stock'; returnable?: number; title: string; sub: string; amount: number; state: 'ok' | 'missing' | 'bad'; note: string; docs: { label: string; doc?: Doc }[] };

export default function UnitAudit({ db, pos, canAddExpense, onAddExpense, canUseStock = false, onTakeStock, onReturnStock }: {
  db: Database; pos: POS; canAddExpense: boolean; onAddExpense: () => void;
  canUseStock?: boolean; onTakeStock?: (productId: string, qty: number, note: string) => Promise<void>; onReturnStock?: (useId: string, qty: number) => Promise<void>;
}) {
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
  async function giveBack(id: string, max: number) {
    if (!onReturnStock) return;
    const v = window.prompt(`How many to return to inventory? (max ${max})`, String(max)); if (v === null) return;
    const n = Number(v); if (!Number.isFinite(n) || n <= 0 || n > max) { window.alert(`Enter a number from 1 to ${max}.`); return; }
    try { await onReturnStock(id, n); setProducts(null); } catch (e) { window.alert(e instanceof Error ? e.message : 'Could not return the item.'); }
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
        key: no, kind: 'Parts' as const, title: ls[0].payee, sub: `${no} · ${ls.map(l => l.description).join(', ')}`, amount, state,
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
        amount: c ?? 0, state: (c === null ? 'missing' : 'ok') as Row['state'], note: c === null ? 'Price not set yet — ask Admin to set the price in Inventory' : 'Taken from inventory',
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
          <span className="uc-docs">{r.docs.map(d => d.doc?.data ? <button key={d.label} type="button" onClick={() => setPreview(d.doc!)}><FileImage size={12} /> {d.label}</button> : <em key={d.label}>{d.label}: none</em>)}<i>{r.note}</i>{r.kind === 'Stock' && canUseStock && onReturnStock && <button type="button" onClick={() => void giveBack(r.key, r.returnable || 0)}><Undo2 size={12} /> Return to stock</button>}</span>
        </span>
        <b className="uc-amt">{pesos(r.amount)}</b>
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
