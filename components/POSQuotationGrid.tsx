'use client';
import React from 'react';
import {Plus,Trash2,Package,Wrench,AlertCircle} from 'lucide-react';
import type {InventoryProduct} from '@/lib/data';
import {uid,pesos} from '@/lib/data';
import {emptyQuotationRow,quotedAmount,type QuotationRow} from '@/lib/pos-quotation-grid';

type Props={rows:QuotationRow[];onChange:(rows:QuotationRow[])=>void;inventory:InventoryProduct[];branch:string};
/** Directly-editable receipt: Add = another input ROW (not another form below). */
export default function POSQuotationGrid({rows,onChange,inventory,branch}:Props){
 const change=(id:string,patch:Partial<QuotationRow>)=>onChange(rows.map(r=>r.id===id?{...r,...patch}:r));
 const add=()=>onChange([...rows,emptyQuotationRow(uid())]);
 const total=rows.reduce((sum,r)=>sum+quotedAmount(r),0);
 return <div className="receipt-paper receipt-inline-editor">
  <div className="receipt-head"><span>Service / Product</span><span>Qty</span><span>Selling Total</span></div>
  <div className="receipt-inline-list">{rows.map((row,index)=>{
   const duplicate=row.type==='Part'&&row.name.trim()&&inventory.some(p=>!p.archivedAt&&p.branch===branch&&(p.name.trim().toLowerCase()===row.name.trim().toLowerCase()||p.barcode.trim().toLowerCase()===row.name.trim().toLowerCase()));
   return <div key={row.id} className="receipt-inline-block">
    <div className="receipt-inline-row">
     <div className="receipt-product-cell"><input className="receipt-input" aria-label={`Row ${index+1} Service or Product`} placeholder="Service / product" value={row.name} maxLength={140} autoComplete="off" onChange={e=>change(row.id,{name:e.target.value})}/><div className="receipt-kind" role="group" aria-label={`Row ${index+1} classification`}><button type="button" aria-pressed={row.type==='Service'} className={row.type==='Service'?'active':''} onClick={()=>change(row.id,{type:'Service'})}><Wrench size={13}/> Service</button><button type="button" aria-pressed={row.type==='Part'} className={row.type==='Part'?'active':''} onClick={()=>change(row.id,{type:'Part'})}><Package size={13}/> Part</button></div></div>
     <input className="receipt-input receipt-qty" type="text" inputMode="numeric" aria-label={`Row ${index+1} quantity`} placeholder="1" value={row.qty} onChange={e=>{if(/^\d{0,4}$/.test(e.target.value))change(row.id,{qty:e.target.value});}}/>
     <div className="receipt-money"><span aria-hidden="true">₱</span><input className="receipt-input" type="text" inputMode="decimal" aria-label={`Row ${index+1} selling total`} placeholder="0.00" value={row.sellingTotal} onChange={e=>{if(/^\d{0,8}(?:\.\d{0,2})?$/.test(e.target.value))change(row.id,{sellingTotal:e.target.value});}}/></div>
    </div>
    <div className="receipt-inline-row-meta"><span>{index+1}. {row.type}{Number(row.qty)>1&&quotedAmount(row)>0?` · ${pesos(quotedAmount(row)/Number(row.qty))} per unit`:''}</span><button type="button" className="receipt-inline-delete" disabled={rows.length<=1} onClick={()=>onChange(rows.filter(r=>r.id!==row.id))} aria-label={`Remove row ${index+1}`}><Trash2 size={14}/> Remove</button></div>
    {duplicate&&<p className="pos-line-warning"><AlertCircle size={15}/> Registered inventory requires authorized Stock Release. This row cannot be manually billed as ordinary stock.</p>}
   </div>;
  })}</div>
  <button type="button" className="receipt-add-row" onClick={add}><Plus size={23}/> Add row</button>
  <div className="receipt-total"><span>Sale Total · {rows.length} row(s)</span><strong aria-live="polite">{pesos(total)}</strong></div>
 </div>;
}
