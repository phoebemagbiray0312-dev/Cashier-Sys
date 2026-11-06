'use client';
import { useState } from 'react';
import { getAuthorizedStaff, signInStaff, signOutStaff, type StaffProfile } from '../../lib/backend/supabase-auth';

export default function BackendAccess() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const auth = await signInStaff(email, password);
      try {
        const staff = await getAuthorizedStaff(auth.access_token);
        setProfile(staff);
        setToken(auth.access_token); // in-memory only, never browser storage
        setPassword('');
      } catch (err) {
        await signOutStaff(auth.access_token).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      setProfile(null); setToken('');
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { if (token) await signOutStaff(token); }
    catch { setError('Remote sign-out failed; please close this tab and contact an administrator.'); }
    finally { setToken(''); setProfile(null); setBusy(false); }
  }
  return <main style={{maxWidth:440,margin:'10vh auto',padding:24,fontFamily:'Arial,sans-serif'}}>
    <h1>Cashier System — Backend Access Test</h1>
    <p>This isolated test checks Supabase Auth and staff profile permissions. It does not enable financial transactions or replace the current application login.</p>
    {profile ? <section>
      <p><strong>Authenticated staff:</strong> {profile.display_name}</p>
      <p><strong>Role:</strong> {profile.role}</p>
      <p><strong>Assigned branch:</strong> {profile.branch_id || 'All branches (admin)'}</p>
      <button disabled={busy} onClick={logout}>Sign out</button>
    </section> : <form onSubmit={login} style={{display:'grid',gap:12}}>
      <label>Email <input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:10}}/></label>
      <label>Password <input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:10}}/></label>
      <button disabled={busy} type="submit" style={{padding:12}}>{busy?'Checking…':'Test secure sign in'}</button>
    </form>}
    {error && <p role="alert" style={{color:'#a12b25'}}>{error}</p>}
  </main>;
}
