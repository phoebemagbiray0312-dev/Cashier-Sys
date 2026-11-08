'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getCurrentStaff, signInStaff, signOutStaff, type StaffIdentity } from '@/lib/supabase-auth';

/** Staging-only authentication smoke test. Does not grant access to the local prototype. */
export default function StaffLoginTestPage() {
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getCurrentStaff().then(value => { if (active) setStaff(value); })
      .catch(() => { if (active) setMessage('Unable to verify session.'); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const identity = await signInStaff(email, password);
      setStaff(identity);
      setPassword('');
      if (new URLSearchParams(window.location.search).get('next') === '/online-inventory') window.location.replace('/online-inventory');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await signOutStaff(); setStaff(null); setMessage('Signed out.'); }
    catch { setMessage('Sign-out failed.'); }
    finally { setBusy(false); }
  }
  return <main style={{maxWidth:440,margin:'8vh auto',padding:24,fontFamily:'sans-serif'}}>
    <h1>Staff authentication test</h1>
    <p>This verifies Supabase Auth and active staff assignment only. The Cashier System is not yet connected to Supabase transactions.</p>
    {staff ? <section><p>Authenticated: {staff.displayName}</p><p>Role: {staff.role}</p><p>Branch: {staff.branch ?? 'All branches (admin)'}</p>
      <p><a href="/online-inventory">Open Online Inventory →</a></p><button disabled={busy} onClick={logout}>Sign out</button></section> :
      <form onSubmit={submit} style={{display:'grid',gap:12}}>
        <label>Email<input style={{display:'block',width:'100%',padding:8}} type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input style={{display:'block',width:'100%',padding:8}} type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button type="submit" disabled={busy}>{busy?'Checking...':'Verify staff login'}</button>
      </form>}
    {message && <p role="status">{message}</p>}
  </main>;
}
