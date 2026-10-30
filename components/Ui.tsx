'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Check,UploadCloud,PenLine,CheckCircle2,Clock3,XCircle,MinusCircle} from 'lucide-react';
import {money} from '@/lib/data';
export function Modal({title,subtitle,onClose,children,wide=false}:{title:string;subtitle?:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
 const dialogRef=useRef<HTMLDivElement>(null);
 const onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const node=dialogRef.current;
  node?.focus();
  function keydown(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();onCloseRef.current();return;}
   if(event.key!=='Tab'||!node)return;
   const targets=Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
   if(!targets.length){event.preventDefault();node.focus();return;}
   const first=targets[0],last=targets[targets.length-1];
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===node)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
 },[]);
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><div ref={dialogRef} tabIndex={-1} className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle&&<p className="muted small">{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div><div className="modal-body">{children}</div></div></div>
}
export function Input({label,value,onChange,placeholder,type='text',required=false,min,step,disabled=false}: {label:string;value:string|number;onChange:(s:string)=>void;placeholder?:string;type?:string;required?:boolean;min?:string;step?:string;disabled?:boolean}){
 return <label className="field"><span>{label}{required&&<b className="required"> *</b>}</span><input disabled={disabled} required={required} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} min={min} step={step}/></label>
}
export function Select({label,value,onChange,options,required=false,disabled=false}:{label:string;value:string;onChange:(s:string)=>void;options:{value:string;label:string}[];required?:boolean;disabled?:boolean}){
 return <label className="field"><span>{label}{required&&<b className="required"> *</b>}</span><select disabled={disabled} value={value} required={required} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
}
export function TextArea({label,value,onChange,placeholder,rows=2,required=false}:{label:string;value:string;onChange:(s:string)=>void;placeholder?:string;rows?:number;required?:boolean}){
 return <label className="field"><span>{label}{required&&<b className="required"> *</b>}</span><textarea value={value} required={required} rows={rows} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>
}
export function StatusPill({status}:{status:string}){
 const value=status.trim().toLowerCase();
 // Awaiting review / submitted reports are NEVER completed approvals.
 const danger=/rejected|denied|missed|discrepancy|failed|cancelled|report required|returned/.test(value);
 const pending=/pending|awaiting|submitted|for review|in review|under review|verification|unverified|for approval|for release|requested|processing|draft for review/.test(value);
 const success=/approved|completed|closed|cleared|paid|received|resolved|verified|signed|released|done/.test(value);
 const color=danger?'danger':pending?'warning':success?'success':'neutral';
 const Icon=danger?XCircle:pending?Clock3:success?CheckCircle2:MinusCircle;
 return <span className={`pill pill-${color}`} title={status}><Icon size={13} aria-hidden="true"/><span>{status}</span></span>
}
export function Empty({title,description}:{title:string;description?:string}){return <div className="empty"><div className="empty-icon">—</div><strong>{title}</strong><span>{description||'No records to show for these filters.'}</span></div>}
export function Actions({onCancel,submit,disabled=false}:{onCancel:()=>void;submit:string;disabled?:boolean}){return <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={disabled} type="submit"><Check size={16}/>{submit}</button></div>}
export function FileInput({value,onChange,label='Receipt / Supporting Document'}:{value?:{name:string;data:string};onChange:(v?:{name:string;data:string})=>void;label?:string}){
 const [message,setMessage]=useState('');
 function upload(file?:File){if(!file)return;if(file.size>1_600_000){setMessage('File too large for local demo. Use a file below 1.6 MB.');return;}if(!/^(image\/|application\/pdf)/.test(file.type)){setMessage('Images and PDF files only.');return;}const reader=new FileReader();reader.onload=()=>{onChange({name:file.name,data:String(reader.result)});setMessage('')};reader.readAsDataURL(file);}
 return <div className="field"><span>{label}</span><label className="upload-box"><UploadCloud size={17}/><span>{value?value.name:'Attach image or PDF (max 1.6 MB)'}</span><input type="file" accept="image/*,application/pdf" capture={undefined} onChange={e=>upload(e.target.files?.[0])}/></label>{value&&<div className="file-actions"><button type="button" className="text-button" onClick={()=>window.open(value.data,'_blank','noopener,noreferrer')}>Preview</button><button type="button" className="text-button danger-text" onClick={()=>onChange(undefined)}>Remove</button></div>}{message&&<small className="danger-text">{message}</small>}</div>
}
export function SignaturePad({value,onChange}:{value:string;onChange:(s:string)=>void}){
 const ref=useRef<HTMLCanvasElement>(null);const drawing=useRef(false);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);if(value){const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,canvas.width,canvas.height);image.src=value;}},[value]);
 function pointer(e:React.PointerEvent<HTMLCanvasElement>,kind:'start'|'move'|'end'){
  const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  if(kind==='end'){if(drawing.current){drawing.current=false;onChange(canvas.toDataURL('image/png'));}return;}
  if(kind==='move'&&!drawing.current)return;
  const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)*canvas.width/rect.width;const y=(e.clientY-rect.top)*canvas.height/rect.height;
  ctx.lineWidth=2.6;ctx.strokeStyle='#17191e';ctx.lineCap='round';ctx.lineJoin='round';
  if(kind==='start'){drawing.current=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(x,y);}else{ctx.lineTo(x,y);ctx.stroke();}
 }
 return <div className="field"><span>Signature</span><div className="signature-wrap"><canvas ref={ref} width={640} height={150} onPointerDown={e=>pointer(e,'start')} onPointerMove={e=>pointer(e,'move')} onPointerUp={e=>pointer(e,'end')} onPointerCancel={e=>pointer(e,'end')}/></div><div className="signature-footer"><span className="muted small"><PenLine size={13}/> Sign with finger, stylus or mouse</span><button type="button" className="text-button" onClick={()=>onChange('')}>Clear signature</button></div></div>
}
export function ProgressBar({value,total}:{value:number;total:number}){return <div className="progress-track"><div style={{width:`${Math.max(0,Math.min(100,(total>0?value/total:0)*100))}%`}}/></div>}
export function Money({amount}:{amount:number}){return <span className="mono">₱{money(amount)}</span>}
