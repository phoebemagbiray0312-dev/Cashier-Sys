'use client';

import {useEffect,useState} from 'react';
import {getCurrentStaff,type StaffIdentity} from '@/lib/supabase-auth';
import {getSupabaseClient} from '@/lib/supabase-client';
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
 const [poId,setPoId]=useState('');
 const [purchaseOrders,setPurchaseOrders]=useState<{id:string;po_number:string;vehicle_plate:string|null;vehicle_name:string|null}[]>([]);
 const [message,setMessage]=useState('Checking Supabase access...');
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [showHistory,setShowHistory]=useState(false);
 const [historyFrom,setHistoryFrom]=useState('');
 const [historyTo,setHistoryTo]=useState('');
 const [historyType,setHistoryType]=useState<'all'|'issue'>('all');
 const [historyResults,setHistoryResults]=useState<StockMovement[]>([]);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [stockFilter,setStockFilter]=useState<'all'|'zero'>('all');
 const [showMovement,setShowMovement]=useState(false);
 const [productEditor,setProductEditor]=useState<OnlineProduct|null|undefined>(undefined);
 const [editSku,setEditSku]=useState('');
 const [editName,setEditName]=useState('');
 const [editPrice,setEditPrice]=useState('0');
 async function refresh(branchId:string){
  const [p,h]=await Promise.all([listOnlineProducts(branchId),listStockMovements(branchId)]);
  setProducts(p);setHistory(h);setPage(1);
  const {data:poData,error:poError}=await getSupabaseClient().from('cms_purchase_orders').select('id,po_number,vehicle_plate,vehicle_name').eq('branch_id',branchId).order('created_at',{ascending:false}).limit(200);
  setPurchaseOrders(poError?[]:(poData??[]));setPoId('');
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
   await recordStockMovement({productId,kind,quantity:n,reason,destinationBranch:kind==='transfer'?destination:undefined,poId:kind==='issue'?(poId||undefined):undefined});
   await refresh(branch);setReason('');setShowMovement(false);setMessage('Stock movement saved and logged.');
  }catch(err){setMessage(err instanceof Error?err.message:'Stock update failed.');}
  finally{setBusy(false);}
 }
 function openProductEditor(product?:OnlineProduct){if(staff?.role!=='admin')return;setProductEditor(product??null);setEditSku(product?.sku??'');setEditName(product?.name??'');setEditPrice(String(product?.unit_price??0));}
 async function saveProduct(e:React.FormEvent){
  e.preventDefault();if(staff?.role!=='admin'||busy||productEditor===undefined)return;
  const sku=editSku.trim().toUpperCase(),name=editName.trim(),price=Number(editPrice);
  if(!sku||sku.length>80||!name||name.length>200||!Number.isFinite(price)||price<0||price>100000000){setMessage('Enter a valid SKU, product name and non-negative price.');return;}
  setBusy(true);
  try{
   const supabase=getSupabaseClient();
   if(productEditor){
    const {error}=await supabase.from('cms_products').update({sku,name,unit_price:price}).eq('id',productEditor.id).eq('branch_id',branch);
    if(error)throw error;
   }else{
    const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error('Please sign in again.');
    const {error}=await supabase.from('cms_products').insert({branch_id:branch,sku,name,unit_price:price,stock_qty:0,created_by:user.id});
    if(error)throw error;
   }
   await refresh(branch);setProductEditor(undefined);setMessage('Product saved successfully.');
  }catch(err){setMessage(err instanceof Error?err.message:'Could not save product.');}
  finally{setBusy(false);}
 }
 const filtered=products.filter(p=>(stockFilter==='all'||Number(p.stock_qty)===0)&&(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase().trim()));
 const pageCount=Math.max(1,Math.ceil(filtered.length/10));
 const visible=filtered.slice((Math.min(page,pageCount)-1)*10,Math.min(page,pageCount)*10);
 async function loadFilteredHistory(from=historyFrom,to=historyTo,type=historyType){if(from&&to&&from>to){setMessage('Start date must be before end date.');return;}setHistoryLoading(true);try{setHistoryResults(await listStockMovements(branch,from,to,type));}catch{setMessage('Unable to load filtered history.');}finally{setHistoryLoading(false);}}
 function openHistory(){setHistoryFrom('');setHistoryTo('');setHistoryType('all');setHistoryResults(history);setShowHistory(true);}
 function openStock(product:OnlineProduct){setProductId(product.id);setKind('receive');setPoId('');setShowMovement(true);}
 const allowedKinds:StockOperation[]=staff?.role==='admin'?['receive','issue','adjust','transfer']:staff?.role==='pb'?['receive','issue']:['issue'];
 return <main style={{maxWidth:'100%',margin:0,padding:embedded?'12px 16px':24,fontFamily:'inherit',lineHeight:1.5,color:'#27303f',background:'#fff',minHeight:embedded?'auto':'100vh'}}>
 <style>{` .online-inventory select,.online-inventory input{border:1px solid #d0d5dd;border-radius:8px;padding:10px 12px;background:white;color:#27303f;max-width:100%;box-sizing:border-box}.online-inventory label{font-size:13px;font-weight:600;display:grid;gap:5px}.online-inventory button{background:#f4c542;border:0;border-radius:8px;padding:9px 15px;font-weight:700;cursor:pointer;color:#242424}.online-inventory button:disabled{opacity:.5;cursor:not-allowed}.online-inventory table{border-collapse:collapse;width:100%;font-size:13px}.online-inventory th{background:#f7f8fa;color:#667085;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.online-inventory td,.online-inventory th{padding:11px 13px;border-bottom:1px solid #e8eaef;text-align:left}.online-inventory h2{font-size:18px;margin:24px 0 10px} .online-inventory .inventory-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0;background:#fff}.online-inventory .inventory-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.online-inventory .inventory-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.online-inventory .inventory-modal{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:white;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.2)}.online-inventory .inventory-secondary{background:#f3f4f6;border:1px solid #e5e7eb}.online-inventory .inventory-toolbar input{flex:1;min-width:220px}.online-inventory button.inventory-summary{background:#fff;border:1px solid #e5e7eb;text-align:left;font-weight:500}.online-inventory button.inventory-summary[aria-pressed='true']{border-color:#e4b32c;background:#fff9e8}.online-inventory button.inventory-summary:hover{border-color:#e4b32c}.online-inventory button.inventory-icon-action{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;background:#fff;border:1px solid #d9dee7;border-radius:9px;color:#475467;transition:background .15s,border-color .15s}.online-inventory button.inventory-icon-action:hover{background:#fff7df;border-color:#e4b32c;color:#8a6200}.online-inventory button.inventory-icon-action:focus-visible{outline:3px solid #e4b32c;outline-offset:2px}.online-inventory .inventory-table-wrap{overflow:auto;max-height:470px;border:1px solid #e5e7eb;border-radius:10px}.online-inventory .inventory-table-wrap thead{position:sticky;top:0;z-index:1}.online-inventory .inventory-history-filters{display:flex;align-items:end;flex-wrap:wrap;gap:10px;margin-top:18px}.online-inventory .inventory-history-filters label{min-width:140px;flex:1}.online-inventory .inventory-history-filters input,.online-inventory .inventory-history-filters select{width:100%;min-height:40px}.online-inventory .inventory-history-filters button{height:40px}.online-inventory .inventory-history-filters .inventory-history-clear{background:#f3f4f6;border:1px solid #e5e7eb}.online-inventory .inventory-modal.inventory-stock-dialog{width:min(520px,100%);padding:26px 28px;border-radius:18px;box-sizing:border-box}.online-inventory .inventory-stock-dialog .stock-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.online-inventory .inventory-stock-dialog .stock-dialog-header h2{margin:0;font-size:20px;line-height:1.35;font-weight:700}.online-inventory .inventory-stock-dialog .stock-dialog-note{font-size:12px;line-height:1.6;color:#667085;margin:7px 0 0;max-width:420px}.online-inventory .inventory-stock-dialog .stock-dialog-close{flex:0 0 34px;width:34px;height:34px;padding:0;display:grid;place-items:center;background:#f3f4f6;border:1px solid #e5e7eb;color:#475467;font-size:16px;border-radius:9px}.online-inventory .inventory-stock-dialog .stock-dialog-form{display:grid;gap:16px}.online-inventory .inventory-stock-dialog .stock-dialog-form label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:650;color:#344054}.online-inventory .inventory-stock-dialog .stock-dialog-form input,.online-inventory .inventory-stock-dialog .stock-dialog-form select{width:100%;height:42px;min-width:0;font-size:13px;font-weight:500}.online-inventory .inventory-stock-dialog .stock-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px;padding-top:17px;border-top:1px solid #eef0f3}.online-inventory .inventory-stock-dialog .stock-dialog-actions button{min-height:40px;font-size:13px;padding:9px 14px}.online-inventory .inventory-stock-dialog .stock-dialog-actions .stock-dialog-cancel{background:#fff;border:1px solid #d0d5dd;color:#344054}@media(max-width:650px){.online-inventory .inventory-modal.inventory-stock-dialog{padding:20px}.online-inventory .inventory-stock-dialog .stock-dialog-actions{flex-wrap:wrap}.online-inventory .inventory-stock-dialog .stock-dialog-actions button{flex:1}}@media(max-width:650px){.online-inventory .inventory-toolbar>*{width:100%}.online-inventory .inventory-modal{padding:16px}}`}</style><div className="online-inventory">
  {!embedded&&<p><a href="/" style={{color:'#8c6900',fontWeight:700,textDecoration:'none'}}>← Back to Cashier Dashboard</a></p>}{!embedded&&<h1 style={{fontSize:24,margin:'0 0 4px'}}>Inventory</h1>}

  {message&&!message.startsWith("Connected.")&&!message.startsWith("Inventory loaded.")&&<p role="status" style={{fontSize:13,color:"#7a5700",margin:"4px 0"}}>{message}</p>}
  {staff&&<>
   {!embedded&&<p><a href="/staff-login-test">Staff login</a></p>}
   <div className="inventory-toolbar"><label style={{display:'flex',alignItems:'center',gap:8}}>Branch <select value={branch} onChange={e=>void changeBranch(e.target.value)} disabled={busy}>
    {branches.filter(b=>staff.role==='admin'||b===staff.branch).map(b=><option key={b} value={b}>{branchNames[b]}</option>)}
   </select></label>{staff.role==='admin'&&<button type="button" onClick={()=>openProductEditor()}>+ Add Product</button>}<button type="button" onClick={()=>setShowMovement(true)} disabled={!products.length}>+ Stock Movement</button><a href="/stock-requests?embedded=1" style={{padding:'9px 14px',background:'#fff4c5',borderRadius:8,color:'#7a5700',fontWeight:700,textDecoration:'none'}}>Requests →</a></div>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'8px 0 12px'}}><button type="button" aria-pressed={stockFilter==='all'} onClick={()=>{setStockFilter('all');setPage(1)}} className="inventory-card inventory-summary">Products <strong>{products.length}</strong></button><button type="button" aria-pressed={stockFilter==='zero'} onClick={()=>{setStockFilter('zero');setPage(1)}} className="inventory-card inventory-summary">Zero balance <strong>{products.filter(p=>Number(p.stock_qty)===0).length}</strong></button><button type="button" onClick={openHistory} className="inventory-card inventory-summary">Movements <strong>{history.length}</strong></button></div>
   <div className="inventory-toolbar"><input aria-label="Search products" placeholder="Search products by name or SKU" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div>
   <div className="inventory-table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Available</th><th>Price</th><th>Action</th></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.stock_qty}</td><td>{Number(p.unit_price)===0?'Not set':'₱'+Number(p.unit_price).toFixed(2)}</td><td><button type="button" onClick={()=>openStock(p)} aria-label={'Update stock for '+p.name} title="Stock In / Out" className="inventory-icon-action"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9h8M12 7v4M8 15h8"/></svg></button>{staff.role==='admin'&&<button type="button" onClick={()=>openProductEditor(p)} aria-label={'Edit product '+p.name} title="Edit product details" className="inventory-icon-action" style={{marginLeft:6}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button>}</td></tr>)}</tbody></table></div>
   <div className="inventory-toolbar"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span style={{fontSize:13}}>Page {Math.min(page,pageCount)} of {pageCount}</span><button type="button" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>Next</button></div>
   {products.length===0&&<p>No online products for this branch yet. An Admin must register a product before stock movements can be recorded.</p>}
   {productEditor!==undefined&&staff.role==='admin'&&<div className="inventory-modal-backdrop" role="presentation" onClick={()=>{if(!busy)setProductEditor(undefined)}}><div className="inventory-modal inventory-stock-dialog" role="dialog" aria-modal="true" aria-label={productEditor?'Edit Product':'Add Product'} onClick={e=>e.stopPropagation()}><div className="stock-dialog-header"><div><h2>{productEditor?'Edit Product':'Add Product'}</h2><p className="stock-dialog-note">{branchNames[branch]} · Stock quantities are managed separately through Stock Movement.</p></div><button type="button" className="stock-dialog-close" onClick={()=>setProductEditor(undefined)} disabled={busy} aria-label="Close">✕</button></div><form className="stock-dialog-form" onSubmit={e=>void saveProduct(e)}><label>SKU<input required maxLength={80} value={editSku} onChange={e=>setEditSku(e.target.value)} disabled={busy}/></label><label>Product name<input required maxLength={200} value={editName} onChange={e=>setEditName(e.target.value)} disabled={busy}/></label><label>Unit price (₱)<input type="number" required min="0" max="100000000" step="0.01" value={editPrice} onChange={e=>setEditPrice(e.target.value)} disabled={busy}/></label><div className="stock-dialog-actions"><button type="button" className="stock-dialog-cancel" onClick={()=>setProductEditor(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy?'Saving...':'Save Product'}</button></div></form></div></div>}
   {showMovement&&<div className="inventory-modal-backdrop" role="presentation" onClick={()=>{if(!busy)setShowMovement(false)}}><div className="inventory-modal inventory-stock-dialog" role="dialog" aria-modal="true" aria-label="Stock In or Out" onClick={e=>e.stopPropagation()}>
   <div className="stock-dialog-header"><div><h2>Stock In / Stock Out</h2><p className="stock-dialog-note">Record stock received or issued. For opening balances, use reason &quot;Verified opening stock count&quot;. Use Stock Requests for branch transfers.</p></div><button className="stock-dialog-close" type="button" onClick={()=>setShowMovement(false)} disabled={busy} aria-label="Close">✕</button></div>
   
   <form className="stock-dialog-form" onSubmit={e=>void submit(e)}>
    <label>Product <select value={productId} onChange={e=>setProductId(e.target.value)} required disabled={busy}>{products.map(p=><option value={p.id} key={p.id}>{p.sku} — {p.name}</option>)}</select></label>
    <label>Action <select value={kind} onChange={e=>setKind(e.target.value as StockOperation)} disabled={busy}>{allowedKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
    {kind==='issue'&&<label>Vehicle / PO (optional)<select value={poId} onChange={e=>setPoId(e.target.value)} disabled={busy}><option value="">No PO linked</option>{purchaseOrders.map(po=><option key={po.id} value={po.id}>{po.po_number} — {po.vehicle_plate||po.vehicle_name||'Vehicle not specified'}</option>)}</select>{purchaseOrders.length===0&&<span style={{fontSize:11,fontWeight:400,color:'#667085'}}>No purchase orders recorded for this branch yet.</span>}</label>}
    <label>Quantity {kind==='adjust'?'(positive or negative)':''}<input type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} required disabled={busy}/></label>
    {kind==='transfer'&&<label>Destination branch <select value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy}>{branches.filter(b=>b!==branch).map(b=><option key={b} value={b}>{b}</option>)}</select></label>}
    <label>Reason <input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={500} required placeholder="Delivery reference / issuance reason" disabled={busy}/></label>
    <div className="stock-dialog-actions"><button className="stock-dialog-cancel" type="button" onClick={()=>setShowMovement(false)} disabled={busy}>Cancel</button><button type="submit" disabled={busy||!productId}>{busy?'Saving...':'Confirm stock movement'}</button></div>
   </form></div></div>}
   {showHistory&&<div className="inventory-modal-backdrop" role="presentation" onClick={()=>setShowHistory(false)}><div className="inventory-modal" role="dialog" aria-modal="true" aria-label="Stock movement history" onClick={e=>e.stopPropagation()} style={{width:'min(1040px,100%)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><h2 style={{margin:0}}>Stock Movement History</h2><p style={{fontSize:12,color:'#667085',margin:'4px 0 0'}}>{branchNames[branch]}</p></div><button type="button" onClick={()=>setShowHistory(false)} aria-label="Close history">✕</button></div>
    <form onSubmit={e=>{e.preventDefault();void loadFilteredHistory()}} className="inventory-history-filters">
      <label>From<input type="date" value={historyFrom} max={historyTo||undefined} onChange={e=>setHistoryFrom(e.target.value)}/></label>
      <label>To<input type="date" value={historyTo} min={historyFrom||undefined} onChange={e=>setHistoryTo(e.target.value)}/></label>
      <label>Movement<select value={historyType} onChange={e=>setHistoryType(e.target.value as 'all'|'issue')}><option value="all">All movements</option><option value="issue">Stock Out only</option></select></label>
      <button type="submit" disabled={historyLoading}>{historyLoading?'Loading...':'Search'}</button>
      <button type="button" className="inventory-history-clear" disabled={historyLoading} onClick={()=>{setHistoryFrom('');setHistoryTo('');setHistoryType('all');void loadFilteredHistory('','','all');}}>Clear</button>
    </form>
    <p style={{fontSize:12,color:'#667085',margin:'8px 0'}}>{historyResults.length} records {historyResults.length>=1000?'(showing latest 1,000)':''}</p>
    <div className="inventory-table-wrap" style={{maxHeight:'min(55vh,500px)'}}><table><thead><tr><th>Date</th><th>Product</th><th>PO / Vehicle</th><th>Type</th><th>Quantity</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>{historyResults.map(h=><tr key={h.id}><td style={{whiteSpace:'nowrap'}}>{new Date(h.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td><td>{products.find(p=>p.id===h.product_id)?.name??h.product_id}</td><td>{h.po_id?(()=>{const po=purchaseOrders.find(p=>p.id===h.po_id);return po?po.po_number+' · '+(po.vehicle_plate||po.vehicle_name||'Vehicle not specified'):'Linked PO'})():'—'}</td><td>{h.movement_type}</td><td>{h.quantity_delta}</td><td>{h.quantity_before}</td><td>{h.quantity_after}</td><td>{h.reason}</td></tr>)}</tbody></table></div>{historyResults.length===0&&<p>No movements found for the selected filters.</p>}
   </div></div>}
  </>}
 </div></main>;
}
