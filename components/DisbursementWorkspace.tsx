'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Download,Eye,FileDown,FileText,Paperclip,Printer,RefreshCw,Search,Send,ShieldCheck} from 'lucide-react';
import {BRANCHES,BRANCH_NAME,pesos,type BranchId,type Database,type Fund,type User} from '@/lib/data';
import {activeDisbursementCycle,coverageCutoffs,createAutomaticDisbursement,refreshAutomaticDisbursement,eligibleFundExpenses,makeGeneratedSnapshot,resolvedRequestReceipts,submitDisbursementRequest,visibleDisbursements,DISBURSEMENT_STATUSES,externallyConsistent,isDisbursementCreator,type DisbursementRequest,type DisbursementStatus,type GeneratedDisbursementLine} from '@/lib/disbursement-requests';
import {downloadDisbursementPDF,printDisbursementPaper} from '@/lib/disbursement-paper';

type Props={db:Database;user:User;currentBranch:BranchId;adminBranch:BranchId|'ALL';canTransact:boolean;onUpdate:(next:Database)=>boolean;notify:(message:string)=>void};
type PaperData={sourceMode?:'generated'|'legacy-manual';requestNo:string;requestDate:string;requestorName:string;requestorRole:'pb'|'cashier';status:string;sourceFund:Fund;branch:BranchId;lines:GeneratedDisbursementLine[];amount:number;sourceBalances:DisbursementRequest['sourceBalances'];remarks:string;cutoffs:DisbursementRequest['coverageCutoffs'];coverageUntil?:string;accounting?:DisbursementRequest['accounting'];msKate?:DisbursementRequest['msKate']};
const fmtDate=(d:string)=>{try{return new Date(d).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});}catch{return d;}};
const money=(v:number)=>pesos(Math.round(v*100)/100);
const style=(s:DisbursementStatus)=>s==='Draft'?'draft':s.startsWith('Pending')?'pending':s.startsWith('Returned')?'returned':s.startsWith('Rejected')?'rejected':s==='Reconciled'?'complete':'approved';
const num=(value:number)=>Math.round(value*100)/100;
const branchIds=(fund:Fund,branch:BranchId)=>fund==='RFP'?BRANCHES.map(b=>b.id):[branch];

/** The same read-only financial paper is used for preparing and reviewing a saved request. */
function ApprovalPaper({data,db,onReceipt}:{data:PaperData;db:Database;onReceipt:(id:string)=>void}){
 const original= num(data.lines.reduce((n,l)=>n+l.amount,0));
 const charges=num(data.lines.reduce((n,l)=>n+l.onlineCharge,0));
 const balances=Object.values(data.sourceBalances||{});
 const opening=num(balances.reduce((n,b)=>n+(b?.fundBalance||0),0));
 const remaining=num(balances.reduce((n,b)=>n+(b?.remaining||0),0));
 const scope=branchIds(data.sourceFund,data.branch);
 const proofIds=new Set(db.fundEntries.filter(e=>!!e.proof).map(e=>e.id));
 if(data.sourceMode==='legacy-manual')return <article className="disb-paper" aria-label="Historical legacy request"><header className="disb-paper-head"><span className="disb-paper-overline">HISTORICAL REQUEST · READ ONLY</span><h2>LEGACY DISBURSEMENT RECORD</h2><p>Original manually entered request preserved; source-ledger lines were not recorded.</p></header><div className="disb-paper-body"><div className="disb-paper-ledger"><div><span>Request</span><strong>{data.requestNo}</strong></div><div><span>Prepared by</span><strong>{data.requestorName}</strong></div><div><span>Recorded requested amount</span><strong>{money(data.amount)}</strong></div><div><span>Status</span><strong>{data.status}</strong></div></div><p className="disb-paper-footnote">This legacy record has no source-expense snapshot. Branch totals and receipts must not be inferred or fabricated.</p></div></article>;
 return <article className="disb-paper" aria-label="A4 disbursement request review">
  <header className="disb-paper-head">
   <span className="disb-paper-overline">UNDERCHARGERS / FINANCE OPERATIONS</span>
   <h2>{data.sourceFund==='RFP'?'RFP':'REVOLVING FUND'} DISBURSEMENT REQUEST</h2>
   <p>{data.sourceFund==='RFP'?'Consolidated · UC and MM branches':BRANCH_NAME(data.branch)} · A4 approval paper</p>
   <div className="disb-paper-meta"><span><b>Request</b>{data.requestNo}</span><span><b>Prepared by · Account name</b>{data.requestorName}<small className="disb-preparer-role">{data.requestorRole==='pb'?'Parts Buyer':'Cashier'}</small></span><span><b>Date</b>{data.requestDate}</span><span><b>Status</b>{data.status}</span></div>
  </header>
  <div className="disb-paper-body">
   <section className="disb-paper-section">
    <div className="disb-paper-section-title"><h3>01 / Disbursement Transaction Summary</h3><span>{data.lines.length} recorded expense{data.lines.length===1?'':'s'}</span></div>
    <div className="disb-paper-table-scroller"><table className="disb-paper-table"><thead><tr><th>Date</th><th>Amount &amp; Branch</th><th>Online Payment Charge</th><th>Total Expenses</th><th>Remarks / Receipt</th></tr></thead><tbody>
     {data.lines.map(l=><tr key={l.sourceId}><td data-label="Date">{l.date}</td><td data-label="Amount & Branch"><strong>{money(l.amount)}</strong><small>{BRANCH_NAME(l.branch)}</small></td><td data-label="Online Charge">{money(l.onlineCharge)}</td><td data-label="Total Expenses"><strong>{money(l.total)}</strong></td><td data-label="Remarks"><span>{l.remarks}</span><small>{l.reference}</small>{proofIds.has(l.sourceId)?<button type="button" className="disb-receipt-action" onClick={()=>onReceipt(l.sourceId)}><Eye size={13}/> View receipt</button>:<small className="disb-missing-receipt">No receipt attached</small>}</td></tr>)}
     {!data.lines.length&&<tr><td colSpan={5} className="disb-empty-row">No eligible expenses in the current cycle.</td></tr>}
     <tr className="disb-paper-total"><th>Total</th><td>{money(original)}</td><td>{money(charges)}</td><td><strong>{money(data.amount)}</strong></td><td/></tr>
    </tbody></table></div>
   </section>
   <div className="disb-paper-summary-grid">
    <section className="disb-paper-section"><h3>02 / Total per Branch</h3><div className="disb-paper-ledger">{scope.map(id=><div key={id}><span>{BRANCH_NAME(id)}</span><strong>{money(num(data.lines.filter(l=>l.branch===id).reduce((n,l)=>n+l.total,0)))}</strong></div>)}<div className="disb-paper-ledger-total"><span>Grand Total</span><strong>{money(data.amount)}</strong></div></div></section>
    <section className="disb-paper-section"><h3>03 / Fund Summary</h3><div className="disb-paper-ledger"><div><span>Fund Balance (snapshot)</span><strong>{money(opening)}</strong></div><div><span>Less: Expenses</span><strong>{money(data.amount)}</strong></div><div><span>Remaining Fund</span><strong>{money(remaining)}</strong></div><div className="disb-paper-ledger-total"><span>Amount Requested</span><strong>{money(data.amount)}</strong></div></div></section>
   </div>
   <section className="disb-paper-section disb-paper-approvals"><h3>04 / Approval &amp; Verification</h3><div className="disb-signatures">
    <div><strong>{data.requestorName}</strong><span>Prepared by · {data.requestorRole==='pb'?'Parts Buyer':'Cashier'}</span></div>
    <div><strong>{data.accounting?.actorName||'Awaiting external review'}</strong><span>Checked by · Accounting</span></div>
    <div><strong>{data.msKate?.actorName||'Not yet verified'}</strong><span>Verified by · Auditor / Ms Kate</span></div>
    <div><strong>Not signed</strong><span>Approved by · President (paper field only)</span></div>
   </div></section>
   {data.remarks&&<p className="disb-paper-remarks"><b>Request remarks:</b> {data.remarks}</p>}
   <p className="disb-paper-footnote">Review copy only. Printed signature lines are not system approvals. CMS does not record external approvals or payments.</p>
  </div>
 </article>;
}

export default function DisbursementWorkspace({db,user,adminBranch,canTransact,onUpdate,notify}:Props){
 const [activeId,setActiveId]=useState('');const [preparing,setPreparing]=useState(false);const [remarks,setRemarks]=useState('');
 const [search,setSearch]=useState(''),[status,setStatus]=useState('All'),[page,setPage]=useState(1),[saving,setSaving]=useState(false),[receiptId,setReceiptId]=useState('');
 const creator=isDisbursementCreator(user),fund:Fund=user.role==='pb'?'RFP':'RF';
 const all=useMemo(()=>visibleDisbursements(db,user,adminBranch),[db,user,adminBranch]);
 const active=all.find(r=>r.id===activeId);
 const canEdit=!!active&&active.sourceMode==='generated'&&creator&&active.requestorId===user.id&&(user.role==='pb'||active.branch===user.branch)&&['Draft','Returned by Accounting','Returned by Ms Kate'].includes(active.status);
 const candidates=useMemo(()=>creator?eligibleFundExpenses(db,user,fund,preparing?active?.id:undefined):[],[db,user,fund,preparing,active?.id,creator]);
 const live=makeGeneratedSnapshot(db,candidates.map(e=>e.id),fund);
 const periods=coverageCutoffs(db,fund);
 const carriedForward=candidates.filter(e=>periods[e.branch].source==='Recorded release'&&e.createdAt<=periods[e.branch].at).length;
 const pending=activeDisbursementCycle(db,user,fund);
 const filtered=all.filter(r=>(status==='All'||r.status===status)&&[r.requestNo,r.requestorName,r.purpose,r.category,...(r.sourceBranches||[r.branch])].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const pages=Math.max(1,Math.ceil(filtered.length/10)),currentPage=Math.min(pages,page),rows=filtered.slice((currentPage-1)*10,currentPage*10);
 useEffect(()=>setPage(1),[status,search,adminBranch]);
 const latestRequest=all[0];
 const paperData:PaperData|undefined=preparing?{
  sourceMode:'generated',requestNo:active?.requestNo||'DRAFT / NOT SAVED',requestDate:active?.requestDate||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}),requestorName:active?.requestorName||user.name,requestorRole:active?.requestorRole||user.role as 'pb'|'cashier',status:active?.status||'Draft',sourceFund:fund,branch:user.branch,lines:live.lines,amount:live.amount,sourceBalances:live.sourceBalances,remarks,cutoffs:periods
 }:active?{sourceMode:active.sourceMode,requestNo:active.requestNo,requestDate:active.requestDate,requestorName:active.requestorName,requestorRole:active.requestorRole,status:active.status,sourceFund:active.sourceFund||'RF',branch:active.branch,lines:active.sourceLines||[],amount:active.amount,sourceBalances:active.sourceBalances,remarks:active.remarks,cutoffs:active.coverageCutoffs,coverageUntil:active.coverageUntil,accounting:active.accounting,msKate:active.msKate}:undefined;
 const receipt=receiptId?db.fundEntries.find(e=>e.id===receiptId)?.proof:undefined;
 const previewReceipts=preparing?candidates.filter(e=>!!e.proof).length:active?active.sourceLines?.filter(l=>!!db.fundEntries.find(e=>e.id===l.sourceId)?.proof).length||0:0;
 function viewRequest(r:DisbursementRequest){setPreparing(false);setReceiptId('');setActiveId(r.id);}
 function startNew(){if(!creator||!canTransact)return;
  if(pending){const owned=all.find(r=>r.id===pending.id);if(owned){viewRequest(owned);notify('There is already an active cycle. Open or revise the existing request.');}else notify('Another active disbursement cycle exists for this fund. It must be completed before starting the next one.');return;}
  setActiveId('');setRemarks('');setReceiptId('');setPreparing(true);
 }
 function startEdit(r:DisbursementRequest){if(!canEdit)return;setActiveId(r.id);setRemarks(r.remarks);setReceiptId('');setPreparing(true);}
 function save(submit=false){if(!creator||saving||!canTransact)return;setSaving(true);
  try{
   const next=active?.sourceMode==='generated'?refreshAutomaticDisbursement(db,active.id,user,remarks):createAutomaticDisbursement(db,user,fund,remarks);
   const id=active?.sourceMode==='generated'?active.id:next.disbursementRequests?.[0]?.id;
   if(!id)throw new Error('Could not generate a request ID.');
   const final=submit?submitDisbursementRequest(next,id,user):next;
   if(!onUpdate(final))throw new Error('Browser storage could not save this request; export a backup and check storage capacity.');
   setActiveId(id);setPreparing(false);notify(submit?'Submitted to pending external Accounting review. No approval or payment recorded.':'Auto-generated request draft saved.');
  }catch(error){notify((error as Error).message);}finally{setSaving(false);}
 }
 function submitExisting(r:DisbursementRequest){try{if(!onUpdate(submitDisbursementRequest(db,r.id,user)))throw new Error('Browser storage unavailable.');notify('Sent for external Accounting approval.');}catch(error){notify((error as Error).message);}}
 function print(r:DisbursementRequest){printDisbursementPaper({...r,attachments:resolvedRequestReceipts(db,r)});}
 async function pdf(r:DisbursementRequest){try{await downloadDisbursementPDF({...r,attachments:resolvedRequestReceipts(db,r)});notify('Approval paper and available receipt pages exported.');}catch(error){notify(`PDF export failed: ${(error as Error).message}`);}}
 return <div className="disb-workspace disb-v922">
  {!preparing&&!active&&<>
   <header className="disb-hub-head"><div><span className="disb-eyebrow">FINANCE / DISBURSEMENTS</span><h2>Disbursement Requests</h2><p>Automatically prepared from recorded {creator?fund:'RF / RFP'} expenses. Review the paper, then submit for Accounting.</p></div>{creator&&<button type="button" className="button button-primary" disabled={!canTransact} onClick={startNew}><FileText size={17}/> Prepare next disbursement</button>}</header>
   <div className="disb-hub-strip"><span><strong>{all.filter(r=>r.status==='Pending Accounting Approval').length}</strong> Pending Accounting</span><span><strong>{all.filter(r=>r.status==='Pending Ms Kate Approval').length}</strong> Pending Ms Kate</span><span><strong>{all.filter(r=>r.status==='Approved for Release').length}</strong> Authorized (not paid)</span><span><strong>{all.length}</strong> Total records</span></div>
   {creator&&<div className="disb-hub-cycle"><CheckCircle2 size={19}/><span>{fund==='RFP'?'PB consolidated RFP · All four branches':'Cashier RF · Assigned branch only'} · {pending?`Active cycle ${pending.requestNo} (${pending.status})`:'Next cycle is calculated automatically; no checkbox selection.'}</span></div>}
   <section className="panel disb-list-panel"><div className="disb-list-heading"><div><h3>Requests &amp; Approval Tracking</h3><p>Open any request to view the actual approval paper, receipts and audit trail.</p></div>{latestRequest&&<span className="disb-last-request">Latest: {latestRequest.requestNo}</span>}</div>
    <div className="filters disb-list-filters"><div className="search-box"><Search size={16}/><input aria-label="Search disbursements" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find request, branch or requestor"/></div><select className="filter-select" aria-label="Filter request status" value={status} onChange={e=>setStatus(e.target.value)}><option value="All">All statuses</option>{DISBURSEMENT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
    <div className="disb-request-list">{rows.map(r=><button key={r.id} type="button" className="disb-request-row" onClick={()=>viewRequest(r)}><span className="disb-request-primary"><strong>{r.requestNo}</strong><small>{r.requestorName} · {r.requestDate} · {r.sourceFund||'Historical request'}</small></span><span className="disb-request-amount">{money(r.amount)}</span><span className={`disb-badge ${style(r.status)}`}>{r.status}</span><ChevronRight size={18}/></button>)}{!rows.length&&<div className="disb-no-requests">No requests found. Record an RF/RFP expense before preparing a disbursement.</div>}</div>
    <div className="disb-pagination"><span>{filtered.length} request(s) · Page {currentPage} of {pages}</span><div><button aria-label="Previous page" className="button button-secondary button-small" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button aria-label="Next page" className="button button-secondary button-small" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div>
   </section>
  </>}
  {(preparing||active)&&paperData&&<>
   <div className="disb-review-top"><button type="button" className="disb-back-link" onClick={()=>{setActiveId('');setPreparing(false);setReceiptId('');}}><ArrowLeft size={16}/> All disbursements</button><div className="disb-review-status"><span className="disb-version-label">{preparing?'AUTO-GENERATED / REVIEW':active?.requestNo}</span><span className={`disb-badge ${style(active?.status||'Draft')}`}>{active?.status||'Draft — not saved'}</span></div></div>
   <div className="disb-review-toolbar"><div><span className="disb-eyebrow">{preparing?'STEP 1 / REVIEW GENERATED REQUEST':'DISBURSEMENT APPROVAL PAPER'}</span><h2>{preparing?'Review before submission':paperData.sourceFund==='RFP'?'RFP Disbursement':'Cashier RF Disbursement'}</h2><p>{preparing?'Every eligible transaction is included automatically. No re-entry or selection.':'Read-only source snapshot · External approvals are not simulated.'}</p><p><strong>Prepared by:</strong> {paperData.requestorName} · {paperData.requestorRole==='pb'?'Parts Buyer':'Cashier'} · {paperData.sourceFund==='RFP'?'Consolidated RFP (all branches)':BRANCH_NAME(paperData.branch)}</p></div><div className="disb-review-amount"><span>Amount Requested</span><strong>{money(paperData.amount)}</strong></div></div>
   {preparing&&<div className="disb-coverage-box"><div><BookOpen size={17}/><strong>Automatic coverage · After last completed disbursement → Present</strong></div><p>{fund==='RFP'?'Independent branch cutoffs are used for all four branches.':'Only the assigned Cashier branch is included.'} Expenses already reserved by another request are excluded.{carriedForward>0?` ${carriedForward} previously unclaimed expense(s) carried forward.`:''}</p><details><summary>See branch coverage boundaries <ChevronDown size={14}/></summary><ul>{branchIds(fund,user.branch).map(id=><li key={id}><strong>{BRANCH_NAME(id)}:</strong> {periods[id].at?fmtDate(periods[id].at):'From first recorded expense'} <span>({periods[id].source})</span></li>)}</ul></details></div>}
   {active&&!preparing&&active.coverageCutoffs&&<div className="disb-coverage-box"><div><BookOpen size={17}/><strong>Saved cycle coverage</strong></div><p>Request snapshot created {active.coverageUntil?fmtDate(active.coverageUntil):fmtDate(active.createdAt)}. Later transactions are not silently added.</p><details><summary>View recorded cutoff per branch <ChevronDown size={14}/></summary><ul>{branchIds(active.sourceFund||'RF',active.branch).map(id=><li key={id}><strong>{BRANCH_NAME(id)}:</strong> {active.coverageCutoffs?.[id]?.at?fmtDate(active.coverageCutoffs[id]!.at):'First recorded expense'} <span>({active.coverageCutoffs?.[id]?.source||'Unavailable'})</span></li>)}</ul></details></div>}
   <div className="disb-paper-stage"><ApprovalPaper data={paperData} db={db} onReceipt={setReceiptId}/></div>
   {receipt&&<div className="disb-receipt-panel"><div><div><strong><Paperclip size={16}/> Original source receipt</strong><p>{receipt.name} · From the recorded expense, not re-uploaded</p></div><button type="button" onClick={()=>setReceiptId('')} aria-label="Close receipt preview">×</button></div><div className="disb-receipt-panel-body">{receipt.data.startsWith('data:image/')?<img src={receipt.data} alt={receipt.name}/>:receipt.data.startsWith('data:application/pdf')?<iframe title={`Receipt ${receipt.name}`} src={receipt.data}/>:<p>This format cannot be previewed directly.</p>}</div><a href={receipt.data} download={receipt.name} className="button button-secondary"><Download size={15}/> Download original receipt</a></div>}
   {preparing&&<section className="disb-review-controls"><div><label htmlFor="disb-remarks">Optional request remarks</label><textarea id="disb-remarks" value={remarks} rows={2} onChange={e=>setRemarks(e.target.value)} placeholder="Only remarks are editable. Expenses, charges and receipt references are read-only."/><span>{previewReceipts} of {live.lines.length} expense rows have attached receipts. Missing receipts must be resolved in original RF/RFP transactions.</span></div><div className="disb-review-buttons"><button type="button" className="button button-secondary" disabled={saving||!canTransact||!live.lines.length} onClick={()=>save(false)}>Save Draft</button><button type="button" className="button button-primary" disabled={saving||!canTransact||!live.lines.length} onClick={()=>save(true)}><Send size={16}/> Submit to Accounting</button></div></section>}
   {active&&!preparing&&<>
    <div className="disb-review-actionbar"><div><span><Paperclip size={16}/> {previewReceipts} source receipt{previewReceipts===1?'':'s'} linked</span><span>Open a transaction row to preview its original proof.</span></div><div><button type="button" className="button button-secondary" onClick={()=>print(active)}><Printer size={16}/> Print A4 Portrait</button><button type="button" className="button button-primary" onClick={()=>void pdf(active)}><FileDown size={16}/> Download Paper + Receipts PDF</button></div></div>
    {(active.status.startsWith('Returned')||active.status.startsWith('Rejected'))&&<div className="disb-reason"><strong>{active.status}</strong><p>{active.status.includes('Accounting')?active.accounting?.reason||'Reason not yet available':active.msKate?.reason||'Reason not yet available'}</p></div>}
    {!externallyConsistent(active)&&<div className="disb-reason">The external approval states are inconsistent; trusted review required.</div>}
    <details className="disb-history-fold"><summary><span><ShieldCheck size={17}/> Approval tracking &amp; request history</span><ChevronDown size={17}/></summary>
     <div className="disb-journey">{[['CMS · Prepared by',`${active.requestorName} · ${active.submittedAt?'Submitted':'Draft'}`],['Accounting · First approval',active.accounting?.state||'External review not connected'],['Ms Kate · Final verification',active.msKate?.state||'Awaiting real Accounting approval'],['President · Signature field','Paper reference only · approval authority not configured'],['Release & Reconciliation',active.release?`Release recorded · ${active.reconciliation?'Reconciled':'Not reconciled'}`:'Not released / not paid']].map(([label,detail],i)=><div key={label}><span className={`disb-step-marker ${i===0?'done':''}`}>{i+1}</span><div><strong>{label}</strong><small>{detail}</small></div></div>)}</div>
     <div className="disb-timeline">{active.timeline.slice().reverse().map(t=><div key={t.id}><span className="disb-history-dot"/><div><strong>{t.action}</strong><small>{fmtDate(t.at)} · {t.actorRole} · {db.users.find(u=>u.id===t.actorId)?.name||t.actorId} · {t.origin}</small><p>{t.from&&t.from!==t.to?`${t.from} → ${t.to}`:t.to}{t.remarks?` · ${t.remarks}`:''}</p>{t.changes&&<details><summary>Before / after</summary>{Object.entries(t.changes).map(([key,value])=><p key={key}>{key}: {JSON.stringify(value.before)} → {JSON.stringify(value.after)}</p>)}</details>}</div></div>)}</div>
    </details>
    {canEdit&&<div className="disb-review-buttons disb-saved-actions">{active.sourceMode==='generated'&&creator&&<button type="button" className="button button-secondary" onClick={()=>startEdit(active)}><RefreshCw size={16}/> Refresh expenses / remarks</button>}{active.status==='Draft'&&<button type="button" className="button button-primary" disabled={!canTransact} onClick={()=>submitExisting(active)}><Send size={16}/> Submit to Accounting</button>}{active.status.startsWith('Returned')&&<span>Save corrected source snapshot or remarks before resubmission.</span>}</div>}
    {active.sourceMode!=='generated'&&<p className="disb-footer-notice">This older manually entered request is retained as history. New requests use only automatically generated expense records.</p>}
   </>}
   <p className="disb-footer-notice">Frontend-only CMS: no external Accounting/HRMS synchronization. Approval paper signatures do not authorize payment or release.</p>
  </>}
 </div>;
}
