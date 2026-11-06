'use client';

import React, {useState} from 'react';
import {cashierSupabaseConfig} from '@/lib/supabase-config';

type Profile = {user_id:string;display_name:string;role:'admin'|'cashier'|'pb';branch_id:string|null;active:boolean};
type Branch = {id:string;name:string};
type Supplier = {id:string;branch_id:string;name:string};
type PO = {id:string;branch_id:string;po_number:string;status:string;created_at:string};

const base = cashierSupabaseConfig.url.replace(/\/$/,'');
const key = cashierSupabaseConfig.publishableKey;

async function request<T>(path:string, token?:string, options?:RequestInit):Promise<T>{
  const res=await fetch(base+path,{
    ...options,
    cache:'no-store',
    headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...options?.headers},
  });
  const body=await res.text();
  let data:unknown;
  try{data=body?JSON.parse(body):null}catch{data=body}
  if(!res.ok){
    const detail=typeof data==='object'&&data!==null&&'message' in data?String((data as {message:unknown}).message):res.statusText;
    throw new Error(res.status+' '+detail);
  }
  return data as T;
}

export default function SupabaseTestPage(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [token,setToken]=useState('');
  const [profile,setProfile]=useState<Profile|null>(null);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [orders,setOrders]=useState<PO[]>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  async function load(accessToken:string){
    const user=await request<{id:string}>('/auth/v1/user',accessToken);
    const profiles=await request<Profile[]>('/rest/v1/cms_profiles?select=user_id,display_name,role,branch_id,active&user_id=eq.'+encodeURIComponent(user.id),accessToken);
    const current=profiles[0];
    if(!current||!current.active)throw new Error('No active cms_profiles row for this account. Ask an administrator to assign a role and branch.');
    const [b,s,p]=await Promise.all([
      request<Branch[]>('/rest/v1/cms_branches?select=id,name&order=id',accessToken),
      request<Supplier[]>('/rest/v1/cms_suppliers?select=id,branch_id,name&limit=50',accessToken),
      request<PO[]>('/rest/v1/cms_purchase_orders?select=id,branch_id,po_number,status,created_at&order=created_at.desc&limit=50',accessToken),
    ]);
    setProfile(current);setBranches(b);setSuppliers(s);setOrders(p);
    setMessage('Authenticated read test passed. Results below are restricted by Supabase RLS.');
  }

  async function signIn(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage('');
    try{
      if(!base||!key)throw new Error('Missing Supabase URL or publishable key in root .env.local.');
      const session=await request<{access_token:string}>('/auth/v1/token?grant_type=password',undefined,{method:'POST',body:JSON.stringify({email,password})});
      setPassword('');
      setToken(session.access_token);
      await load(session.access_token);
    }catch(error){setMessage(error instanceof Error?error.message:'Sign-in failed.');setProfile(null)}
    finally{setBusy(false)}
  }

  function signOut(){
    setToken('');setProfile(null);setPassword('');setBranches([]);setSuppliers([]);setOrders([]);setMessage('Local test session cleared. Close this tab to discard credentials.');
  }

  const panel:React.CSSProperties={border:'1px solid #e2e8f0',borderRadius:12,padding:18,background:'#fff'};
  return <main style={{maxWidth:900,margin:'32px auto',padding:'0 18px',fontFamily:'Arial,sans-serif',color:'#172033'}}>
    <h1>Cashier System — Supabase Connection Test</h1>
    <p>This is an isolated backend pilot. The existing Cashier app and localStorage data are unchanged. This page uses real Supabase Auth and branch-level RLS.</p>
    <p style={{color:'#9a6700'}}>Testing only. Do not enter the legacy Cashier app password here; use an account created in Supabase Authentication.</p>
    {!profile?<form onSubmit={signIn} style={{...panel,display:'grid',gap:12,maxWidth:440}}>
      <label>Supabase Auth email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
      <label>Supabase Auth password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:10,boxSizing:'border-box'}}/></label>
      <button type="submit" disabled={busy} style={{padding:12,background:'#e6b839',border:0,borderRadius:8,cursor:'pointer'}}>{busy?'Checking…':'Sign in and test RLS'}</button>
    </form>:<div style={{display:'grid',gap:14}}>
      <div style={panel}><strong>Authenticated profile</strong><p>{profile.display_name||email} · {profile.role} · {profile.branch_id||'All branches (admin)'}</p><button onClick={async()=>{setBusy(true);try{await load(token)}catch(e){setMessage(e instanceof Error?e.message:'Refresh failed')}finally{setBusy(false)}}} disabled={busy}>Refresh read test</button> <button onClick={signOut}>Clear test session</button></div>
      <section style={panel}><h2>Visible branches ({branches.length})</h2>{branches.map(b=><p key={b.id}>{b.id} — {b.name}</p>)}</section>
      <section style={panel}><h2>Visible suppliers ({suppliers.length})</h2>{suppliers.map(s=><p key={s.id}>{s.branch_id} — {s.name}</p>)}</section>
      <section style={panel}><h2>Visible purchase orders ({orders.length})</h2>{orders.map(o=><p key={o.id}>{o.branch_id} — {o.po_number} — {o.status}</p>)}</section>
    </div>}
    {message&&<p role="status" style={{...panel,marginTop:16,overflowWrap:'anywhere'}}>{message}</p>}
    <p style={{fontSize:13,color:'#64748b'}}>No database writes or receipt uploads are performed here. Access tokens are kept in React memory only and are not stored in localStorage.</p>
  </main>;
}
