'use client';
/** v9.32 — Supplier Management (shared Supabase master list). Rendered directly in the main app and at /supplier-controls. */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Flag, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { getSignedInAppUser } from '@/lib/supabase-auth';
import { loadSuppliers, addSupplier, reviewSupplier, addSupplierItem, updateSupplier, type OnlineSupplier, type OnlineSupplierItem, type SupplierActivity } from '@/lib/supplier-online';
import { BRANCHES, loadDB, type BranchId, type Role } from '@/lib/data';

type Status = OnlineSupplier['status'];
const normalizeName = (v: string) => v.trim().replace(/\s+/g, ' ').toLocaleUpperCase();
const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const branchName = (id: string) => BRANCHES.find(b => b.id === id)?.name || id;

function StatusPill({ status }: { status: Status }) {
  return <span className={'sup-pill sup-pill-' + status.replace(' ', '-').toLowerCase()}>{status}</span>;
}

export default function SupplierWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [suppliers, setSuppliers] = useState<OnlineSupplier[]>([]);
  const [items, setItems] = useState<OnlineSupplierItem[]>([]);
  const [activity, setActivity] = useState<SupplierActivity[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>('cashier');
  const [userId, setUserId] = useState('');
  const [assigned, setAssigned] = useState<BranchId>('UCM');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState(''); const [newPhone, setNewPhone] = useState(''); const [newBranch, setNewBranch] = useState<BranchId>('UCM');
  const [editId, setEditId] = useState(''); const [editName, setEditName] = useState(''); const [editPhone, setEditPhone] = useState('');
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<'items' | 'purchases' | 'activity'>('items');
  const [itemName, setItemName] = useState(''); const [itemPrice, setItemPrice] = useState('');
  const [vehicle, setVehicle] = useState(''); const [part, setPart] = useState('');

  const authUid = userId.replace(/^supabase:/, '');
  // v9.39: cashiers are front-line and keep supplier receipts, so they can add suppliers too (For Review)
  const canAdd = role === 'cashier' || role === 'pb' || role === 'admin';
  const canEdit = (s: OnlineSupplier) => role === 'admin' || (s.createdBy === authUid && s.status === 'For Review');

  async function reload() {
    try {
      const data = await loadSuppliers();
      setSuppliers(data.suppliers); setItems(data.items); setActivity(data.activity); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load supplier records.'); }
    finally { setReady(true); }
  }
  useEffect(() => {
    let mounted = true;
    getSignedInAppUser().then(u => { if (mounted && u) { setRole(u.role); setUserId(u.id); setAssigned(u.branch); setNewBranch(u.branch); } }).catch(() => {});
    void reload();
    return () => { mounted = false; };
  }, []);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await reload(); setNotice(done); }
    catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  }

  const counts = useMemo(() => ({
    all: suppliers.length,
    verified: suppliers.filter(s => s.status === 'Verified').length,
    review: suppliers.filter(s => s.status === 'For Review').length,
    flagged: suppliers.filter(s => s.status === 'Flagged').length,
  }), [suppliers]);
  const itemCount = (id: string) => items.filter(i => i.supplierId === id).length;
  const visible = suppliers
    .filter(s => statusFilter === 'All' || s.status === statusFilter)
    .filter(s => [s.name, s.phone, s.status, s.branch, s.by].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (a.status === 'For Review' ? 0 : 1) - (b.status === 'For Review' ? 0 : 1) || a.name.localeCompare(b.name));

  const chosen = suppliers.find(s => s.id === selected);
  const db = ready && userId ? loadDB() : null;
  const purchases = (db?.fundEntries || []).filter(e => e.fund === 'RFP' && e.kind === 'expense' && e.status !== 'Rejected').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const history = chosen ? purchases.filter(e => normalizeName(e.payee) === normalizeName(chosen.name)) : [];
  const chosenItems = chosen ? items.filter(i => i.supplierId === chosen.id) : [];
  const finder = vehicle.trim() ? purchases.filter(e => (e.car || '').toLowerCase().includes(vehicle.trim().toLowerCase()) && e.description.toLowerCase().includes(part.trim().toLowerCase())) : [];
  const unitCost = (e: (typeof purchases)[number]) => e.unitCost ?? e.amount / (e.quantity || 1);

  function startEdit(s: OnlineSupplier) { setEditId(s.id); setEditName(s.name); setEditPhone(s.phone); setError(''); }

  const actions = (s: OnlineSupplier, compact = true) => <div className="sup-actions">
    {compact && <button type="button" className="sup-btn" onClick={() => { setSelected(s.id); setTab('items'); window.scrollTo(0, 0); }}>View</button>}
    {canEdit(s) && <button type="button" className={'sup-btn' + (compact ? ' sup-btn-icon' : '')} onClick={() => startEdit(s)} title="Edit name and contact" aria-label={`Edit ${s.name}`}><Pencil size={13} />{!compact && ' Edit'}</button>}
    {role === 'admin' && s.status !== 'Verified' && <button type="button" className={'sup-btn sup-btn-ok' + (compact ? ' sup-btn-icon' : '')} title="Approve (mark Verified)" aria-label={`Approve ${s.name}`} disabled={busy} onClick={() => run(() => reviewSupplier(s.id, true), `${s.name} approved.`)}><Check size={13} />{!compact && ' Approve'}</button>}
    {role === 'admin' && s.status !== 'Flagged' && <button type="button" className={'sup-btn sup-btn-warn' + (compact ? ' sup-btn-icon' : '')} title="Flag supplier" aria-label={`Flag ${s.name}`} disabled={busy} onClick={() => run(() => reviewSupplier(s.id, false), `${s.name} flagged.`)}><Flag size={13} />{!compact && ' Flag'}</button>}
  </div>;

  if (!ready) return <div className="sup-wrap"><p className="sup-muted">Loading suppliers…</p></div>;

  return <div className={'sup-wrap' + (embedded ? ' sup-embedded' : '')}>
    {!embedded && <header className="sup-page-head"><div><h1>Supplier Management</h1><p>Shared supplier masterlist for all branches.</p></div><Link href="/" className="sup-btn"><ArrowLeft size={14} /> Back to Dashboard</Link></header>}
    {!userId && <p className="sup-alert" role="alert">Sign in with a staff account to access supplier actions.</p>}
    {error && <p className="sup-alert" role="alert">{error}</p>}
    {notice && !error && <p className="sup-notice" role="status">{notice}</p>}

    {editId && (() => { const s = suppliers.find(x => x.id === editId); if (!s) return null; return <div className="sup-dialog-scrim" onClick={() => setEditId('')}>
      <form className="sup-dialog" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); void run(async () => { await updateSupplier(s.id, editName, editPhone); setEditId(''); }, 'Supplier updated.'); }}>
        <div className="sup-dialog-head"><h3>Edit Supplier</h3><button type="button" className="sup-icon" onClick={() => setEditId('')} aria-label="Close"><X size={16} /></button></div>
        <label className="sup-field"><span>Supplier name</span><input required value={editName} onChange={e => setEditName(e.target.value)} /></label>
        <label className="sup-field"><span>Contact number</span><input required value={editPhone} onChange={e => setEditPhone(e.target.value)} /></label>
        <div className="sup-row-end"><button type="button" className="sup-btn" onClick={() => setEditId('')}>Cancel</button><button type="submit" className="sup-btn sup-btn-primary" disabled={busy}><Check size={14} /> Save</button></div>
      </form></div>; })()}

    {!chosen && <>
      <div className="sup-stats">
        {([['All', counts.all], ['Verified', counts.verified], ['For Review', counts.review], ['Flagged', counts.flagged]] as const).map(([label, n]) =>
          <button key={label} type="button" className={'sup-stat' + (statusFilter === label ? ' active' : '')} onClick={() => setStatusFilter(label)}><strong>{n}</strong><span>{label === 'All' ? 'All suppliers' : label}</span></button>)}
      </div>

      <section className="sup-card">
        <div className="sup-toolbar">
          <label className="sup-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, contact, branch…" /></label>
          <select className="sup-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | Status)}>
            <option value="All">All statuses</option><option>Verified</option><option>For Review</option><option>Flagged</option>
          </select>
          <button type="button" className="sup-btn" onClick={() => void reload()} title="Reload"><RefreshCw size={14} /></button>
          {canAdd && userId && <button type="button" className="sup-btn sup-btn-primary" onClick={() => setAdding(a => !a)}><Plus size={14} /> Add Supplier</button>}
        </div>

        {adding && <form className="sup-add" onSubmit={e => { e.preventDefault(); void run(async () => { await addSupplier(newName, newPhone, newBranch); setNewName(''); setNewPhone(''); setAdding(false); }, role === 'admin' ? 'Supplier added and verified.' : 'Supplier submitted for Admin review.'); }}>
          <label className="sup-field"><span>Supplier name</span><input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. RJC AUTO PARTS" /></label>
          <label className="sup-field"><span>Contact number</span><input required value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="09xx xxx xxxx" /></label>
          <label className="sup-field"><span>Submitting branch</span><select value={newBranch} disabled={role !== 'admin' && assigned !== ('ALL' as BranchId)} onChange={e => setNewBranch(e.target.value as BranchId)}>{BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <div className="sup-add-actions"><button type="button" className="sup-btn" onClick={() => setAdding(false)}>Cancel</button><button type="submit" className="sup-btn sup-btn-primary" disabled={busy}><Check size={14} /> {role === 'admin' ? 'Add Supplier' : 'Submit for Review'}</button></div>
          <p className="sup-muted sup-full">{role === 'admin' ? 'Suppliers you add are verified right away.' : 'New suppliers need Admin approval before they are verified.'}</p>
        </form>}

        <div className="sup-table-wrap"><table className="sup-table sup-list-table">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Branch</th><th>Status</th><th>Submitted</th><th className="sup-right">Actions</th></tr></thead>
          <tbody>{visible.map(s => <tr key={s.id}>
            <td><button type="button" className="sup-name" onClick={() => { setSelected(s.id); setTab('items'); window.scrollTo(0, 0); }}>{s.name}</button><small>{itemCount(s.id)} catalog item{itemCount(s.id) === 1 ? '' : 's'}</small></td>
            <td className="sup-nowrap">{s.phone || '—'}</td>
            <td>{s.branch}</td>
            <td><StatusPill status={s.status} /></td>
            <td><span className="sup-by">{s.by}</span><small>{day(s.at)}</small></td>
            <td className="sup-right">{actions(s)}</td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <p className="sup-empty">No suppliers match your filters.</p>}</div>
      </section>

      {userId && <section className="sup-card">
        <div className="sup-card-head"><div><h2>Vehicle Parts Finder</h2><p>Compare prices from recorded Parts Fund (RFP) purchases.</p></div></div>
        <div className="sup-finder">
          <label className="sup-field"><span>Vehicle brand / model</span><input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="e.g. Toyota Vios" /></label>
          <label className="sup-field"><span>Part / item name</span><input value={part} onChange={e => setPart(e.target.value)} placeholder="e.g. Oil filter" /></label>
        </div>
        {vehicle.trim() ? (finder.length ? <div className="sup-table-wrap"><table className="sup-table">
          <thead><tr><th>Supplier</th><th>Vehicle</th><th>Item</th><th className="sup-right">Unit cost</th><th>Date</th><th>Branch</th></tr></thead>
          <tbody>{finder.sort((a, b) => unitCost(a) - unitCost(b)).map(e => <tr key={e.id}><td>{e.payee}</td><td>{e.car || '—'}</td><td>{e.description}</td><td className="sup-right">{peso(unitCost(e))}</td><td>{e.date}</td><td>{e.branch}</td></tr>)}</tbody>
        </table></div> : <p className="sup-empty">No recorded purchases match this vehicle and part yet.</p>) : <p className="sup-muted sup-pad">Type a vehicle to see past supplier prices.</p>}
      </section>}

      {role === 'admin' && userId && <section className="sup-card">
        <div className="sup-card-head"><div><h2>Recent Supplier Activity</h2><p>New submissions, approvals, flags and catalog items.</p></div></div>
        {activity.length ? <ul className="sup-activity">{activity.slice(0, 15).map(a => <li key={a.id}><span>{a.detail}</span><small>{a.by} · {day(a.at)}</small></li>)}</ul> : <p className="sup-empty">No supplier activity yet.</p>}
      </section>}
    </>}

    {chosen && <section className="sup-card">
      <div className="sup-profile-head">
        <button type="button" className="sup-btn" onClick={() => setSelected('')}><ArrowLeft size={14} /> All suppliers</button>
        <div className="sup-profile-title"><h2>{chosen.name}</h2><p>{chosen.phone || 'No contact'} · {branchName(chosen.branch)} · <StatusPill status={chosen.status} /></p><small>Submitted by {chosen.by} on {day(chosen.at)}</small></div>
        {actions(chosen, false)}
      </div>
      <nav className="sup-tabs">{(['items', 'purchases', 'activity'] as const).map(t => <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'items' ? `Catalog items (${chosenItems.length})` : t === 'purchases' ? `Purchases (${history.length})` : 'Activity'}</button>)}</nav>
      {tab === 'items' && <div className="sup-pad">
        {canAdd && <form className="sup-add sup-add-inline" onSubmit={e => { e.preventDefault(); const price = itemPrice.trim() === '' ? null : Number(itemPrice); if (price !== null && (!Number.isFinite(price) || price < 0)) { setError('Enter a valid non-negative price.'); return; } void run(async () => { await addSupplierItem(chosen.id, itemName, price); setItemName(''); setItemPrice(''); }, 'Catalog item added.'); }}>
          <label className="sup-field"><span>Item name</span><input required value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Oil filter 90915-YZZE1" /></label>
          <label className="sup-field"><span>Reference price (optional)</span><input type="number" min="0" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="₱" /></label>
          <div className="sup-add-actions"><button type="submit" className="sup-btn sup-btn-primary" disabled={busy}><Plus size={14} /> Add Item</button></div>
        </form>}
        {chosenItems.length ? <div className="sup-table-wrap"><table className="sup-table"><thead><tr><th>Item</th><th className="sup-right">Reference price</th><th>Added by</th></tr></thead><tbody>{chosenItems.map(i => <tr key={i.id}><td>{i.name}</td><td className="sup-right">{i.price === null ? '—' : peso(i.price)}</td><td><span className="sup-by">{i.by}</span><small>{day(i.at)}</small></td></tr>)}</tbody></table></div> : <p className="sup-empty">No catalog items yet.{canAdd ? ' Add the parts this supplier carries above.' : ''}</p>}
      </div>}
      {tab === 'purchases' && <div className="sup-pad">{history.length ? <div className="sup-table-wrap"><table className="sup-table"><thead><tr><th>Date</th><th>Branch</th><th>RFP</th><th>Vehicle</th><th>Item</th><th className="sup-right">Amount</th><th>Status</th></tr></thead><tbody>{history.map(e => <tr key={e.id}><td>{e.date}</td><td>{e.branch}</td><td>{e.no}</td><td>{e.car || '—'}</td><td>{e.description}</td><td className="sup-right">{peso(e.amount)}</td><td>{e.status}</td></tr>)}</tbody></table></div> : <p className="sup-empty">No recorded Parts Fund (RFP) purchases from this supplier yet.</p>}</div>}
      {tab === 'activity' && <div className="sup-pad">{activity.filter(a => a.detail.toLowerCase().includes(chosen.name.toLowerCase())).length ? <ul className="sup-activity">{activity.filter(a => a.detail.toLowerCase().includes(chosen.name.toLowerCase())).map(a => <li key={a.id}><span>{a.detail}</span><small>{a.by} · {day(a.at)}</small></li>)}</ul> : <p className="sup-empty">No activity recorded for this supplier yet.</p>}</div>}
    </section>}
  </div>;
}
