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
 return <main className="stock-requests-page">
 <style>{`
 .stock-requests-page{width:100%;max-width:1120px;margin:0 auto;padding:22px 24px 48px;box-sizing:border-box;font-family:inherit;color:#253044}
 .stock-requests-page *{box-sizing:border-box}
 .stock-requests-page .sr-back{display:inline-flex;align-items:center;gap:8px;color:#667085;text-decoration:none;font-size:12px;font-weight:650;margin-bottom:14px}
 .stock-requests-page .sr-title{font-size:23px;font-weight:750;letter-spacing:-.5px;margin:0 0 5px}
 .stock-requests-page .sr-subtitle{font-size:13px;color:#7a8494;margin:0 0 22px}
 .stock-requests-page .sr-panel{border:1px solid #e6e9ee;background:#fff;border-radius:16px;box-shadow:0 3px 12px rgba(16,24,40,.035);overflow:hidden;margin-bottom:18px}
 .stock-requests-page .sr-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:19px 22px;border-bottom:1px solid #edf0f3}
 .stock-requests-page .sr-panel-head h2{font-size:15px;font-weight:750;margin:0}
 .stock-requests-page .sr-panel-head p{font-size:12px;color:#858d9a;margin:4px 0 0}
 .stock-requests-page .sr-tag{font-size:11px;font-weight:750;color:#886400;background:#fff4cc;border:1px solid #f5e4a1;padding:6px 10px;border-radius:20px;white-space:nowrap}
 .stock-requests-page .sr-form{padding:21px 22px 22px}
 .stock-requests-page .sr-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 .stock-requests-page .sr-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:12px;color:#465267;font-weight:700}
 .stock-requests-page .sr-field input,.stock-requests-page .sr-field select{display:block;width:100%;height:43px;border:1px solid #dfe3e9;border-radius:9px;background:#fff;color:#273044;font-family:inherit;font-size:13px;font-weight:500;padding:0 12px;outline:none}
 .stock-requests-page .sr-field input:focus,.stock-requests-page .sr-field select:focus{border-color:#d2a51e;box-shadow:0 0 0 3px #fdf4d7}
 .stock-requests-page .sr-field select:disabled{background:#f6f7f9;color:#667085}
 .stock-requests-page .sr-route{display:flex;align-items:center;justify-content:center;color:#a07b1c;font-weight:800;background:#fff8e4;border:1px solid #f3e7bd;border-radius:9px;width:40px;height:40px;margin:auto auto 1px}
 .stock-requests-page .sr-route-grid{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);gap:12px;align-items:end;margin-bottom:17px}
 .stock-requests-page .sr-note{display:flex;align-items:flex-start;gap:8px;background:#f8f9fb;border:1px solid #edf0f3;border-radius:9px;padding:11px 13px;color:#737e90;font-size:11px;line-height:1.5;margin-top:17px}
 .stock-requests-page .sr-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:19px}
 .stock-requests-page button{border:0;border-radius:9px;padding:10px 15px;min-height:39px;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer}
 .stock-requests-page button:disabled{opacity:.5;cursor:not-allowed}
 .stock-requests-page .sr-primary{background:#f5c846;color:#3a310d}
 .stock-requests-page .sr-secondary{background:#fff;border:1px solid #dfe3e9;color:#475467}
 .stock-requests-page .sr-danger{background:#fff4f2;border:1px solid #f9d4ce;color:#a43b2d}
 .stock-requests-page .sr-history{padding:10px 22px 16px}
 .stock-requests-page .sr-empty{text-align:center;padding:38px 10px 44px;color:#8992a0;font-size:13px}
 .stock-requests-page .sr-empty strong{display:block;color:#495365;font-size:14px;margin-bottom:5px}
 .stock-requests-page .sr-item{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid #edf0f3;padding:15px 0}
 .stock-requests-page .sr-item:last-child{border-bottom:0}
 .stock-requests-page .sr-item strong{font-size:13px}
 .stock-requests-page .sr-meta{font-size:11px;color:#7d8796;margin:5px 0}
 .stock-requests-page .sr-status{display:inline-block;background:#fff6da;color:#886400;border-radius:20px;padding:4px 9px;font-size:10px;font-weight:750;text-transform:uppercase}
 .stock-requests-page .sr-item-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
 @media(max-width:700px){.stock-requests-page{padding:14px}.stock-requests-page .sr-panel-head,.stock-requests-page .sr-form{padding:16px}.stock-requests-page .sr-grid{grid-template-columns:1fr}.stock-requests-page .sr-route-grid{grid-template-columns:1fr}.stock-requests-page .sr-route{transform:rotate(90deg);height:32px;width:32px}.stock-requests-page .sr-item{align-items:flex-start;flex-direction:column}.stock-requests-page .sr-history{padding:10px 16px}}
 `}</style>
 <a className="sr-back" href="/online-inventory">← Back to Inventory</a>
 <h1 className="sr-title">Inter-Branch Stock Requests</h1>
 <p className="sr-subtitle">Transfer inventory between UC branches with approval and movement tracking.</p>
 {!staff?<section className="sr-panel"><div className="sr-form">Sign in using an active staff account to access this page.</div></section>:<>
 <section className="sr-panel">
  <div className="sr-panel-head"><div><h2>New Stock Request</h2><p>Fill in the transfer details below</p></div><span className="sr-tag">UC Branches</span></div>
  <div className="sr-form">
   <div className="sr-route-grid"><label className="sr-field">From Branch<select value={source} onChange={e=>{setSource(e.target.value);setSku('')}}>{UC.map(b=><option key={b} value={b}>{b}</option>)}</select></label><span className="sr-route" aria-hidden="true">→</span><label className="sr-field">To Branch<select value={admin?dest:(branch||dest)} disabled={!admin} onChange={e=>setDest(e.target.value)}>{UC.filter(b=>admin||b===branch).map(b=><option key={b} value={b}>{b}</option>)}</select></label></div>
   <div className="sr-grid"><label className="sr-field">Product<select value={sku} onChange={e=>setSku(e.target.value)}><option value="">Select product</option>{available.map(p=><option key={p.sku} value={p.sku}>{p.name} — available {p.stock_qty}</option>)}</select></label><label className="sr-field">Quantity<input type="number" min=".001" step=".001" value={qty} onChange={e=>setQty(e.target.value)}/></label></div>
   <label className="sr-field" style={{marginTop:16}}>Reason for Request<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="e.g. Branch stock replenishment"/></label>
   <div className="sr-note"><span aria-hidden="true">ⓘ</span><span>The destination branch must already have the selected SKU. Stock balances will only change after approval, release, and receipt.</span></div>
   <div className="sr-actions"><button className="sr-primary" disabled={busy||!sku} onClick={submit}>{busy?'Processing...':'Submit Stock Request'}</button></div>
  </div>
 </section>
 <section className="sr-panel"><div className="sr-panel-head"><div><h2>Request History</h2><p>Track submitted requests and approval status</p></div><span className="sr-tag">{rows.length} requests</span></div>
 <div className="sr-history">{rows.length===0?<div className="sr-empty"><strong>No stock requests yet</strong>Submitted stock requests will appear here.</div>:rows.map(r=><article key={r.id} className="sr-item"><div><strong>{r.product_name}</strong> <span className="sr-status">{r.status}</span><p className="sr-meta">{r.quantity} units · {r.from_branch} → {r.to_branch} · {new Date(r.created_at).toLocaleString('en-PH')}</p><p className="sr-meta">{r.reason}</p></div><div className="sr-item-actions">{r.status==='pending'&&can(r,'approve')&&<><button className="sr-primary" disabled={busy} onClick={()=>action(r.id,'approve')}>Approve</button><button className="sr-danger" disabled={busy} onClick={()=>action(r.id,'reject')}>Reject</button></>}{r.status==='approved'&&can(r,'release')&&<button className="sr-primary" disabled={busy} onClick={()=>action(r.id,'release')}>Release Stock</button>}{r.status==='released'&&can(r,'receive')&&<button className="sr-primary" disabled={busy} onClick={()=>action(r.id,'receive')}>Confirm Received</button>}</div></article>)}</div></section>
 </>}
 {error&&<p role="alert" style={{color:'#b42318',fontSize:12}}>{error}</p>}{message&&<p role="status" style={{color:'#067647',fontSize:12}}>{message}</p>}
 </main>;
}
