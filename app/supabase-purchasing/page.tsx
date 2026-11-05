'use client';
import React,{useState} from 'react';
import {cashierSupabaseConfig} from '@/lib/supabase-config';

type Profile={user_id:string;role:'admin'|'cashier'|'pb';branch_id:string|null;active:boolean};
type Supplier={id:string;branch_id:string;name:string};
type PO={id:string;branch_id:string;po_number:string;supplier_id:string;vehicle_plate:string|null;vehicle_name:string|null;status:string;created_at:string};
type Item={id:string;po_id:string;description:string;quantity:number;unit_cost:number};
type Receipt={id:string;po_id:string;kind:string;amount:number;reference:string|null;status:string;created_at:string};
const config=cashierSupabaseConfig;
const base=config.url.replace(/\/$/,'');
const key=config.publishableKey;
const branches=['UCM','UCQC','UCLP','MMM'];
const money=(n:number)=>'₱'+n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const field:React.CSSProperties={padding:11,border:'1px solid #d9dee6',borderRadius:9,width:'100%',background:'white',color:'#172033'};
const button:React.CSSProperties={padding:'11px 16px',border:0,borderRadius:9,background:'#e8b92f',fontWeight:700,cursor:'pointer'};
const card:React.CSSProperties={padding:20,border:'1px solid #e2e8f0',borderRadius:13,background:'#fff',marginBottom:16};
async function api<T>(path:string,token:string,options:RequestInit={}):Promise<T>{
 const res=await fetch(base+path,{...options,cache:'no-store',headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...options.headers}});
 const raw=await res.text();let data:unknown;
 try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!res.ok){const d=data as {message?:string;error_description?:string;details?:string}|null;throw new Error((d?.message||d?.error_description||res.statusText)+' ('+res.status+')');}
 return data as T;
}
const query=(table:string,select:string,extra='')=>'/rest/v1/'+table+'?select='+encodeURIComponent(select)+extra;
export default function LivePurchasingPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[profile,setProfile]=useState<Profile|null>(null);
 const [branch,setBranch]=useState('UCM'),[suppliers,setSuppliers]=useState<Supplier[]>([]),[orders,setOrders]=useState<PO[]>([]),[items,setItems]=useState<Item[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]);
 const [supplierName,setSupplierName]=useState(''),[supplierId,setSupplierId]=useState(''),[poNo,setPoNo]=useState(''),[plate,setPlate]=useState(''),[vehicle,setVehicle]=useState(''),[description,setDescription]=useState(''),[qty,setQty]=useState('1'),[cost,setCost]=useState('');
 const [receiptPo,setReceiptPo]=useState(''),[receiptAmount,setReceiptAmount]=useState(''),[receiptRef,setReceiptRef]=useState(''),[receiptKind,setReceiptKind]=useState<'receipt'|'refund'>('receipt');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const canBuy=profile?.role==='admin'||profile?.role==='pb',canReceive=profile?.role==='admin'||profile?.role==='cashier';
 const allowed=profile?.role==='admin'?branches:[profile?.branch_id||''];
 async function refresh(t=token,b=branch){
  const [s,p,i,r]=await Promise.all([
   api<Supplier[]>(query('cms_suppliers','id,branch_id,name','&branch_id=eq.'+encodeURIComponent(b)+'&order=name'),t),
   api<PO[]>(query('cms_purchase_orders','id,branch_id,po_number,supplier_id,vehicle_plate,vehicle_name,status,created_at','&branch_id=eq.'+encodeURIComponent(b)+'&order=created_at.desc&limit=100'),t),
   api<Item[]>(query('cms_po_items','id,po_id,description,quantity,unit_cost','&limit=500'),t),
   api<Receipt[]>(query('cms_reconciliations','id,po_id,kind,amount,reference,status,created_at','&order=created_at.desc&limit=500'),t)
  ]);
  setSuppliers(s);setOrders(p);setItems(i);setReceipts(r);
 }
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!base||!key)throw new Error('Missing Supabase configuration. Check root .env.local.');
   const session=await api<{access_token:string}>('/auth/v1/token?grant_type=password','',{method:'POST',body:JSON.stringify({email,password})});
   const user=await api<{id:string}>('/auth/v1/user',session.access_token);
   const profiles=await api<Profile[]>(query('cms_profiles','user_id,role,branch_id,active','&user_id=eq.'+encodeURIComponent(user.id)),session.access_token);
   const p=profiles[0];if(!p?.active)throw new Error('Account has no active CMS profile.');
   const b=p.role==='admin'?'UCM':p.branch_id;if(!b||!branches.includes(b))throw new Error('Invalid branch assignment.');
   await refresh(session.access_token,b);setProfile(p);setBranch(b);setToken(session.access_token);setPassword('');setNotice('Authenticated. Live records loaded from Supabase.');
  }catch(e){setError(e instanceof Error?e.message:'Sign in failed');}finally{setBusy(false)}
 }
 async function action(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await refresh();setNotice('Saved to Supabase successfully.');}catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false)}}
 async function addSupplier(e:React.FormEvent){e.preventDefault();if(!canBuy)return;
  await action(async()=>{if(!supplierName.trim())throw new Error('Supplier name required');
   await api('/rest/v1/cms_suppliers',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({branch_id:branch,name:supplierName.trim(),created_by:profile!.user_id})});setSupplierName('');
  });
 }
 async function addPO(e:React.FormEvent){e.preventDefault();if(!canBuy)return;
  await action(async()=>{
   const n=Number(qty),c=Number(cost);
   if(!supplierId||!poNo.trim()||!description.trim()||!(n>0)||!(c>=0)||cost.trim()==='')throw new Error('Complete supplier, PO number, item, quantity and cost.');
   if(!suppliers.some(s=>s.id===supplierId))throw new Error('Supplier must belong to selected branch.');
   const created=await api<PO[]>('/rest/v1/cms_purchase_orders',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({branch_id:branch,po_number:poNo.trim(),supplier_id:supplierId,vehicle_plate:plate.trim()||null,vehicle_name:vehicle.trim()||null,status:'Pending',created_by:profile!.user_id})});
   try{await api('/rest/v1/cms_po_items',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({po_id:created[0].id,description:description.trim(),quantity:n,unit_cost:c})});}
   catch(e){throw new Error('PO created but item save failed. Do not submit again; contact admin. '+(e instanceof Error?e.message:''));}
   setPoNo('');setDescription('');setQty('1');setCost('');
  });
 }
 async function addReceipt(e:React.FormEvent){e.preventDefault();if(!canReceive)return;
  await action(async()=>{
   const n=Number(receiptAmount);
   if(!receiptPo||!(n>0)||!Number.isFinite(n))throw new Error('Choose a PO and enter a positive amount.');
   if(!orders.some(p=>p.id===receiptPo))throw new Error('PO must belong to selected branch.');
   await api('/rest/v1/cms_reconciliations',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({po_id:receiptPo,kind:receiptKind,amount:n,reference:receiptRef.trim()||null,status:'Pending',submitted_by:profile!.user_id})});
   setReceiptAmount('');setReceiptRef('');
  });
 }
 const supplierNameFor=(id:string)=>suppliers.find(s=>s.id===id)?.name||'Unknown supplier';
 return <main style={{maxWidth:1120,margin:'28px auto',padding:'0 18px 50px',fontFamily:'Arial,sans-serif',color:'#172033',background:'#f8fafc'}}>
  <h1 style={{marginBottom:6}}>Cashier System — Live Purchasing Pilot</h1>
  <p style={{color:'#64748b'}}>Supabase-backed supplier, PO and reconciliation records. Existing Cashier localStorage records are not migrated or modified.</p>
  <p style={{color:'#9a6700'}}>Pilot only: no attachment uploads, approval actions, or historical localStorage migration yet. Do not use for production accounting until validated.</p>
  {!profile?<form onSubmit={signIn} style={{...card,maxWidth:460,display:'grid',gap:12}}>
   <strong>Sign in with Supabase Auth</strong>
   <input aria-label="Email" style={field} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/>
   <input aria-label="Password" style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/>
   <button disabled={busy} style={button}>Sign in</button>
  </form>:<>
   <div style={{...card,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
    <strong>{email} · {profile.role.toUpperCase()}</strong>
    <label>Branch <select style={{...field,width:210,marginLeft:8}} value={branch} onChange={async e=>{const b=e.target.value;setBusy(true);setError('');try{await refresh(token,b);setBranch(b);setSupplierId('');setReceiptPo('')}catch(err){setError(err instanceof Error?err.message:'Load failed')}finally{setBusy(false)}}}>{allowed.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
    <button style={{...button,background:'#f1f5f9'}} disabled={busy} onClick={()=>action(async()=>{})}>Refresh</button>
    <button style={{...button,background:'#f1f5f9'}} onClick={()=>{setToken('');setProfile(null);setOrders([]);setSuppliers([]);setItems([]);setReceipts([]);setNotice('Signed out locally.')}}>Clear session</button>
   </div>
   {canBuy&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16}}>
    <form style={card} onSubmit={addSupplier}><h3>Add supplier — {branch}</h3><input style={field} placeholder="Supplier name" value={supplierName} onChange={e=>setSupplierName(e.target.value)} required/><button disabled={busy} style={{...button,marginTop:12}}>Save supplier</button></form>
    <form style={{...card,display:'grid',gap:10}} onSubmit={addPO}><h3 style={{margin:0}}>Create purchase order — {branch}</h3>
     <select style={field} value={supplierId} onChange={e=>setSupplierId(e.target.value)} required><option value="">Select supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
     <input style={field} placeholder="Unique PO number" value={poNo} onChange={e=>setPoNo(e.target.value)} required/>
     <input style={field} placeholder="Vehicle plate (optional)" value={plate} onChange={e=>setPlate(e.target.value)}/>
     <input style={field} placeholder="Vehicle name (optional)" value={vehicle} onChange={e=>setVehicle(e.target.value)}/>
     <input style={field} placeholder="Part / item description" value={description} onChange={e=>setDescription(e.target.value)} required/>
     <div style={{display:'flex',gap:8}}><input style={field} aria-label="Quantity" type="number" min="0.001" step="0.001" value={qty} onChange={e=>setQty(e.target.value)} required/><input style={field} aria-label="Unit cost" type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="Unit cost" required/></div>
     <button disabled={busy} style={button}>Create PO and item</button>
    </form>
   </div>}
   {canReceive&&<form onSubmit={addReceipt} style={{...card,display:'grid',gap:10,maxWidth:600}}><h3 style={{margin:0}}>Submit supplier receipt / refund — {branch}</h3>
    <select style={field} value={receiptPo} onChange={e=>setReceiptPo(e.target.value)} required><option value="">Select purchase order</option>{orders.map(p=><option key={p.id} value={p.id}>{p.po_number} · {supplierNameFor(p.supplier_id)}</option>)}</select>
    <select style={field} value={receiptKind} onChange={e=>setReceiptKind(e.target.value as 'receipt'|'refund')}><option value="receipt">Supplier receipt</option><option value="refund">Refund</option></select>
    <input style={field} type="number" min="0.01" step="0.01" placeholder="Amount" value={receiptAmount} onChange={e=>setReceiptAmount(e.target.value)} required/>
    <input style={field} placeholder="Reference number (optional)" value={receiptRef} onChange={e=>setReceiptRef(e.target.value)}/>
    <p style={{fontSize:12,color:'#64748b',margin:0}}>Submissions start as Pending. No automatic matching or payment verification is performed.</p>
    <button disabled={busy} style={button}>Submit pending record</button>
   </form>}
   <section style={card}><h3>Suppliers ({suppliers.length})</h3>{suppliers.length===0?<p>No suppliers in this branch yet.</p>:suppliers.map(s=><p key={s.id}>{s.name}</p>)}</section>
   <section style={card}><h3>Purchase orders ({orders.length})</h3>{orders.length===0?<p>No Supabase purchase orders in this branch yet.</p>:orders.map(p=>{
    const poItems=items.filter(i=>i.po_id===p.id);const poReceipts=receipts.filter(r=>r.po_id===p.id);
    return <div key={p.id} style={{padding:'12px 0',borderTop:'1px solid #e2e8f0'}}>
     <strong>{p.po_number} · {supplierNameFor(p.supplier_id)}</strong> <span style={{color:'#64748b'}}>({p.status})</span>
     <div style={{fontSize:13,color:'#64748b',marginTop:4}}>{p.vehicle_plate||'No plate'} · {p.vehicle_name||'No vehicle'} · {new Date(p.created_at).toLocaleString()}</div>
     {poItems.map(i=><div key={i.id} style={{fontSize:13,marginTop:5}}>{i.description} · {i.quantity} × {money(Number(i.unit_cost))} = {money(Number(i.quantity)*Number(i.unit_cost))}</div>)}
     {poReceipts.map(r=><div key={r.id} style={{fontSize:13,marginTop:5}}>{r.kind==='refund'?'Refund':'Receipt'} · {money(Number(r.amount))} · {r.status} · {r.reference||'No reference'} · {new Date(r.created_at).toLocaleString()}</div>)}
    </div>;
   })}</section>
  </>}
  {error&&<p role="alert" style={{...card,color:'#b91c1c'}}>{error}</p>}
  {notice&&<p role="status" style={{...card,color:'#166534'}}>{notice}</p>}
  <a href="/supabase-test" style={{color:'#946c00'}}>Back to Supabase read-only connection test</a>
 </main>;
}
