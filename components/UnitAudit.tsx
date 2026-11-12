'use client';
/**
 * v9.41 — Unit Audit: everything spent on one unit (POS / vehicle) in one place.
 *  - Parts Buyer purchase orders (RFP) linked to the unit, with PB payment screenshot
 *  - Cashier supplier receipts matched to each PO (rfpReceipts)
 *  - Cashier's other unit expenses from the Revolving Fund (RF) with their receipts
 *  - Totals so an auditor can see if costs match the receipts and the sale
 */
import { useState } from 'react';
import { CheckCircle2, Eye, FileWarning, Plus, Receipt as ReceiptIcon, X } from 'lucide-react';
import type { Database, FundEntry, POS, RFPReceiptRecord } from '@/lib/data';
import { expenseGross, normalizePlate, pesos, posTotal } from '@/lib/data';

type Doc = { name: string; data: string };
const isImage = (d: string) => d.startsWith('data:image/');

export default function UnitAudit({ db, pos, canAddExpense, onAddExpense }: { db: Database; pos: POS; canAddExpense: boolean; onAddExpense: () => void }) {
  const [preview, setPreview] = useState<Doc | null>(null);
  const plate = normalizePlate(pos.plate);
  const live = (e: FundEntry) => e.kind === 'expense' && e.status !== 'Rejected';
  // POs: linked to this POS, or same plate and not yet linked to another POS
  const poLines = db.fundEntries.filter(e => e.fund === 'RFP' && live(e) && (e.linkedPosId === pos.id || (!e.linkedPosId && normalizePlate(e.plate || '') === plate)));
  const unitExpenses = db.fundEntries.filter(e => e.fund === 'RF' && live(e) && e.linkedPosId === pos.id);
  const receipts = (db.rfpReceipts || []) as RFPReceiptRecord[];
  const superseded = (r: RFPReceiptRecord) => receipts.some(x => x.replacesId === r.id);

  const poGroups = [...new Map(poLines.map(e => [e.no, e])).keys()].map(no => {
    const lines = poLines.filter(e => e.no === no);
    const suppliers = [...new Set(lines.map(l => l.payee))].map(name => {
      const items = lines.filter(l => l.payee === name);
      const amount = items.reduce((n, l) => n + expenseGross(l), 0);
      const receipt = receipts.find(r => r.type === 'receipt' && !superseded(r) && items.some(i => i.id === r.purchaseId));
      const paymentProof = items.find(i => i.proof?.data)?.proof;
      return { name, items, amount, receipt, paymentProof };
    });
    return { no, date: lines[0].date, branch: lines[0].branch, linked: lines.every(l => l.linkedPosId === pos.id), suppliers, total: suppliers.reduce((n, s) => n + s.amount, 0) };
  });

  const poTotal = poGroups.reduce((n, g) => n + g.total, 0);
  const matchedReceipts = poGroups.reduce((n, g) => n + g.suppliers.reduce((m, s) => m + (s.receipt?.status === 'Matched' ? s.receipt.amount : 0), 0), 0);
  const missingReceipts = poGroups.reduce((n, g) => n + g.suppliers.filter(s => !s.receipt).length, 0);
  const flagged = poGroups.reduce((n, g) => n + g.suppliers.filter(s => s.receipt?.status === 'Discrepancy').length, 0);
  const expenseTotal = unitExpenses.reduce((n, e) => n + expenseGross(e), 0);
  const costTotal = poTotal + expenseTotal;
  const sale = posTotal(pos);

  const statusPill = (r?: RFPReceiptRecord) => !r
    ? <span className="ua-pill ua-wait">No cashier receipt yet</span>
    : r.status === 'Matched' ? <span className="ua-pill ua-ok"><CheckCircle2 size={12} /> Receipt matched</span>
    : r.status === 'Discrepancy' ? <span className="ua-pill ua-bad"><FileWarning size={12} /> Discrepancy</span>
    : <span className="ua-pill ua-wait">Receipt for review</span>;
  const viewBtn = (d: Doc | undefined, label: string) => d?.data ? <button type="button" className="ua-link" onClick={() => setPreview(d)}><Eye size={12} /> {label}</button> : <span className="ua-missing">{label}: none</span>;

  return <section className="unit-audit" aria-label="Unit audit">
    <div className="ua-head">
      <div><h4>Unit Audit · {pos.plate}</h4><p>All purchase orders, payments, receipts and other expenses for this unit.</p></div>
      {canAddExpense && <button type="button" className="ua-add" onClick={onAddExpense}><Plus size={14} /> Add unit expense</button>}
    </div>

    <div className="ua-stats">
      <div><small>Parts (PB purchase orders)</small><strong>{pesos(poTotal)}</strong><span>{poGroups.length} PO{poGroups.length === 1 ? '' : 's'}</span></div>
      <div><small>Other unit expenses (RF)</small><strong>{pesos(expenseTotal)}</strong><span>{unitExpenses.length} item{unitExpenses.length === 1 ? '' : 's'}</span></div>
      <div><small>Total cost on this unit</small><strong>{pesos(costTotal)}</strong><span>Sale {pesos(sale)} · margin {pesos(sale - costTotal)}</span></div>
      <div className={missingReceipts || flagged ? 'ua-warn' : 'ua-good'}><small>Receipts check</small><strong>{pesos(matchedReceipts)} matched</strong><span>{missingReceipts ? `${missingReceipts} supplier receipt(s) missing` : flagged ? `${flagged} discrepancy` : poGroups.length ? 'All PO receipts in' : 'No POs yet'}</span></div>
    </div>

    <h5>Purchase orders (Parts Buyer)</h5>
    {poGroups.length === 0 ? <p className="ua-empty">No purchase orders for this unit yet.</p> : poGroups.map(g => <div key={g.no} className="ua-po">
      <div className="ua-po-head"><strong>{g.no}</strong><span>{g.date} · {g.branch}{g.linked ? '' : ' · matched by plate'}</span><b>{pesos(g.total)}</b></div>
      {g.suppliers.map(s => <div key={s.name} className="ua-supplier">
        <div className="ua-supplier-main"><strong>{s.name}</strong><span>{s.items.map(i => `${i.description}${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ')}</span></div>
        <b>{pesos(s.amount)}</b>
        <div className="ua-docs">{viewBtn(s.paymentProof, 'PB payment')}{viewBtn(s.receipt?.proof ? { name: s.receipt.proofName || 'Receipt', data: s.receipt.proof } : undefined, 'Supplier receipt')}{statusPill(s.receipt)}{s.receipt && s.receipt.amount !== s.amount && <span className="ua-pill ua-bad">Receipt {pesos(s.receipt.amount)} ≠ PO {pesos(s.amount)}</span>}</div>
      </div>)}
    </div>)}

    <h5>Other unit expenses (Cashier · Revolving Fund)</h5>
    {unitExpenses.length === 0 ? <p className="ua-empty">No other expenses linked to this unit.</p> : <div className="ua-exp">{unitExpenses.map(e => <div key={e.id} className="ua-supplier">
      <div className="ua-supplier-main"><strong>{e.no} · {e.category}</strong><span>{e.payee} · {e.description}</span></div>
      <b>{pesos(expenseGross(e))}</b>
      <div className="ua-docs">{viewBtn(e.proof, 'Receipt')}<span className={'ua-pill ' + (e.status === 'Approved' ? 'ua-ok' : 'ua-wait')}>{e.status}</span></div>
    </div>)}</div>}

    {preview && <div className="ua-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
      <div onClick={e => e.stopPropagation()}>
        <div className="ua-preview-head"><span><ReceiptIcon size={14} /> {preview.name}</span><button type="button" aria-label="Close" onClick={() => setPreview(null)}><X size={16} /></button></div>
        {isImage(preview.data) ? <img src={preview.data} alt={preview.name} /> : <iframe src={preview.data} title={preview.name} />}
      </div>
    </div>}
  </section>;
}
