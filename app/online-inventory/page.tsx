'use client';

import {useEffect,useState} from 'react';
import {getCurrentStaff,type StaffIdentity} from '@/lib/supabase-auth';
import {listOnlineProducts,type OnlineProduct} from '@/lib/online-cashier';
import {listStockMovements,recordStockMovement,type StockMovement,type StockOperation} from '@/lib/online-inventory';

const branches = ['UCQC','UCM','UCLP','MMM'];
export default function OnlineInventoryPage(){
 const [staff,setStaff]=useState<StaffIdentity|null>(null);
 const [products,setProducts]=useState<OnlineProduct[]>([]);
 const [history,setHistory]=useState<StockMovement[]>([]);
 const [branch,setBranch]=useState('UCM');
 const [productId,setProductId]=useState('');
 const [kind,setKind]=useState<StockOperation>('receive');
 const [quantity,setQuantity]=useState('1');
 const [reason,setReason]=useState('');
 const [destination,setDestination]=useState('UCQC');
 const [message,setMessage]=useState('Checking Supabase access...');
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [showHistory,setShowHistory]=useState(false);
 async function refresh(branchId:string){
  const [p,h]=await Promise.all([listOnlineProducts(branchId),listStockMovements(branchId)]);
  setProducts(p);setHistory(h);setPage(1);
  setProductId(old=>p.some(x=>x.id===old)?old:(p[0]?.id??''));
 }
 useEffect(()=>{
  let mounted=true;
  getCurrentStaff().then(async identity=>{
   if(!mounted)return;
   if(!identity){setMessage('Please sign in at /staff-login-test first.');return;}
   setStaff(identity);
   const selected=identity.branch??'UCM';setBranch(selected);
   try{await refresh(selected);if(mounted)setMessage('Connected. All changes are recorded in Supabase.');}
   catch{if(mounted)setMessage('Unable to load authorized inventory.');}
  }).catch(()=>{if(mounted)setMessage('Authentication check failed.');});
  return()=>{mounted=false};
 },[]);
 async function changeBranch(value:string){
  if(staff?.role!=='admin'&&value!==staff?.branch)return;
  setBranch(value);setMessage('Loading inventory...');
  try{await refresh(value);setMessage('Inventory loaded.');}catch{setMessage('Could not load inventory.');}
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy||!productId)return;
  const selected=products.find(p=>p.id===productId);
  if(!selected||selected.branch_id!==branch){setMessage('Choose a valid product.');return;}
  const n=Number(quantity);
  if(!Number.isFinite(n)||n===0||Math.abs(n)>100000000){setMessage('Enter a valid quantity.');return;}
  if(!window.confirm('Confirm '+kind+' for '+selected.name+' ('+quantity+')? This changes live Supabase inventory.'))return;
  setBusy(true);setMessage('Saving stock movement...');
  try{
   await recordStockMovement({productId,kind,quantity:n,reason,destinationBranch:kind==='transfer'?destination:undefined});
   await refresh(branch);setReason('');setMessage('Stock movement saved and logged.');
  }catch(err){setMessage(err instanceof Error?err.message:'Stock update failed.');}
  finally{setBusy(false);}
 }
 const filtered=products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase().trim()));
 const pageCount=Math.max(1,Math.ceil(filtered.length/15));
 const visible=filtered.slice((Math.min(page,pageCount)-1)*15,Math.min(page,pageCount)*15);
 const allowedKinds:StockOperation[]=staff?.role==='admin'?['receive','issue','adjust','transfer']:staff?.role==='pb'?['receive','issue']:['issue'];
 return <main style={{maxWidth:1050,margin:'24px auto',padding:20,fontFamily:'Arial,sans-serif',lineHeight:1.5}}>
  <h1>UC / Mastermind — Online Inventory</h1>
  <p>Development preview · Connected to Supabase · Existing local inventory is not synchronized.</p>
  <p role="status">{message}</p>
  {staff&&<><p><strong>{staff.displayName}</strong> · {staff.role} · {staff.branch??'All branches'}</p>
   <p><a href="/staff-login-test">Staff login</a> · <a href="/online-preview">Backend overview</a></p>
   <label>Branch <select value={branch} onChange={e=>void changeBranch(e.target.value)} disabled={busy}>
    {branches.filter(b=>staff.role==='admin'||b===staff.branch).map(b=><option key={b} value={b}>{b}</option>)}
   </select></label>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'18px 0'}}><div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>Products: <strong>{products.length}</strong></div><div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>Zero balance: <strong>{products.filter(p=>Number(p.stock_qty)===0).length}</strong></div><a href="/stock-requests" style={{padding:12,background:'#f2c94c',borderRadius:8,color:'#222',textDecoration:'none'}}>Stock Requests →</a></div>
   <label>Search products <input placeholder="Search name or SKU" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} style={{padding:10,width:'100%',maxWidth:450,margin:'10px 0'}} /></label>
   <h2>Products ({filtered.length} of {products.length})</h2>
   <p style={{fontSize:13}}>Zero balances may be unverified opening stock. Product prices are not yet encoded.</p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>SKU</th><th>Product</th><th>Available</th><th>Price</th></tr></thead>
   <tbody>{visible.map(p=><tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.stock_qty}</td><td>{Number(p.unit_price)===0?'Not set':'₱'+Number(p.unit_price).toFixed(2)}</td></tr>)}</tbody></table></div>
   <p><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button> &nbsp; Page {Math.min(page,pageCount)} of {pageCount} &nbsp; <button type="button" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>Next</button></p>
   {products.length===0&&<p>No online products for this branch yet. An Admin must register a product before stock movements can be recorded.</p>}
   <h2>Stock In / Stock Out</h2><p style={{fontSize:13}}>For verified opening stock, use Receive with reason "Verified opening stock count". Stock transfers between branches should use Stock Requests.</p>
   <form onSubmit={e=>void submit(e)} style={{display:'grid',gap:12,maxWidth:540}}>
    <label>Product <select value={productId} onChange={e=>setProductId(e.target.value)} required disabled={busy}>{products.map(p=><option value={p.id} key={p.id}>{p.sku} — {p.name}</option>)}</select></label>
    <label>Action <select value={kind} onChange={e=>setKind(e.target.value as StockOperation)} disabled={busy}>{allowedKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
    <label>Quantity {kind==='adjust'?'(positive or negative)':''}<input type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} required disabled={busy}/></label>
    {kind==='transfer'&&<label>Destination branch <select value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy}>{branches.filter(b=>b!==branch).map(b=><option key={b} value={b}>{b}</option>)}</select></label>}
    <label>Reason <input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={500} required placeholder="Delivery reference / issuance reason" disabled={busy}/></label>
    <button type="submit" disabled={busy||!productId}>{busy?'Saving...':'Confirm stock movement'}</button>
   </form>
   <h2>Stock movement history</h2><button type="button" onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide':'Show'} movement history ({history.length})</button>
   {showHistory&&<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Date</th><th>Action</th><th>Change</th><th>Before</th><th>After</th><th>Reason</th></tr></thead>
    <tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('en-PH')}</td><td>{h.movement_type}</td><td>{h.quantity_delta}</td><td>{h.quantity_before}</td><td>{h.quantity_after}</td><td>{h.reason}</td></tr>)}</tbody></table></div>}
  </>}
 </main>;
}
