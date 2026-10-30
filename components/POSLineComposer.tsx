'use client';
import React,{useId} from 'react';
import {AlertTriangle,Package,Plus,ShieldCheck,Wrench} from 'lucide-react';
import type {InventoryProduct} from '@/lib/data';
import {type POSLineDraft,MAX_POS_LINE_QTY,posLineAmount,posLineError} from '@/lib/pos-line-entry';

const php=(value:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value);
type Props={
 value:POSLineDraft;onChange:(next:POSLineDraft)=>void;onAdd:()=>void;
 inventory:InventoryProduct[];branch:string;
 isEditing?:boolean;onCancelEdit?:()=>void;compact?:boolean;
};
/** Receipt-style quotation entry. Costs and suppliers are edited ONLY during COGS Review. */
export default function POSLineComposer({value,onChange,onAdd,inventory,branch,isEditing=false,onCancelEdit,compact=false}:Props){
 const nameId=useId(),qtyId=useId(),priceId=useId();
 const change=<K extends keyof POSLineDraft>(key:K,v:POSLineDraft[K])=>onChange({...value,[key]:v});
 const entered=value.name.trim().toLowerCase();
 const catalogMatch=value.type==='Part'&&entered?inventory.find(p=>!p.archivedAt&&p.branch===branch&&(p.name.trim().toLowerCase()===entered||p.barcode.trim().toLowerCase()===entered)):undefined;
 const issue=posLineError(value);
 const enabled=!issue&&!catalogMatch;
 return <div className={`receipt-entry${compact?' receipt-entry-compact':''}`}>
  <div className="receipt-entry-caption"><strong>{isEditing?'Editing quotation row':'Add a quotation item'}</strong><span>Customer selling information only · Costs are reviewed in the next stage</span></div>
  <div className="receipt-head"><span>Service / Product</span><span>Qty</span><span>Selling Price</span></div>
  <div className="receipt-input-row">
   <div className="receipt-product-cell"><input id={nameId} aria-label="Service or product name" className="receipt-input" placeholder="Service / product" autoComplete="off" value={value.name} maxLength={140} onChange={e=>change('name',e.target.value)}/><div className="receipt-kind" role="group" aria-label="Item classification"><button type="button" aria-pressed={value.type==='Service'} className={value.type==='Service'?'active':''} onClick={()=>change('type','Service')}><Wrench size={13}/> Service</button><button type="button" aria-pressed={value.type==='Part'} className={value.type==='Part'?'active':''} onClick={()=>change('type','Part')}><Package size={13}/> Part</button></div></div>
   <input id={qtyId} className="receipt-input receipt-qty" type="text" inputMode="numeric" aria-label="Quantity" placeholder="1" value={value.qty} maxLength={String(MAX_POS_LINE_QTY).length} onChange={e=>{if(/^\d{0,4}$/.test(e.target.value))change('qty',e.target.value);}}/>
   <div className="receipt-money"><span aria-hidden="true">₱</span><input id={priceId} className="receipt-input" type="text" inputMode="decimal" aria-label="Selling price per unit" placeholder="0.00" value={value.price} onChange={e=>{if(/^\d{0,8}(?:\.\d{0,2})?$/.test(e.target.value))change('price',e.target.value);}}/></div>
  </div>
  {catalogMatch&&<div className="pos-line-warning" role="alert"><AlertTriangle size={17}/><span><b>{catalogMatch.name}</b> is registered inventory. Create a POS draft and use Request Stock Release with Admin approval instead of manually billing it as a non-inventory part.</span></div>}
  <div className="receipt-entry-bottom"><div className="receipt-line-total"><span>Line total</span><strong aria-live="polite">{php(posLineAmount(value.qty,value.price))}</strong></div><div className="receipt-entry-buttons">{isEditing&&onCancelEdit&&<button type="button" className="button button-secondary" onClick={onCancelEdit}>Cancel edit</button>}<button type="button" className="receipt-add-button" disabled={!enabled} onClick={onAdd} aria-label={isEditing?'Save edited item':'Add quotation item'}><Plus size={28}/><span>{isEditing?'Save row':'Add item'}</span></button></div></div>
  {!issue&&value.type==='Part'&&!catalogMatch&&<p className="receipt-entry-tip"><ShieldCheck size={14}/> Parts purchased by PB or released from Inventory will be verified in COGS Review.</p>}
  {issue&&(value.name.trim()||value.price||value.qty!=='1')&&<p className="pos-line-validation" role="status">{issue}</p>}
 </div>;
}
