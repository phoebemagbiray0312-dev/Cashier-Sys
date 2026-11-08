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
 const [stockFilter,setStockFilter]=useState<'all'|'zero'>('all');
 const [showMovement,setShowMovement]=useState(false);
 async function refresh(branchId:string){
  const [p,h]=await Promise.all([listOnlineProducts(branchId),listStockMovements(branchId)]);
  setProducts(p);setHistory(h);setPage(1);
  setProductId(old=>p.some(x=>x.id===old)?old:(p[0]?.id??''));
 }
 useEffect(()=>{const isEmbedded=new URLSearchParams(window.location.search).get('embedded')==='1';setEmbedded(isEmbedded);if(!isEmbedded)window.location.replace('/?view=inventory');},[]);
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
   await refresh(branch);setReason('');setShowMovement(false);setMessage('Stock movement saved and logged.');
  }catch(err){setMessage(err instanceof Error?err.message:'Stock update failed.');}
  finally{setBusy(false);}
 }
 const filtered=products.filter(p=>(stockFilter==='all'||Number(p.stock_qty)===0)&&(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase().trim()));
 const pageCount=Math.max(1,Math.ceil(filtered.length/10));
 const visible=filtered.slice((Math.min(page,pageCount)-1)*10,Math.min(page,pageCount)*10);
 function openStock(product:OnlineProduct){setProductId(product.id);setKind('receive');setShowMovement(true);}
 const allowedKinds:StockOperation[]=staff?.role==='admin'?['receive','issue','adjust','transfer']:staff?.role==='pb'?['receive','issue']:['issue'];
 return <main style={{maxWidth:'100%',margin:0,padding:embedded?'12px 16px':24,fontFamily:'inherit',lineHeight:1.5,color:'#27303f',background:'#fff',minHeight:embedded?'auto':'100vh'}}>
 <style>{` .online-inventory select,.online-inventory input{border:1px solid #d0d5dd;border-radius:8px;padding:10px 12px;background:white;color:#27303f;max-width:100%;box-sizing:border-box}.online-inventory label{font-size:13px;font-weight:600;display:grid;gap:5px}.online-inventory button{background:#f4c542;border:0;border-radius:8px;padding:9px 15px;font-weight:700;cursor:pointer;color:#242424}.online-inventory button:disabled{opacity:.5;cursor:not-allowed}.online-inventory table{border-collapse:collapse;width:100%;font-size:13px}.online-inventory th{background:#f7f8fa;color:#667085;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.online-inventory td,.online-inventory th{padding:11px 13px;border-bottom:1px solid #e8eaef;text-align:left}.online-inventory h2{font-size:18px;margin:24px 0 10px} .online-inventory .inventory-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0;background:#fff}.online-inventory .inventory-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.online-inventory .inventory-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.online-inventory .inventory-modal{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:white;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.2)}.online-inventory .inventory-secondary{background:#f3f4f6;border:1px solid #e5e7eb}.online-inventory .inventory-toolbar input{flex:1;min-width:220px}.online-inventory button.inventory-summary{background:#fff;border:1px solid #e5e7eb;text-align:left;font-weight:500}.online-inventory button.inventory-summary[aria-pressed='true']{border-color:#e4b32c;background:#fff9e8}.online-inventory button.inventory-summary:hover{border-color:#e4b32c}.online-inventory button.inventory-icon-action{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;background:#fff;border:1px solid #d9dee7;border-radius:9px;color:#475467;transition:background .15s,border-color .15s}.online-inventory button.inventory-icon-action:hover{background:#fff7df;border-color:#e4b32c;color:#8a6200}.online-inventory button.inventory-icon-action:focus-visible{outline:3px solid #e4b32c;outline-offset:2px}.online-inventory .inventory-table-wrap{overflow:auto;max-height:470px;border:1px solid #e5e7eb;border-radius:10px}.online-inventory .inventory-table-wrap thead{position:sticky;top:0;z-index:1}@media(max-width:650px){.online-inventory .inventory-toolbar>*{width:100%}.online-inventory .inventory-modal{padding:16px}}`}</style><div className="online-inventory">
  {!embedded&&<p><a href="/" style={{color:'#8c6900',fontWeight:700,textDecoration:'none'}}>← Back to Cashier Dashboard</a></p>}{!embedded&&<h1 style={{fontSize:24,margin:'0 0 4px'}}>Inventory</h1>}

  {message&&!message.startsWith("Connected.")&&!message.startsWith("Inventory loaded.")&&<p role="status" style={{fontSize:13,color:"#7a5700",margin:"4px 0"}}>{message}</p>}
  {staff&&<>
   {!embedded&&<p><a href="/staff-login-test">Staff login</a></p>}
   <div className="inventory-toolbar"><label style={{display:'flex',alignItems:'center',gap:8}}>Branch <select value={branch} onChange={e=>void changeBranch(e.target.value)} disabled={busy}>
    {branches.filter(b=>staff.role==='admin'||b===staff.branch).map(b=><option key={b} value={b}>{branchNames[b]}</option>)}
   </select></label><button type="button" onClick={()=>setShowMovement(true)} disabled={!products.length}>+ Stock Movement</button><a href="/stock-requests" style={{padding:'9px 14px',background:'#fff4c5',borderRadius:8,color:'#7a5700',fontWeight:700,textDecoration:'none'}}>Requests →</a></div>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'8px 0 12px'}}><button type="button" aria-pressed={stockFilter==='all'} onClick={()=>{setStockFilter('all');setPage(1)}} className="inventory-card inventory-summary">Products <strong>{products.length}</strong></button><button type="button" aria-pressed={stockFilter==='zero'} onClick={()=>{setStockFilter('zero');setPage(1)}} className="inventory-card inventory-summary">Zero balance <strong>{products.filter(p=>Number(p.stock_qty)===0).length}</strong></button><button type="button" onClick={()=>setShowHistory(true)} className="inventory-card inventory-summary">Movements <strong>{history.length}</strong></button></div>
   <div className="inventory-toolbar"><input aria-label="Search products" placeholder="Search products by name or SKU" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div>
   <div className="inventory-table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Available</th><th>Price</th><th>Action</th></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.stock_qty}</td><td>{Number(p.unit_price)===0?'Not set':'₱'+Number(p.unit_price).toFixed(2)}</td><td><button type="button" onClick={()=>openStock(p)} aria-label={'Update stock for '+p.name} title="Stock In / Out" className="inventory-icon-action"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9h8M12 7v4M8 15h8"/></svg></button></td></tr>)}</tbody></table></div>
   <div className="inventory-toolbar"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span style={{fontSize:13}}>Page {Math.min(page,pageCount)} of {pageCount}</span><button type="button" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>Next</button></div>
   {products.length===0&&<p>No online products for this branch yet. An Admin must register a product before stock movements can be recorded.</p>}
   {showMovement&&<div className="inventory-modal-backdrop" role="presentation" onClick={()=>{if(!busy)setShowMovement(false)}}><div className="inventory-modal" role="dialog" aria-modal="true" aria-label="Stock In or Out" onClick={e=>e.stopPropagation()}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><h2 style={{margin:'0 0 8px'}}>Stock In / Stock Out</h2><button type="button" onClick={()=>setShowMovement(false)} disabled={busy} aria-label="Close">✕</button></div>
   <p style={{fontSize:12,color:'#667085'}}>For verified opening stock, use Receive with reason "Verified opening stock count". Transfers between branches should use Stock Requests.</p>
   <form onSubmit={e=>void submit(e)} style={{display:'grid',gap:12}}>
    <label>Product <select value={productId} onChange={e=>setProductId(e.target.value)} required disabled={busy}>{products.map(p=><option value={p.id} key={p.id}>{p.sku} — {p.name}</option>)}</select></label>
    <label>Action <select value={kind} onChange={e=>setKind(e.target.value as StockOperation)} disabled={busy}>{allowedKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
    <label>Quantity {kind==='adjust'?'(positive or negative)':''}<input type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} required disabled={busy}/></label>
    {kind==='transfer'&&<label>Destination branch <select value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy}>{branches.filter(b=>b!==branch).map(b=><option key={b} value={b}>{b}</option>)}</select></label>}
    <label>Reason <input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={500} required placeholder="Delivery reference / issuance reason" disabled={busy}/></label>
    <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" onClick={()=>setShowMovement(false)} disabled={busy}>Cancel</button><button type="submit" disabled={busy||!productId}>{busy?'Saving...':'Confirm stock movement'}</button></div>
   </form></div></div>}
   {showHistory&&<div className="inventory-modal-backdrop" role="presentation" onClick={()=>setShowHistory(false)}><div className="inventory-modal" role="dialog" aria-modal="true" aria-label="Stock movement history" onClick={e=>e.stopPropagation()} style={{width:'min(960px,100%)'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><h2 style={{margin:0}}>Stock Movement History</h2><button type="button" onClick={()=>setShowHistory(false)} aria-label="Close history">✕</button></div><p style={{fontSize:13,color:'#667085'}}>{branchNames[branch]} · {history.length} movements</p><div className="inventory-table-wrap" style={{maxHeight:'min(60vh,520px)'}}><table><thead><tr><th>Date</th><th>Action</th><th>Change</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('en-PH')}</td><td>{h.movement_type}</td><td>{h.quantity_delta}</td><td>{h.quantity_before}</td><td>{h.quantity_after}</td><td>{h.reason}</td></tr>)}</tbody></table></div>{history.length===0&&<p>No stock movements yet.</p>}</div></div>}
  </>}
 </div></main>;
}
