'use client';
/**
 * v9.43 — Unit costs (simplified Unit Audit).
 * One list of everything spent on this unit: Parts Buyer purchase orders and the cashier's
 * other expenses. Each row shows whether its proof is complete, so missing receipts stand out.
 */
import { useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, FileImage, Plus, X } from 'lucide-react';
import type { Database, FundEntry, POS, RFPReceiptRecord } from '@/lib/data';
import { expenseGross, normalizePlate, pesos, posTotal } from '@/lib/data';

type Doc = { name: string; data: string };
type Row = { key: string; kind: 'Parts' | 'Expense'; title: string; sub: string; amount: number; state: 'ok' | 'missing' | 'bad'; note: string; docs: { label: string; doc?: Doc }[] };

export default function UnitAudit({ db, pos, canAddExpense, onAddExpense }: { db: Database; pos: POS; canAddExpense: boolean; onAddExpense: () => void }) {
  const [preview, setPreview] = useState<Doc | null>(null);
  const plate = normalizePlate(pos.plate);
  const live = (e: FundEntry) => e.kind === 'expense' && e.status !== 'Rejected';
  const poLines = db.fundEntries.filter(e => e.fund === 'RFP' && live(e) && (e.linkedPosId === pos.id || (!e.linkedPosId && e.branch === pos.branch && normalizePlate(e.plate || '') === plate)));
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
  ];
  const cost = rows.reduce((n, r) => n + r.amount, 0);
  const sale = posTotal(pos);
  const missing = rows.filter(r => r.state !== 'ok').length;

  return <section className="unit-costs" aria-label="Unit costs">
    <div className="uc-head">
      <div><h4>Costs for this unit</h4><p>Parts bought by the Parts Buyer and other expenses, with their receipts.</p></div>
      {canAddExpense && <button type="button" className="uc-add" onClick={onAddExpense}><Plus size={14} /> Add expense for this unit</button>}
    </div>
    <div className="uc-sum">
      <div><small>Sale</small><strong>{pesos(sale)}</strong></div>
      <div><small>Costs</small><strong>{pesos(cost)}</strong></div>
      <div><small>Margin</small><strong className={sale - cost < 0 ? 'neg' : ''}>{pesos(sale - cost)}</strong></div>
    </div>
    {rows.length === 0 ? <p className="uc-empty">No parts or expenses recorded for this unit yet.</p> : <>
      {missing > 0 && <p className="uc-alert"><CircleAlert size={14} /> {missing} item{missing === 1 ? '' : 's'} still need{missing === 1 ? 's' : ''} a receipt or a check. Attach supplier receipts in <b>Purchase Orders</b>.</p>}
      <ul className="uc-list">{rows.map(r => <li key={r.key} className={'uc-' + r.state}>
        <span className="uc-icon">{r.state === 'ok' ? <CheckCircle2 size={17} /> : r.state === 'bad' ? <CircleAlert size={17} /> : <Clock3 size={17} />}</span>
        <span className="uc-main"><span className="uc-kind">{r.kind === 'Parts' ? 'Parts (PO)' : 'Expense'}</span><strong>{r.title}</strong><small>{r.sub}</small>
          <span className="uc-docs">{r.docs.map(d => d.doc?.data ? <button key={d.label} type="button" onClick={() => setPreview(d.doc!)}><FileImage size={12} /> {d.label}</button> : <em key={d.label}>{d.label}: none</em>)}<i>{r.note}</i></span>
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
