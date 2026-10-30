'use client';
import React from 'react';
import {AlertCircle,CheckCircle2,Package,Wrench} from 'lucide-react';
import {FileInput} from '@/components/Ui';
import type {POSLine} from '@/lib/data';
import {costReviewIssues,type POSCostSource} from '@/lib/pos-cogs-review';

type Props={items:POSLine[];onChange?:(id:string,changes:Partial<POSLine>)=>void;readOnly?:boolean};
const php=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
/** Every quotation item is individually reviewed; manual COGS never lives in Transaction Entry. */
export default function POSCostReview({items,onChange,readOnly=false}:Props){
 const issues=costReviewIssues(items);const locked=readOnly||!onChange;
 return <div className="cogs-review-paper">
  <p className="cogs-review-note">Review every item in the quotation. Labor may have no direct cost. For parts, use a documented direct purchase or PB / verified Inventory source. COGS does not change the customer selling price.</p>
  {items.map(item=>{
   const options:POSCostSource[]=item.type==='Service'?['No direct cost','Direct']:['PB / Inventory','Direct'];
   const src=item.costSource;
   const showCost=src==='Direct';
   return <div key={item.id} className="cogs-review-row">
    <div className="cogs-review-header"><strong>{item.type==='Service'?<Wrench size={14} style={{display:'inline',verticalAlign:'middle'}}/>:<Package size={14} style={{display:'inline',verticalAlign:'middle'}}/>} {item.name}</strong><small>{item.qty} × {php(item.price)} · Sale {php(item.lineTotal??item.qty*item.price)}</small></div>
    <div className="cogs-review-fields">
     <label className="field"><span>Cost source *</span><select aria-label={`${item.name} cost source`} disabled={locked} value={src||''} onChange={e=>{
      const costSource=e.target.value as POSCostSource;onChange?.(item.id,{costSource,cost:0,supplier:'',receiptNo:'',proof:undefined});
     }}><option value="">Select source</option>{options.map(v=><option key={v} value={v}>{v==='Direct'?'Direct cost / supplier':v}</option>)}</select></label>
     {showCost&&<label className="field"><span>Cost per unit (₱) *</span><input type="text" inputMode="decimal" aria-label={`${item.name} cost per unit`} disabled={locked} placeholder="0.00" value={Number.isFinite(item.cost)&&item.cost?String(item.cost):''} onChange={e=>{if(/^\d{0,8}(?:\.\d{0,2})?$/.test(e.target.value))onChange?.(item.id,{cost:Number(e.target.value)||0});}}/></label>}
     {showCost&&<label className="field"><span>Supplier / Payee *</span><input aria-label={`${item.name} supplier`} disabled={locked} placeholder="Enter supplier" value={item.supplier||''} onChange={e=>onChange?.(item.id,{supplier:e.target.value})}/></label>}
    </div>
    {showCost&&<div className="cogs-review-fields"><label className="field"><span>Receipt reference (optional)</span><input disabled={locked} aria-label={`${item.name} receipt reference`} value={item.receiptNo||''} onChange={e=>onChange?.(item.id,{receiptNo:e.target.value})}/></label>{!locked&&<FileInput label="Supporting receipt (optional)" value={item.proof} onChange={v=>onChange?.(item.id,{proof:v})}/>}<span className="cogs-review-note">Line COGS: {php(item.qty*item.cost)}</span></div>}
    {src==='PB / Inventory'&&<div className="cogs-review-alert"><AlertCircle size={15} style={{display:'inline',verticalAlign:'middle'}}/> Cost must come from an actual PB purchase or Admin-approved Stock Release, linked to this POS. This step does not invent or post inventory cost.</div>}
    {src==='No direct cost'&&<span className="cogs-review-note">Service reviewed as zero direct cost. No supplier required.</span>}
   </div>;
  })}
  {issues.length>0?<div className="cogs-review-alert" role="status">{issues.map((issue,i)=><div key={i}>• {issue}</div>)}</div>:<p className="receipt-entry-tip"><CheckCircle2 size={16}/> All {items.length} quotation item(s) have a reviewed COGS source.</p>}
 </div>;
}
