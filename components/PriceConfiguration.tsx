'use client';
import React,{useEffect,useState} from 'react';
import {Check,Tag} from 'lucide-react';
import {BRANCH_NAME,needsPriceConfiguration,type BranchId,type Database,type ProductPriceUpdate} from '@/lib/data';

type Entry={unitCost:string};
export default function PriceConfiguration({db,branch,onSave}:{db:Database;branch:BranchId|'ALL';onSave:(updates:ProductPriceUpdate[])=>boolean}){
 const pending=db.inventory.filter(p=>!p.archivedAt&&needsPriceConfiguration(p)&&(branch==='ALL'||p.branch===branch));
 const [costs,setCosts]=useState<Record<string,Entry>>({});
 const [message,setMessage]=useState('After Submit All, enter actual purchase/unit cost (COGS) for each product. Selling price is set per POS quotation.');
 useEffect(()=>{setCosts(old=>Object.fromEntries(pending.map(p=>[p.id,old[p.id]||{unitCost:''}])));},[db.inventory,branch]);
 const update=(id:string,value:string)=>setCosts(old=>({...old,[id]:{unitCost:value}}));
 const valid=(id:string)=>{
  const v=costs[id];return !!v&&v.unitCost.trim()!==''&&Number.isFinite(Number(v.unitCost))&&Number(v.unitCost)>0;
 };
 const save=(ids:string[])=>{
  if(!ids.length)return;
  if(ids.some(id=>!valid(id))){setMessage('Enter a valid positive Unit Cost for every selected item.');return;}
  const products=pending.filter(p=>ids.includes(p.id));
  if(!window.confirm(`Save unit costs for ${products.length} product(s)?\n\nNew product registration starts with zero units. Physical receipts require the separate Stock In review process. Older legacy pending initial quantities may still be posted by the original cost-configuration behavior.`))return;
  const success=onSave(products.map(p=>({productId:p.id,unitCost:Number(costs[p.id].unitCost)})));
  setMessage(success?'Unit costs saved. New product quantities stay at zero until independently verified receiving.':'Could not save costs. Check the error notification.');
 };
 return <section className="price-configuration" aria-label="Admin Cost Configuration">
  <div className="panel-head"><div><h3><Tag size={17}/> Cost Configuration (COGS)</h3><span>Only Admin · Configure actual unit cost after Submit All; no fixed selling price</span></div><strong>{pending.length} need costing</strong></div>
  <div className="price-configuration-body">
   <p className="form-note" aria-live="polite">{message}</p>
   {!pending.length?<div className="inventory-empty-state"><strong>No products need cost configuration.</strong><p>Scan products, enter their names, and click Submit All to create Pending Stock.</p></div>:<>
    {pending.map(p=><div className="price-product-row" key={p.id}>
     <div className="price-product-name"><strong>{p.name}</strong><small>{p.barcode} · {BRANCH_NAME(p.branch)} · {p.pendingInitialQty||0} legacy pending units · {p.category}</small></div>
     <label className="field"><span>Unit Cost (₱)</span><input type="number" min="0.01" step="0.01" placeholder="0.00" value={costs[p.id]?.unitCost||''} onChange={e=>update(p.id,e.target.value)}/></label>
     <button type="button" className="button button-secondary" disabled={!valid(p.id)} onClick={()=>save([p.id])}><Check size={15}/> Save Unit Cost</button>
    </div>)}
    <div className="price-actions"><button type="button" className="button button-primary" disabled={!pending.every(p=>valid(p.id))} onClick={()=>save(pending.map(p=>p.id))}><Check size={16}/> Save All Costs ({pending.length})</button></div>
   </>}
  </div>
 </section>;
}
