'use client';

import { useEffect, useState } from 'react';
import { getCurrentStaff, signOutStaff, type StaffIdentity } from '@/lib/supabase-auth';
import { getSupabaseClient } from '@/lib/supabase-client';

type Branch = { id: string; name: string };
type Supplier = { id: string; name: string; branch_id: string };
type FundEntry = { id: string; branch_id: string; amount: number };
export default function OnlineWorkspace() {
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [funds, setFunds] = useState<FundEntry[]>([]);
  const [status, setStatus] = useState('Checking your Supabase session...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const identity = await getCurrentStaff();
        if (!active) return;
        if (!identity) { setStatus('Not authorized. Please sign in at /staff-login-test.'); return; }
        const supabase = getSupabaseClient();
        const [b, s, f] = await Promise.all([
          supabase.from('cms_branches').select('id,name').order('id'),
          supabase.from('cms_suppliers').select('id,name,branch_id').limit(100),
          supabase.from('cms_fund_entries').select('id,branch_id,amount').limit(100),
        ]);
        if (!active) return;
        if (b.error || s.error || f.error) throw new Error('Unable to read one or more authorized tables.');
        setStaff(identity);
        setBranches((b.data ?? []) as Branch[]);
        setSuppliers((s.data ?? []) as Supplier[]);
        setFunds((f.data ?? []) as FundEntry[]);
        setStatus('Connected to Supabase. Records shown are filtered by database RLS.');
      } catch { if (active) setStatus('Database read failed. Check profile permissions and configuration.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  async function logout() {
    try { await signOutStaff(); window.location.assign('/staff-login-test'); }
    catch { setStatus('Sign-out failed. Please retry.'); }
  }
  return <main style={{maxWidth:960,margin:'40px auto',padding:24,fontFamily:'Arial,sans-serif'}}>
    <h1>UC Cashier — Online Backend Preview</h1>
    <p>This is a read-only database connectivity test. The existing POS and inventory remain browser-local.</p>
    <p role="status">{status}</p>
    {!loading && staff && <section>
      <p><strong>{staff.displayName}</strong> · {staff.role} · {staff.branch ?? 'All branches'}</p>
      <button onClick={logout}>Sign out</button>
      <h2>Authorized branches ({branches.length})</h2>
      <ul>{branches.map(b=><li key={b.id}>{b.name} ({b.id})</li>)}</ul>
      <h2>Suppliers visible ({suppliers.length})</h2>
      <ul>{suppliers.map(s=><li key={s.id}>{s.name} — {s.branch_id}</li>)}</ul>
      <h2>Fund entries visible ({funds.length}, first 100)</h2>
      <p>Read-only total of loaded entries: ₱{funds.reduce((sum,f)=>sum+Number(f.amount),0).toLocaleString('en-PH',{minimumFractionDigits:2})}</p>
      <p>Database RLS—not the UI—determines which rows are returned.</p>
    </section>}
  </main>;
}
