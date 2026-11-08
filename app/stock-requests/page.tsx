'use client';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase-client';
import { getCurrentStaff } from '../../lib/supabase-auth';
type RequestRow={id:string;product_name:string;product_sku:string;from_branch:string;to_branch:string;quantity:number;status:string;reason:string;created_at:string;requested_by:string};
type Product={sku:string;name:string;branch_id:string;stock_qty:number};
const UC=['UCM','UCQC','UCLP'];
export default function StockRequestsPage(){
 const [staff,setStaff]=useState<any>(null),[rows,setRows]=useState<RequestRow[]>([]),[products,setProducts]=useState<Product[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [source,setSource]=useState('UCM'),[dest,setDest]=useState('UCQC'),[sku,setSku]=useState(''),[qty,setQty]=useState('1'),[reason,setReason]=useState('Branch stock replenishment');
 const load=async()=>{const s=await getCurrentStaff();setStaff(s);if(!s)return;const db=getSupabaseClient();const [a,b]=await Promise.all([db.from('cms_stock_requests').select('id,product_name,product_sku,from_branch,to_branch,quantity,status,reason,created_at,requested_by').order('created_at',{ascending:false}).limit(100),db.from('cms_products').select('sku,name,branch_id,stock_qty').in('branch_id',UC).order('name')]);if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);setRows((a.data||[]) as RequestRow[]);setProducts((b.data||[]) as Product[])};
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn();await load()}catch(e:any){setError(e.message||'Request failed')}finally{setBusy(false)}};
 const submit=()=>run(async()=>{const n=Number(qty);if(!Number.isFinite(n)||n<=0||source===dest||!sku)throw new Error('Choose a product, different branches and a positive quantity.');const {error}=await getSupabaseClient().rpc('cms_submit_stock_request',{p_sku:sku,p_from_branch:source,p_to_branch:admin?dest:(branch||dest),p_quantity:n,p_reason:reason});if(error)throw error;setMessage('Stock request submitted.')});
 const action=(id:string,verb:string)=>run(async()=>{const note=verb==='reject'?window.prompt('Reason for rejection (required):')||'':null;if(verb==='reject'&&(note ?? '').trim().length<3)return;const {error}=await getSupabaseClient().rpc('cms_process_stock_request',{p_request_id:id,p_action:verb,p_note:note});if(error)throw error;setMessage('Request updated: '+verb)});
 const branch=staff?.branch;const admin=String(staff?.role||'').toLowerCase()==='admin';
 const can=(r:RequestRow,verb:string)=>{if(!admin&&verb==='receive'&&branch!==r.to_branch)return false;if(!admin&&verb!=='receive'&&branch!==r.from_branch)return false;if(['approve','reject','release'].includes(verb)&&r.requested_by===staff?.user_id)return false;return true};
 const available=products.filter(p=>p.branch_id===source);
 return <main style={{maxWidth:1050,margin:'30px auto',padding:20,fontFamily:'Arial,sans-serif',color:'#222'}}>
 <a href="/online-inventory">← Inventory</a><h1>Inter-Branch Stock Requests</h1><p>UC branches only. Approval, release, and receiving are recorded separately.</p>
 {!staff?<p>Sign in using an active staff account to access this page.</p>:<>
 <section style={{border:'1px solid #ddd',padding:18,borderRadius:10,marginBottom:20}}><h2>New Stock Request</h2>
 <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
 <label>From branch<br/><select value={source} onChange={e=>{setSource(e.target.value);setSku('')}}>{UC.map(b=><option key={b}>{b}</option>)}</select></label>
 <label>To branch<br/><select value={admin?dest:(branch||dest)} disabled={!admin} onChange={e=>setDest(e.target.value)}>{UC.filter(b=>admin||b===branch).map(b=><option key={b}>{b}</option>)}</select></label>
 <label>Product<br/><select value={sku} onChange={e=>setSku(e.target.value)}><option value="">Select product</option>{available.map(p=><option key={p.sku} value={p.sku}>{p.name} — available {p.stock_qty}</option>)}</select></label>
 <label>Quantity<br/><input type="number" min=".001" step=".001" value={qty} onChange={e=>setQty(e.target.value)} /></label></div>
 <p><label>Reason<br/><input style={{width:'100%',maxWidth:500}} value={reason} onChange={e=>setReason(e.target.value)} /></label></p>
 <button disabled={busy||!sku} onClick={submit}>Submit Request</button><p style={{fontSize:12}}>The destination branch must already have this SKU registered. No stock changes until release/receipt.</p>
 </section><section><h2>Request History</h2>{rows.length===0?<p>No requests yet.</p>:rows.map(r=><article key={r.id} style={{border:'1px solid #ddd',borderRadius:8,padding:14,marginBottom:10}}><strong>{r.product_name}</strong> · {r.quantity} · {r.from_branch} → {r.to_branch}<p>Status: <strong>{r.status.toUpperCase()}</strong> · {new Date(r.created_at).toLocaleString()}</p><small>{r.reason}</small><div style={{display:'flex',gap:8,marginTop:10}}>{r.status==='pending'&&can(r,'approve')&&<><button disabled={busy} onClick={()=>action(r.id,'approve')}>Approve</button><button disabled={busy} onClick={()=>action(r.id,'reject')}>Reject</button></>}{r.status==='approved'&&can(r,'release')&&<button disabled={busy} onClick={()=>action(r.id,'release')}>Release Stock</button>}{r.status==='released'&&can(r,'receive')&&<button disabled={busy} onClick={()=>action(r.id,'receive')}>Confirm Received</button>}</div></article>)}</section></>}
 {error&&<p role="alert" style={{color:'darkred'}}>{error}</p>}{message&&<p role="status" style={{color:'green'}}>{message}</p>}
 </main>;
}
