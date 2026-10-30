'use client';
import React,{useState} from 'react';
import {Camera,CheckCircle2,ClipboardCheck,ScanBarcode,ShieldAlert,X} from 'lucide-react';
import BarcodeCamera from './BarcodeCamera';
import {stockAvailable,type Database,type StockReceipt,type StockIssueRequest} from '@/lib/data';

type Props={db:Database;receipt?:StockReceipt;issue?:StockIssueRequest;onClose:()=>void;onDecision:(approved:boolean,counts:Record<string,number>,notes:string)=>boolean};
const clean=(s:string)=>s.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
export default function InventoryReview({db,receipt,issue,onClose,onDecision}:Props){
 const [scan,setScan]=useState('');const [rescanned,setRescanned]=useState<string[]>([]);const [camera,setCamera]=useState(false);
 const [counts,setCounts]=useState<Record<string,string>>({});const [serials,setSerials]=useState<Record<string,string>>({});
 const [notes,setNotes]=useState('');const [checked,setChecked]=useState(false);const [message,setMessage]=useState('');
 const lines=receipt?.lines||issue?.lines||[];const isReceipt=!!receipt;
 const handleScan=(v:string)=>{
  const product=db.inventory.find(p=>lines.some(l=>l.productId===p.id)&&clean(p.barcode)===clean(v));
  setScan('');
  if(!product){setMessage('Barcode is not part of this submitted batch. Check the physical item and request.');return;}
  setRescanned(old=>old.includes(product.id)?old:[...old,product.id]);setMessage(`${product.name} independently rescanned. Enter actual counted quantity.`);
 };
 const mismatch=lines.some(l=>counts[l.productId]===undefined||counts[l.productId]===''||!Number.isInteger(Number(counts[l.productId]))||Number(counts[l.productId])!==l.qty);
 const serialMismatch=lines.some(l=>{const p=db.inventory.find(x=>x.id===l.productId);if(p?.trackingMode!=='serialized')return false;const codes=(serials[l.productId]||'').split(/[\s,;]+/).map(clean).filter(Boolean);return codes.length!==l.qty||codes.sort().join(',')!==(l.unitCodes||[]).map(clean).sort().join(',');});
 const approve=()=>{
  if(rescanned.length!==lines.length){setMessage('Independently scan EVERY listed product barcode first.');return;}
  if(mismatch){setMessage(isReceipt?'Count differs from the submitted quantity. Reject this receipt and request a corrected one; the original record is retained.':'The counted release quantity must match the request exactly. Reject on any discrepancy.');return;}
  if(serialMismatch){setMessage('Every serialized unit code must match the requested codes. Reject any discrepancy.');return;}
  if(!checked){setMessage(isReceipt?'Confirm you independently checked delivery proof and actual physical goods.':'Confirm that the job order and physical items were checked BEFORE releasing anything.');return;}
  if(notes.trim().length<10){setMessage('Write at least 10 characters of verification findings.');return;}
  if(onDecision(true,Object.fromEntries(lines.map(l=>[l.productId,Number(counts[l.productId])])),notes))onClose();
 };
 const reject=()=>{if(notes.trim().length<10){setMessage('Explain the rejection / discrepancy (at least 10 characters).');return;}if(onDecision(false,{},notes))onClose();};
 const pos=issue?db.pos.find(p=>p.id===issue.posId):undefined;
 return <div className="inventory-review" role="region" aria-label={isReceipt?'Independent stock receiving verification':'Stock release authorization'}>
  <div className="scan-batch-head"><div><h3><ClipboardCheck size={18}/> {isReceipt?'Independent Stock In Count':'Stock Release Authorization'}</h3><p>{isReceipt?`${receipt!.branch} · Delivery ${receipt!.reference}`:`${issue!.branch} · ${pos?.no||'Missing POS'} · ${pos?.plate||''}`}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close review"><X size={18}/></button></div>
  <div className="inventory-review-callout"><ShieldAlert size={18}/><span>{isReceipt?'Do NOT credit inventory based only on the submitted receipt. Physically recount every item, rescan the barcode, and compare with supplier evidence.':`Do NOT release stock until authorized. Check the actual vehicle, customer/job order and each requested unit. ${pos?.client||''}`}</span></div>
  {isReceipt?<p className="form-note">Supporting evidence: {receipt?.proof?<a href={receipt.proof.data} target="_blank" download={receipt.proof.name} rel="noreferrer">View {receipt.proof.name}</a>:'MISSING RECEIPT — reject'} · Prepared by {db.users.find(u=>u.id===receipt!.createdBy)?.name||receipt!.createdBy}</p>:<p className="form-note"><strong>Reason:</strong> {issue?.reason} · Requested by {db.users.find(u=>u.id===issue!.createdBy)?.name||issue!.createdBy}</p>}
  <div className="scan-batch-controls"><label className="field"><span>Independently rescan each product barcode</span><input value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleScan(scan)}}} autoComplete="off" placeholder="Scan physical product, press Enter"/></label><button type="button" className="button button-secondary" onClick={()=>handleScan(scan)}><ScanBarcode size={15}/> Check Barcode</button><button type="button" className="button button-secondary" onClick={()=>setCamera(v=>!v)}><Camera size={15}/> Camera</button></div>
  {camera&&<BarcodeCamera continuous onScan={handleScan} onClose={()=>setCamera(false)}/>}
  <div className="inventory-review-list">{lines.map(line=>{const p=db.inventory.find(v=>v.id===line.productId);return <div className="inventory-review-line" key={line.productId}><div><strong>{p?.name||'Unknown product'}</strong><small>{p?.barcode} · Requested: {line.qty} {p?.unit||'unit(s)'}{!isReceipt&&p?` · In inventory: ${stockAvailable(db,p)}`:''}</small><span className={rescanned.includes(line.productId)?'inventory-check-ok':'inventory-check-pending'}>{rescanned.includes(line.productId)?'Barcode rescanned':'Barcode scan required'}</span></div><label className="field"><span>Independently counted *</span><input type="number" min="0" step="1" value={counts[line.productId]??''} onChange={e=>setCounts(v=>({...v,[line.productId]:e.target.value}))} placeholder="Actual units"/></label>{p?.trackingMode==='serialized'&&<label className="field"><span>Rescan / enter EACH unique unit code *</span><textarea rows={2} value={serials[line.productId]||''} onChange={e=>setSerials(v=>({...v,[line.productId]:e.target.value}))} placeholder="One physical serial per unit"/></label>}</div>})}</div>
  <label className="inventory-review-ack"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>{isReceipt?'I verified the delivery evidence and independently counted the actual units. I am NOT the receipt preparer.':'I inspected the customer POS/job order and physical units. I authorize these items for that exact job, and I am NOT the requester.'}</span></label>
  <label className="field"><span>Verification findings / rejection explanation *</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record checks, observations, receipt / POS details, or discrepancies..."/></label>
  {message&&<p className="scan-batch-feedback" role="alert">{message}</p>}
  <div className="scan-batch-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button><button type="button" className="button button-secondary" onClick={reject}>Reject · Keep History</button><button type="button" className="button button-primary" disabled={!receipt?.proof&&isReceipt||!checked||rescanned.length!==lines.length||mismatch||serialMismatch||notes.trim().length<10} onClick={approve}><CheckCircle2 size={16}/>{isReceipt?'Verify & Credit Stock':'Authorize & Deduct Stock'}</button></div>
 </div>;
}
