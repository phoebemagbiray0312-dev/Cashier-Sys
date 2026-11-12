'use client';
/** v9.35 — Stock transfers between branches, shown as a popup inside Inventory (no page change). */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, PackageCheck, Search, Send, Truck, X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { getCurrentStaff, type StaffIdentity } from '@/lib/supabase-auth';

type RequestRow = { id: string; product_name: string; product_sku: string; from_branch: string; to_branch: string; quantity: number; status: string; reason: string; created_at: string; requested_by: string };
type Product = { sku: string; name: string; branch_id: string; stock_qty: number };
const BRANCHES: Record<string, string> = { UCM: 'UC Mandaluyong', UCQC: 'UC Quezon City', UCLP: 'UC Las Piñas' };
const UC = Object.keys(BRANCHES);
const STATUS_LABEL: Record<string, string> = { pending: 'Waiting approval', approved: 'Approved · to release', released: 'On the way', received: 'Received', rejected: 'Rejected' };

export default function StockTransferDialog({ mode, onClose, onChanged }: { mode: 'new' | 'history'; onClose: () => void; onChanged?: () => void }) {
  const [tab, setTab] = useState<'new' | 'history'>(mode);
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [source, setSource] = useState('UCQC'); const [dest, setDest] = useState('UCM');
  const [sku, setSku] = useState(''); const [qty, setQty] = useState('1'); const [reason, setReason] = useState('Branch stock replenishment');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'released' | 'received' | 'rejected'>('all');
  const [itemQuery, setItemQuery] = useState(''); const [itemOpen, setItemOpen] = useState(false); const [itemHi, setItemHi] = useState(0);
  const [rejecting, setRejecting] = useState(''); const [rejectNote, setRejectNote] = useState('');

  const admin = staff?.role === 'admin';
  const myBranch = staff?.branch || '';

  async function load() {
    const s = await getCurrentStaff(); setStaff(s); if (!s) return;
    if (s.role !== 'admin' && s.branch && UC.includes(s.branch)) { setDest(s.branch); setSource(UC.find(b => b !== s.branch) || 'UCQC'); }
    const db = getSupabaseClient();
    const [a, b] = await Promise.all([
      db.from('cms_stock_requests').select('id,product_name,product_sku,from_branch,to_branch,quantity,status,reason,created_at,requested_by').order('created_at', { ascending: false }).limit(200),
      db.from('cms_products').select('sku,name,branch_id,stock_qty').in('branch_id', UC).order('name').range(0, 1999),
    ]);
    if (a.error || b.error) throw new Error('Could not load stock transfers. Please try again.');
    setRows((a.data || []) as RequestRow[]); setProducts((b.data || []) as Product[]);
  }
  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [busy, onClose]);

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); await load(); setMessage(done); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^[A-Z_]+:\s*/, '') : 'Request failed.'); }
    finally { setBusy(false); }
  }

  const sourceProducts = useMemo(() => products.filter(p => p.branch_id === source && Number(p.stock_qty) > 0), [products, source]);
  const destSkus = useMemo(() => new Set(products.filter(p => p.branch_id === dest).map(p => p.sku)), [products, dest]);
  const chosen = sourceProducts.find(p => p.sku === sku);
  const matches = useMemo(() => {
    const words = itemQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return sourceProducts.filter(p => words.every(w => (p.name + ' ' + p.sku).toLowerCase().includes(w))).slice(0, 60);
  }, [sourceProducts, itemQuery]);
  const pickItem = (p: Product) => { setSku(p.sku); setItemQuery(''); setItemOpen(false); };
  const n = Number(qty);
  const qtyError = !sku ? '' : !Number.isFinite(n) || n <= 0 ? 'Enter a quantity above 0.' : chosen && n > Number(chosen.stock_qty) ? `Only ${chosen.stock_qty} available at ${source}.` : !destSkus.has(sku) ? `${BRANCHES[dest]} doesn't have this item registered yet.` : '';

  const submit = () => run(async () => {
    if (source === dest) throw new Error('Choose two different branches.');
    if (qtyError) throw new Error(qtyError);
    const { error } = await getSupabaseClient().rpc('cms_submit_stock_request', { p_sku: sku, p_from_branch: source, p_to_branch: admin ? dest : (myBranch || dest), p_quantity: n, p_reason: reason });
    if (error) throw new Error(error.message);
    setSku(''); setQty('1'); setTab('history'); setFilter('pending');
  }, 'Transfer request sent. The other branch will be notified to approve it.');

  const act = (id: string, verb: 'approve' | 'reject' | 'release' | 'receive', note: string | null = null) => run(async () => {
    const { error } = await getSupabaseClient().rpc('cms_process_stock_request', { p_request_id: id, p_action: verb, p_note: note });
    if (error) throw new Error(error.message);
    setRejecting(''); setRejectNote('');
  }, verb === 'approve' ? 'Request approved.' : verb === 'reject' ? 'Request rejected.' : verb === 'release' ? 'Stock released to the receiving branch.' : 'Stock received and added to inventory.');

  const can = (r: RequestRow, verb: string) => {
    if (!admin && verb === 'receive' && myBranch !== r.to_branch) return false;
    if (!admin && verb !== 'receive' && myBranch !== r.from_branch) return false;
    if (['approve', 'reject', 'release'].includes(verb) && r.requested_by === staff?.id) return false;
    return true;
  };
  const counts = (s: string) => s === 'all' ? rows.length : rows.filter(r => r.status === s).length;
  const shown = rows.filter(r => filter === 'all' || r.status === filter);

  return <div className="xfer-scrim" onClick={() => { if (!busy) onClose(); }}>
    <div className="xfer" role="dialog" aria-modal="true" aria-label="Stock transfer" onClick={e => e.stopPropagation()}>
      <div className="xfer-head">
        <div><h3>Stock Transfer</h3><p>Move items from one branch to another. Stock changes only after approval, release and receipt.</p></div>
        <button type="button" className="xfer-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <nav className="xfer-tabs">
        <button type="button" className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}><Send size={14} /> New request</button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Truck size={14} /> All requests <b>{rows.length}</b></button>
      </nav>
      {error && <p className="xfer-alert" role="alert">{error}</p>}
      {message && !error && <p className="xfer-ok" role="status">{message}</p>}

      {!staff ? <p className="xfer-empty">Sign in with a staff account to request stock.</p> : tab === 'new' ? <div className="xfer-body">
        <div className="xfer-route">
          <label className="xfer-field"><span>From (sends the stock)</span><select value={source} onChange={e => { setSource(e.target.value); setSku(''); setItemQuery(''); }}>{UC.filter(b => b !== dest).map(b => <option key={b} value={b}>{BRANCHES[b]}</option>)}</select></label>
          <ArrowRight size={18} className="xfer-arrow" aria-hidden="true" />
          <label className="xfer-field"><span>To (receives the stock)</span><select value={admin ? dest : (myBranch || dest)} disabled={!admin} onChange={e => { setDest(e.target.value); if (e.target.value === source) setSource(UC.find(b => b !== e.target.value) || source); }}>{UC.filter(b => admin || b === myBranch).map(b => <option key={b} value={b}>{BRANCHES[b]}</option>)}</select></label>
        </div>
        <div className="xfer-field"><span>Item</span>
          <div className="xfer-combo" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setItemOpen(false); }}>
            <Search size={15} className="xfer-combo-icon" aria-hidden="true" />
            <input role="combobox" aria-expanded={itemOpen} aria-controls="xfer-items" aria-label="Search item"
              value={itemOpen || !chosen ? itemQuery : `${chosen.name} · ${chosen.stock_qty} available`}
              placeholder={sourceProducts.length ? `Search ${sourceProducts.length} items in stock at ${BRANCHES[source]}…` : `No items in stock at ${BRANCHES[source]}`}
              disabled={!sourceProducts.length}
              onFocus={() => { setItemOpen(true); setItemHi(0); }}
              onChange={e => { setItemQuery(e.target.value); setItemOpen(true); setItemHi(0); if (sku) setSku(''); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setItemOpen(true); setItemHi(h => Math.min(h + 1, matches.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setItemHi(h => Math.max(h - 1, 0)); }
                else if (e.key === 'Enter' && itemOpen && matches[itemHi]) { e.preventDefault(); pickItem(matches[itemHi]); }
                else if (e.key === 'Escape' && itemOpen) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setItemOpen(false); }
              }} />
            {sku && !itemOpen && <button type="button" className="xfer-combo-clear" aria-label="Clear item" onClick={() => { setSku(''); setItemQuery(''); }}><X size={14} /></button>}
            {itemOpen && sourceProducts.length > 0 && <ul id="xfer-items" role="listbox" className="xfer-combo-list">
              {matches.length === 0 ? <li className="xfer-combo-none">No item matches “{itemQuery}”.</li> : matches.map((p, i) => <li key={p.sku} role="option" aria-selected={i === itemHi}>
                <button type="button" tabIndex={-1} className={i === itemHi ? 'hi' : ''} onMouseEnter={() => setItemHi(i)} onMouseDown={e => e.preventDefault()} onClick={() => pickItem(p)}>
                  <span className="xfer-combo-name">{p.name}<small>{p.sku}{destSkus.has(p.sku) ? '' : ' · not registered at ' + dest}</small></span>
                  <b className={Number(p.stock_qty) <= 5 ? 'low' : ''}>{Number(p.stock_qty).toLocaleString('en-PH')}</b>
                </button></li>)}
              {matches.length === 60 && <li className="xfer-combo-none">Type more to narrow the list…</li>}
            </ul>}
          </div></div>
        <div className="xfer-row">
          <label className="xfer-field"><span>Quantity</span><input type="number" min="0.001" step="0.001" value={qty} onChange={e => setQty(e.target.value)} /></label>
          <label className="xfer-field xfer-grow"><span>Reason</span><input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="e.g. Branch stock replenishment" /></label>
        </div>
        {qtyError && <p className="xfer-hint xfer-hint-bad">{qtyError}</p>}
        <div className="xfer-foot"><button type="button" className="xfer-btn" onClick={onClose}>Cancel</button><button type="button" className="xfer-btn xfer-primary" disabled={busy || !sku || !!qtyError || !reason.trim()} onClick={submit}><Send size={14} /> {busy ? 'Sending…' : 'Send Request'}</button></div>
      </div> : <div className="xfer-body xfer-body-list">
        <div className="xfer-filters">{(['all', 'pending', 'approved', 'released', 'received', 'rejected'] as const).map(s => <button key={s} type="button" className={'xfer-chip' + (filter === s ? ' active' : '')} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : STATUS_LABEL[s].split(' · ')[0]} <b>{counts(s)}</b></button>)}</div>
        {shown.length === 0 ? <p className="xfer-empty">No requests here yet.</p> : <ul className="xfer-list">{shown.map(r => <li key={r.id}>
          <div className="xfer-item-main">
            <strong>{r.product_name}</strong>
            <span className="xfer-meta">{Number(r.quantity).toLocaleString('en-PH')} unit{Number(r.quantity) === 1 ? '' : 's'} · <b>{r.from_branch}</b> → <b>{r.to_branch}</b> · {new Date(r.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            {r.reason && <span className="xfer-meta">{r.reason}</span>}
          </div>
          <span className={'xfer-status xfer-status-' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
          <div className="xfer-actions">
            {r.status === 'pending' && can(r, 'approve') && <button type="button" className="xfer-btn xfer-ok-btn" disabled={busy} onClick={() => act(r.id, 'approve')}><Check size={13} /> Approve</button>}
            {r.status === 'pending' && can(r, 'reject') && rejecting !== r.id && <button type="button" className="xfer-btn xfer-bad-btn" disabled={busy} onClick={() => { setRejecting(r.id); setRejectNote(''); }}>Reject</button>}
            {r.status === 'approved' && can(r, 'release') && <button type="button" className="xfer-btn xfer-primary" disabled={busy} onClick={() => act(r.id, 'release')}><Truck size={13} /> Release</button>}
            {r.status === 'released' && can(r, 'receive') && <button type="button" className="xfer-btn xfer-primary" disabled={busy} onClick={() => act(r.id, 'receive')}><PackageCheck size={13} /> Confirm Received</button>}
          </div>
          {rejecting === r.id && <div className="xfer-reject"><input autoFocus value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason for rejecting (required)" /><button type="button" className="xfer-btn" onClick={() => setRejecting('')}>Cancel</button><button type="button" className="xfer-btn xfer-bad-btn" disabled={busy || rejectNote.trim().length < 3} onClick={() => act(r.id, 'reject', rejectNote.trim())}>Reject</button></div>}
        </li>)}</ul>}
      </div>}
    </div>
  </div>;
}
