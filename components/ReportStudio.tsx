'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Check,CheckCircle2,Copy,Download,FileSpreadsheet,FileText,FolderOpen,Link2,Italic,Lock,Plus,Printer,RotateCcw,Save,Search,Send,Table2,Trash2,Underline as UnderlineIcon,X} from 'lucide-react';
import {activeWorksheet,getWorksheets,canDeleteStudio,canEditStudio,canReviewStudio,cloneSourceRows,colName,DEFAULT_SHEET_COLS,displayCell,escapeStudioCsv,newGrid,parseStudioFiles,SHEET_MAX_COLS,SHEET_MAX_ROWS,sourceToHtmlTable,STUDIO_KEY,studioHomeHref,studioFileHref,type StudioFile,type StudioKind,type StudioSource} from '@/lib/report-studio';
import {downloadFile,uid} from '@/lib/data';
import SheetWorkbench from './SheetWorkbench';
import DocumentWorkbench from './DocumentWorkbench';
import {sanitizeOfficeHtml} from '@/lib/office-html';
import {downloadBlob,exportDocx,exportXlsx} from '@/lib/office-export';
import type {Role} from '@/lib/data';

interface Props {mode:StudioKind;fileId?:string;userId:string;userName:string;role:Role;branch:string;sources:StudioSource[];fromDate:string;toDate:string;setFromDate:(date:string)=>void;setToDate:(date:string)=>void;}
const now=()=>new Date().toISOString();
const safeName=(s:string)=>s.replace(/[\\/:*?"<>|\r\n]/g,'-').trim().slice(0,70)||'Untitled';
const escapeHtml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const EMPTY_DOC='<h1>Untitled document</h1><p>Start writing here...</p>';
const DOCUMENT_TEMPLATES:Record<string,string>={
 'template-report':'<h1>Monthly Operations Report</h1><p>Reporting period: </p><p>Prepared by: </p><h2>Executive Summary</h2><p></p><h2>KPIs and Results</h2><p></p><h2>Findings</h2><p></p><h2>Action Items</h2><p></p>',
 'template-incident':'<h1>Inventory Incident Report</h1><p>Date and branch: </p><p>Reported by: </p><h2>Incident Details</h2><p></p><h2>Items and Quantities</h2><table><tbody><tr><th>Barcode</th><th>Product</th><th>Qty</th><th>Notes</th></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table><h2>Investigation</h2><p></p><h2>Corrective Actions</h2><p></p>',
 'template-minutes':'<h1>Meeting Minutes</h1><p>Date: </p><p>Attendees: </p><h2>Agenda</h2><ul><li></li></ul><h2>Decisions</h2><p></p><h2>Action Items</h2><table><tbody><tr><th>Task</th><th>Owner</th><th>Due Date</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>'
};

const sanitizeHtml=sanitizeOfficeHtml;
function gridToTable(rows:string[][]){
 const last=Math.max(0,...rows.map((r,i)=>r.some(v=>v.trim())?i:0));
 return `<table><tbody>${rows.slice(0,last+1).map((row,r)=>`<tr>${row.map((_,c)=>r===0?`<th>${escapeHtml(displayCell(rows,r,c))}</th>`:`<td>${escapeHtml(displayCell(rows,r,c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function printStudio(html:string,title:string){
 const w=window.open('','_blank');if(!w){window.alert('Allow pop-ups to print your file.');return;}
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:12pt Arial,sans-serif;color:#162236;margin:28px auto;max-width:960px}h1{font-size:23pt}h2{font-size:17pt;margin-top:24px}table{border-collapse:collapse;width:100%;font-size:10pt}td,th{padding:8px;border:1px solid #cbd5e1;text-align:left}th{background:#e9eef5}p{line-height:1.6}@page{size:A4;margin:17mm}</style></head><body>${html}</body></html>`);
 w.document.close();w.focus();w.print();
}
function DateLabel({date}:{date:string}){return <>{new Date(date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</>}
export default function ReportStudio({mode,fileId,userId,userName,role,branch,sources,fromDate,toDate,setFromDate,setToDate}:Props){
 const router=useRouter();const [files,setFiles]=useState<StudioFile[]>([]),filesRef=useRef<StudioFile[]>([]);
 const [loaded,setLoaded]=useState(false),[sourceId,setSourceId]=useState('blank'),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[storageError,setStorageError]=useState('');
 const home=studioHomeHref(mode);const label=mode==='sheet'?'Spreadsheets':'Documents';
 const active=files.find(f=>f.id===fileId&&f.kind===mode&&(f.ownerId===userId||role==='admin'));
 const visible=files.filter(f=>f.kind===mode&&(f.ownerId===userId||role==='admin')&&f.title.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const editable=!!active&&canEditStudio(active,userId,role);
 const reviewing=!!active&&canReviewStudio(active,userId,role);
 const sourcesWithBlank=useMemo(()=>[{id:'blank',label:'Blank file',headers:[],rows:[] as (string|number)[][]},...(mode==='document'?[{id:'template-report',label:'Template: Operations report',headers:[],rows:[]},{id:'template-incident',label:'Template: Inventory incident',headers:[],rows:[]},{id:'template-minutes',label:'Template: Meeting minutes',headers:[],rows:[]}]:[]),...sources],[mode,sources]);
 const statusText=active?.status==='Approved'?'Approved and locked':active?.status==='Submitted'?'Awaiting Admin review':active?.status==='Changes Requested'?'Changes requested — editing enabled':'Draft · Editable';
 useEffect(()=>{
  const refresh=()=>{try{const latest=parseStudioFiles(localStorage.getItem(STUDIO_KEY));filesRef.current=latest;setFiles(latest);}catch{setStorageError('Browser storage unavailable. Save is disabled.');}};
  refresh();setLoaded(true);
  const onStorage=(ev:StorageEvent)=>{if(ev.key===STUDIO_KEY)refresh();};window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[]);
 const commit=(next:StudioFile[]):boolean=>{
  try {localStorage.setItem(STUDIO_KEY,JSON.stringify(next));filesRef.current=next;setFiles(next);setStorageError('');return true;}
  catch {setStorageError('Could not save. Browser storage may be full. Export an important file before making more changes.');return false;}
 };
 const update=(transform:(before:StudioFile[])=>StudioFile[]):boolean=>commit(transform(filesRef.current));
 const patch=(fn:(file:StudioFile)=>StudioFile)=>{
  if(!active||!canEditStudio(active,userId,role))return;
  update(old=>old.map(f=>f.id===active.id&&canEditStudio(f,userId,role)?{...fn(f),updatedAt:now()}:f));
 };
 const create=()=>{
  const source=sourcesWithBlank.find(s=>s.id===sourceId);
  if(!source){setMessage('Selected source is not available.');return;}
  const imported=source.id!=='blank'&&!source.id.startsWith('template-');const file:StudioFile={id:uid(),title:imported?`${source.label} - ${new Date().toLocaleDateString('en-PH')}`:mode==='sheet'?'Untitled spreadsheet':'Untitled document',kind:mode,status:'Draft',ownerId:userId,ownerName:userName,branch,createdAt:now(),updatedAt:now(),sourceName:imported?source.label:'Manual file',sourceDate:now(),sourceCount:imported?source.rows.length:0,rows:mode==='sheet'&&imported?cloneSourceRows(source):newGrid(),html:mode==='document'?(imported?sourceToHtmlTable(source):DOCUMENT_TEMPLATES[source.id]||EMPTY_DOC):EMPTY_DOC};
  if(update(old=>[file,...old]))router.push(studioFileHref(file));
 };
 const remove=(file:StudioFile)=>{
  if(!canDeleteStudio(file,userId))return;
  if(!window.confirm(`Delete "${file.title}" permanently?\n\nThis report file cannot be restored. Original cashier transactions will not be changed.`))return;
  if(update(old=>old.filter(f=>f.id!==file.id))){if(fileId===file.id)router.push(home);else setMessage('File deleted.');}
 };
 const duplicate=()=>{
  if(!active)return;
  const clone:StudioFile={...active,id:uid(),title:`${active.title} (Copy)`,ownerId:userId,ownerName:userName,branch,createdAt:now(),updatedAt:now(),status:'Draft',reviewedAt:undefined,reviewedBy:undefined,reviewNote:undefined,rows:active.rows.map(r=>[...r]),sheets:active.sheets?JSON.parse(JSON.stringify(active.sheets)):undefined};
  if(update(old=>[clone,...old]))router.push(studioFileHref(clone));
 };
 const toDocument=()=>{
  if(!active||mode!=='sheet')return;
  const doc:StudioFile={...active,id:uid(),kind:'document',title:`${active.title} - Document`,ownerId:userId,ownerName:userName,branch,createdAt:now(),updatedAt:now(),status:'Draft',reviewedAt:undefined,reviewedBy:undefined,reviewNote:undefined,sourceName:`Spreadsheet: ${active.title}`,rows:newGrid(),html:`<h1>${escapeHtml(active.title)}</h1><p>Document prepared from spreadsheet snapshot.</p>${gridToTable(activeWorksheet(active).rows)}<h2>Findings</h2><p></p>`};
  if(update(old=>[doc,...old]))router.push(studioFileHref(doc));
 };
 const submit=()=>{
  if(!active||!editable||!window.confirm('Submit for Admin review? Editing will be locked until Admin returns it.'))return;
  update(old=>old.map(f=>f.id===active.id?{...f,status:'Submitted',updatedAt:now(),reviewNote:undefined}:f));
 };
 const review=(approve:boolean)=>{
  if(!active||!reviewing)return;
  const note=window.prompt(approve?'Optional approval note:':'Reason for requesting changes:');
  if(note===null)return;
  if(!approve&&!note.trim()){setMessage('A reason is required to return a file.');return;}
  update(old=>old.map(f=>f.id===active.id?{...f,status:approve?'Approved':'Changes Requested',reviewedAt:now(),reviewedBy:userName,reviewNote:note.trim(),updatedAt:now()}:f));
 };
 const exportFile=(fileType?:'csv'|'html')=>{
  if(!active)return;
  if(mode==='sheet'){
   if(fileType==='csv'){
    const rows=activeWorksheet(active).rows;
    const last=Math.max(0,...rows.map((r,i)=>r.some(v=>v.trim())?i:0));
    const csv='\uFEFF'+rows.slice(0,last+1).map((row,r)=>row.map((_,c)=>escapeStudioCsv(displayCell(rows,r,c))).join(',')).join('\r\n');
    downloadFile(`${safeName(active.title)}.csv`,csv,'text/csv;charset=utf-8');
   } else downloadBlob(`${safeName(active.title)}.xlsx`,exportXlsx(getWorksheets(active)));
  } else if(fileType==='html')downloadFile(`${safeName(active.title)}.html`,`<!doctype html><html><head><meta charset="utf-8"/></head><body>${sanitizeHtml(active.html)}</body></html>`,'text/html;charset=utf-8');
  else downloadBlob(`${safeName(active.title)}.docx`,exportDocx(sanitizeHtml(active.html)));
 };
 const print=()=>{if(active)printStudio(mode==='sheet'?`<h1>${escapeHtml(active.title)}</h1>${gridToTable(activeWorksheet(active).rows)}`:sanitizeHtml(active.html),active.title);};
 const openStatus=active?.reviewNote?` · Review note: ${active.reviewNote}`:'';
 if(!loaded)return <div className="office-wait">Loading {label}...</div>;
 return <section className={`office-workspace ${fileId?'office-editing':'office-library'}`}>
  {!fileId?<>
   <div className="office-library-heading"><div><span className="office-eyebrow">YOUR WORKSPACE · UNDERCHARGERS</span><h1>{label}</h1><p>Standalone {mode==='sheet'?'spreadsheet':'document'} workspace. Create custom reports or import data from your cashier system.</p></div><span className="office-local-indicator"><Lock size={14}/> Browser-local files</span></div>
   <div className="office-library-create"><div className={`office-new-icon ${mode==='sheet'?'office-sheet-icon':'office-doc-icon'}`}>{mode==='sheet'?<FileSpreadsheet size={30}/>:<FileText size={30}/>}</div><div className="office-new-info"><strong>Create a {mode==='sheet'?'spreadsheet':'document'}</strong><span>Blank file or imported snapshot — the official data stays unchanged.</span></div><select aria-label="Choose import source" value={sourceId} onChange={e=>setSourceId(e.target.value)}>{sourcesWithBlank.map(s=><option value={s.id} key={s.id}>{s.label}{s.id==='blank'?'':` (${s.rows.length} records)`}</option>)}</select><button className="office-primary" onClick={create}><Plus size={17}/> Create</button></div>
   <div className="office-source-filters"><span>Import filters</span><strong>{branch}</strong><label>From <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label>To <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label><button className="office-text-btn" onClick={()=>{setFromDate('');setToDate('');}}>Clear dates</button></div>
   <div className="office-files-heading"><h2>Files <span>{visible.length}</span></h2><div className="office-search"><Search size={17}/><input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}...`} value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
   <div className="office-library-table"><div className="office-table-head"><span>Name</span><span>Owner</span><span>Status</span><span>Last modified</span><span>Actions</span></div>{visible.map(f=><div className="office-file-line" key={f.id}><a className="office-file-title" href={studioFileHref(f)}><span className={`office-file-icon ${mode==='sheet'?'office-sheet-icon':'office-doc-icon'}`}>{mode==='sheet'?<FileSpreadsheet size={19}/>:<FileText size={19}/>}</span><span><strong>{f.title}</strong><small>{f.sourceName}</small></span></a><span className="office-cell-muted">{f.ownerId===userId?'Me':f.ownerName}</span><span><em className={`office-status office-status-${f.status.toLowerCase().replace(/\s/g,'-')}`}>{f.status}</em></span><span className="office-cell-muted"><DateLabel date={f.updatedAt}/></span><div className="office-list-actions"><a href={studioFileHref(f)} title="Open file" aria-label={`Open ${f.title}`}><FolderOpen size={18}/></a>{canDeleteStudio(f,userId)&&<button title={`Delete ${f.title}`} aria-label={`Delete ${f.title}`} onClick={()=>remove(f)}><Trash2 size={18}/></button>}</div></div>)}{visible.length===0&&<div className="office-no-files"><FolderOpen size={38}/><h3>No {label.toLowerCase()} found</h3><p>Create a new file above, or clear your search.</p></div>}</div>
  </>:!active?<div className="office-notfound"><FileText size={44}/><h2>File not available</h2><p>This file doesn't exist, belongs to a different workspace, or you don't have access.</p><a className="office-primary" href={home}><ArrowLeft size={17}/> Back to {label}</a></div>:<>
   <div className="office-editor-header"><a className="office-back-link" href={home} title={`Back to ${label}`}><ArrowLeft size={21}/></a><span className={`office-file-icon ${mode==='sheet'?'office-sheet-icon':'office-doc-icon'}`}>{mode==='sheet'?<FileSpreadsheet size={24}/>:<FileText size={24}/>}</span><div className="office-editor-identity"><input aria-label="File name" value={active.title} disabled={!editable} maxLength={100} onChange={e=>patch(f=>({...f,title:e.target.value}))}/><div className="office-file-undername"><span>{label}</span><span>·</span><span>{active.sourceName}</span><span>·</span><span><Save size={13}/> Saved locally</span></div></div><div className="office-editor-commands"><button title="Copy this file URL" onClick={()=>{navigator.clipboard.writeText(window.location.href).then(()=>setMessage('File URL copied. Files are currently saved only in this browser; cloud sharing will require a backend.')).catch(()=>setMessage('Could not copy link. Copy the address from your browser instead.'));}}><Link2 size={16}/><span>Copy file URL</span></button><button title="Duplicate file" onClick={duplicate}><Copy size={16}/><span>Make a copy</span></button>{mode==='sheet'&&<button title="Create document from spreadsheet" onClick={toDocument}><FileText size={16}/><span>To Doc</span></button>}<button onClick={()=>exportFile()} title="Download editable Office file"><Download size={16}/><span>{mode==='sheet'?'XLSX':'DOCX'}</span></button><button onClick={()=>exportFile(mode==='sheet'?'csv':'html')} title="Download alternate format"><Download size={16}/><span>{mode==='sheet'?'CSV':'HTML'}</span></button><button onClick={print} title="Print or save PDF"><Printer size={16}/><span>Print</span></button></div></div>
   <div className={`office-editor-body ${mode==='sheet'?'office-sheet-body':'office-doc-body'}`}>
    {mode==='document'
     ?<DocumentWorkbench id={active.id} html={active.html} readOnly={!editable} onChange={html=>patch(f=>({...f,html}))} onMessage={setMessage}/>
     :<SheetWorkbench file={active} editable={editable} onChange={fn=>patch(fn)} onMessage={setMessage}/>
    }
   </div>
   <div className="office-editor-bottom"><div className="office-save-state"><Check size={15}/><span>{statusText}</span>{openStatus&&<small>{openStatus}</small>}</div><div className="office-review-buttons">{editable&&<button className="office-primary" onClick={submit}><Send size={15}/> Submit for Admin Review</button>}{reviewing&&<><button onClick={()=>review(false)}><RotateCcw size={15}/> Request changes</button><button className="office-primary" onClick={()=>review(true)}><CheckCircle2 size={15}/> Approve</button></>}{canDeleteStudio(active,userId)&&<button className="office-danger" onClick={()=>remove(active)}><Trash2 size={15}/> Delete</button>}</div></div>
  </>}
  {(message||storageError)&&<div className={`office-notice ${storageError?'office-notice-error':''}`} role="status">{storageError||message}<button title="Dismiss" onClick={()=>{setMessage('');setStorageError('');}}><X size={14}/></button></div>}
  {!fileId&&<p className="office-disclaimer"><Lock size={13}/> Files are stored in this browser and linked to your cashier workspace. Imported records are copies, not editable official ledger data. Approval controls are only a frontend demo until a backend is connected.</p>}
 </section>;
}
