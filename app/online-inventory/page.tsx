'use client';

import {useEffect,useState} from 'react';
import {getCurrentStaff,type StaffIdentity} from '@/lib/supabase-auth';
import {listOnlineProducts,type OnlineProduct} from '@/lib/online-cashier';
import {listStockMovements,recordStockMovement,type StockMovement,type StockOperation} from '@/lib/online-inventory';

const branches = ['UCQC','UCM','UCLP','MMM'];
const branchNames:Record<string,string>={UCQC:'Underchargers Quezon City',UCM:'Underchargers Mandaluyong',UCLP:'Underchargers Las Piñas',MMM:'Mastermind Mandaluyong'};
export default function OnlineInventoryPage(){
 const [embedded,setEmbedded]=useState(false);
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
 useEffect(()=>{setEmbedded(new URLSearchParams(window.location.search).get('embedded')==='1');},[]);
 useEffect(()=>{
  let mounted=true;
  getCurrentStaff().then(async identity=>{
   if(!mounted)return;
   if(!identity){window.location.replace('/staff-login-test?next=%2Fonline-inventory');return;}
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
 return <main style={{maxWidth:'100%',margin:0,padding:embedded?'18px 22px':28,fontFamily:'inherit',lineHeight:1.5,color:'#27303f',background:'#fff',minHeight:'100vh'}}>
 <style>{` .online-inventory select,.online-inventory input{border:1px solid #d0d5dd;border-radius:8px;padding:10px 12px;background:white;color:#27303f;max-width:100%;box-sizing:border-box}.online-inventory label{font-size:13px;font-weight:600;display:grid;gap:5px}.online-inventory button{background:#f4c542;border:0;border-radius:8px;padding:9px 15px;font-weight:700;cursor:pointer;color:#242424}.online-inventory button:disabled{opacity:.5;cursor:not-allowed}.online-inventory table{border-collapse:collapse;width:100%;font-size:13px}.online-inventory th{background:#f7f8fa;color:#667085;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.online-inventory td,.online-inventory th{padding:11px 13px;border-bottom:1px solid #e8eaef;text-align:left}.online-inventory h2{font-size:18px;margin:24px 0 10px}.online-inventory .inventory-card{border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin:18px 0;background:#fff}`}</style><div className="online-inventory">
  {!embedded&&<p><a href="/" style={{color:'#8c6900',fontWeight:700,textDecoration:'none'}}>← Back to Cashier Dashboard</a></p>}<h1 style={{fontSize:24,margin:'0 0 4px'}}>Online Inventory</h1>
  <p style={{fontSize:13,color:'#667085',margin:'0 0 12px'}}>Live Supabase inventory · Local Cashier inventory records are not yet synchronized.</p>
  <p role="status">{message}</p>
  {staff&&<><p><strong>{staff.displayName}</strong> · {staff.role} · {staff.branch??'All branches'}</p>
   {!embedded&&<p><a href="/staff-login-test">Staff login</a></p>}
   <label>Branch <select value={branch} onChange={e=>void changeBranch(e.target.value)} disabled={busy}>
    {branches.filter(b=>staff.role==='admin'||b===staff.branch).map(b=><option key={b} value={b}>{branchNames[b]}</option>)}
   </select></label>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'18px 0'}} className="inventory-card"><div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>Products: <strong>{products.length}</strong></div><div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>Zero balance: <strong>{products.filter(p=>Number(p.stock_qty)===0).length}</strong></div><a href="/stock-requests" style={{padding:12,background:'#f2c94c',borderRadius:8,color:'#222',textDecoration:'none'}}>Stock Requests →</a></div>
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
 </div></main>;
}
