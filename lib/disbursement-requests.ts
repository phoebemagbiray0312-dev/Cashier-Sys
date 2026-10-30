/** CMS-originated disbursement request contract (v1).
 * Local prototype owns DRAFT/SUBMISSION only. Accounting, HRMS and release
 * are external authority boundaries. Do not infer external decisions from
 * CMS admin actions or old RF/RFP replenishment statuses.
 */
import {BRANCHES,BRANCH_NAME,expenseGross,balance,type Fund,type FundEntry,type BranchId,type Database,type Receipt,type Role,type User,log,uid,todayPH} from './data';

export const DISBURSEMENT_STATUSES = [
 'Draft','Pending Accounting Approval','Returned by Accounting','Rejected by Accounting',
 'Pending Ms Kate Approval','Returned by Ms Kate','Rejected by Ms Kate',
 'Approved for Release','Released / Paid','Reconciled'
] as const;
export type DisbursementStatus = typeof DISBURSEMENT_STATUSES[number];
export type DisbursementRequestorRole = Extract<Role,'cashier'|'pb'>;
export type ExternalStage = 'Accounting'|'Ms Kate';
export interface ExternalDecision {
 state:'Pending'|'Approved'|'Returned'|'Rejected';actorId?:string;actorName?:string;
 decidedAt?:string;reason?:string;origin:'external';
}
export interface DisbursementRelease {
 amount:number;method:string;date:string;reference:string;releasingUserId:string;
 proof:Receipt;recordedAt:string;authorizationId:string;
}
export interface DisbursementReconciliation {reconciledBy:string;reconciledAt:string;reference:string;notes:string;}
export interface DisbursementTimeline {
 id:string;at:string;actorId:string;actorRole:string;branch:BranchId;action:string;
 from?:DisbursementStatus;to:DisbursementStatus;remarks?:string;changes?:Record<string,{before:unknown;after:unknown}>;
 origin:'cms'|'external';
}
/** Immutable source-ledger snapshot, never an independent expense or a payment. */
export interface GeneratedDisbursementLine {
 sourceId:string; reference:string;date:string;branch:BranchId;amount:number;onlineCharge:number;total:number;
 remarks:string;receiptNo:string;status:string;receiptName?:string;
}
export interface DisbursementRequest {
 id:string;requestNo:string;schemaVersion:1;
 requestDate:string;requestorId:string;requestorName:string;employeeId:string;
 requestorRole:DisbursementRequestorRole;branch:BranchId;
 category:string;purpose:string;amount:number;attachments:Receipt[];remarks:string;
 sourceMode?:'generated'|'legacy-manual';sourceFund?:Fund;sourceExpenseIds?:string[];sourceLines?:GeneratedDisbursementLine[];sourceBranches?:BranchId[];
 sourceBalances?:Partial<Record<BranchId,{fundBalance:number;expenses:number;remaining:number}>>;
 coverageCutoffs?:Partial<Record<BranchId,{at:string;source:string}>>;coverageUntil?:string;
 status:DisbursementStatus;revision:number;createdAt:string;updatedAt:string;submittedAt?:string;
 accounting?:ExternalDecision;msKate?:ExternalDecision;
 approvedForReleaseAt?:string;release?:DisbursementRelease;reconciliation?:DisbursementReconciliation;
 timeline:DisbursementTimeline[];
}
export interface DisbursementDraftFields {
 requestDate:string;branch:BranchId;category:string;purpose:string;amount:number;attachments:Receipt[];remarks:string;
}
export const DISBURSEMENT_CATEGORIES = [
 'Parts Purchasing','Petty Cash Replenishment','Operating Expense','Supplier Payment',
 'Staff Reimbursement','Transportation','Emergency Expense','Other'
] as const;
const clock=()=>new Date().toISOString();
const requests=(db:Database):DisbursementRequest[]=>db.disbursementRequests||[];
export function isDisbursementCreator(u?:User):u is User & {role:DisbursementRequestorRole} {return !!u?.active&&(u.role==='cashier'||u.role==='pb');}
function requireOwner(request:DisbursementRequest,u:User){
 if(!isDisbursementCreator(u)||request.requestorId!==u.id||(u.role==='cashier'&&request.branch!==u.branch))throw new Error('Only the assigned active requester may change this request in an authorized branch.');
}
function validateFields(fields:DisbursementDraftFields,u:User){
 if(!isDisbursementCreator(u))throw new Error('Only Cashier or Parts Buyer may create a disbursement request.');
 if(!BRANCHES.some(b=>b.id===fields.branch)||(u.role==='cashier'&&fields.branch!==u.branch))throw new Error('Select your assigned branch (or a valid PB branch).');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.requestDate)||Number.isNaN(Date.parse(fields.requestDate)))throw new Error('Enter a valid request date.');
 if(!fields.category.trim())throw new Error('Select a disbursement category.');
 if(fields.purpose.trim().length<5)throw new Error('Purpose must have at least five characters.');
 if(!Number.isFinite(fields.amount)||fields.amount<=0||Math.abs(Math.round(fields.amount*100)-fields.amount*100)>0.000001)throw new Error('Enter a positive PHP amount with up to two decimal places.');
 if(!Array.isArray(fields.attachments)||fields.attachments.length>5||fields.attachments.some(a=>!a?.name||!a?.data||a.data.length>1_500_000||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/i.test(a.data)))throw new Error('Upload up to five attachments, max roughly 1 MB each.');
}
function timeline(r:DisbursementRequest,u:User,action:string,to:DisbursementStatus,remarks='',changes?:DisbursementTimeline['changes']):DisbursementTimeline{
 return {id:uid(),at:clock(),actorId:u.id,actorRole:u.role,branch:r.branch,action,from:r.status,to,remarks:remarks.trim(),changes,origin:'cms'};
}
function audit(db:Database,r:DisbursementRequest,u:User,action:string,description:string){
 return log(db,u.id,`Disbursement: ${action}`,`${r.requestNo} · ${BRANCH_NAME(r.branch)} · ${u.role} · ${description}`);
}
function nextNo(db:Database,branch:BranchId){
 // Stable, globally unique even with deleted drafts and different branches; not a reused sequence.
 let id='';do{id=`DR-${branch}-${todayPH().replace(/-/g,'')}-${uid().replace(/-/g,'').slice(0,12).toUpperCase()}`;}while(requests(db).some(r=>r.requestNo===id));return id;
}
export function createDisbursementDraft(db:Database,u:User,fields:DisbursementDraftFields):Database {
 validateFields(fields,u);const at=clock();const r:DisbursementRequest={
  id:uid(),requestNo:nextNo(db,fields.branch),schemaVersion:1,requestDate:fields.requestDate,
  requestorId:u.id,requestorName:u.name,employeeId:u.id,requestorRole:u.role as DisbursementRequestorRole,
  branch:fields.branch,category:fields.category.trim(),purpose:fields.purpose.trim(),amount:fields.amount,
  attachments:[...fields.attachments],remarks:fields.remarks.trim(),status:'Draft',revision:1,createdAt:at,updatedAt:at,timeline:[]
 };
 r.timeline=[timeline(r,u,'Draft created','Draft','New request')];
 return audit({...db,disbursementRequests:[r,...requests(db)]},r,u,'Draft created',`Amount PHP ${r.amount.toFixed(2)} · ${r.category}`);
}
export function editDisbursementDraft(db:Database,id:string,u:User,fields:DisbursementDraftFields):Database {
 const r=requests(db).find(x=>x.id===id);if(!r)throw new Error('Request not found.');requireOwner(r,u);
 if(!['Draft','Returned by Accounting','Returned by Ms Kate'].includes(r.status))throw new Error('Submitted, approved, rejected or released requests cannot be edited.');
 validateFields(fields,u);
 // Existing request branch is immutable; changing branches requires a new request.
 if(fields.branch!==r.branch)throw new Error('Request branch cannot be changed after creation. Create a new draft for another branch.');
 const changes:NonNullable<DisbursementTimeline['changes']>={};
 for(const key of ['requestDate','category','purpose','amount','remarks'] as const){const before=r[key],after=(typeof fields[key]==='string'?fields[key].trim():fields[key]);if(before!==after)changes[key]={before,after};}
 if(r.attachments.length!==fields.attachments.length||r.attachments.some((a,i)=>a.name!==fields.attachments[i]?.name||a.data!==fields.attachments[i]?.data))changes.attachments={before:r.attachments.map(x=>x.name),after:fields.attachments.map(x=>x.name)};
 if(!Object.keys(changes).length)return db;
 const at=clock();const changed:DisbursementRequest={...r,requestDate:fields.requestDate,category:fields.category.trim(),purpose:fields.purpose.trim(),amount:fields.amount,attachments:[...fields.attachments],remarks:fields.remarks.trim(),revision:r.revision+1,updatedAt:at,
  // Keep the external return reason visible while being edited; reset prior approvals on resubmission.
  timeline:[...r.timeline,timeline(r,u,'Draft revised',r.status,`Revision ${r.revision+1}`,changes)]};
 return audit({...db,disbursementRequests:requests(db).map(x=>x.id===id?changed:x)},r,u,'Draft revised',`rev ${changed.revision}; fields ${Object.keys(changes).join(', ')}; before/after recorded in request timeline`);
}
export function submitDisbursementRequest(db:Database,id:string,u:User):Database {
 const r=requests(db).find(x=>x.id===id);if(!r)throw new Error('Request not found.');requireOwner(r,u);
 if(!['Draft','Returned by Accounting','Returned by Ms Kate'].includes(r.status))throw new Error('Only draft or returned requests may be submitted.');
 if(r.sourceMode!=='generated')validateFields({requestDate:r.requestDate,branch:r.branch,category:r.category,purpose:r.purpose,amount:r.amount,attachments:r.attachments,remarks:r.remarks},u);
 if(r.sourceMode==='generated'){
  const sourceIds=r.sourceExpenseIds||[];
  const available=eligibleFundExpenses(db,u,r.sourceFund||'RF',r.id);
  if(!sourceIds.length||sourceIds.length!==available.length||sourceIds.some(id=>!available.some(e=>e.id===id)))throw new Error('New or changed eligible expenses were found. Refresh the automatic draft before submission so the cycle remains complete.');
  const snapshot=makeGeneratedSnapshot(db,sourceIds,r.sourceFund||'RF');
  if(snapshot.amount!==r.amount||snapshot.lines.some((line,i)=>line.total!==r.sourceLines?.[i]?.total||line.sourceId!==r.sourceLines?.[i]?.sourceId||line.receiptName!==r.sourceLines?.[i]?.receiptName))throw new Error('An expense amount or payment charge changed. Reopen and save the regenerated draft before submission.');
 }
 if(r.status.startsWith('Returned')){
  const lastReturn=r.timeline.map((t,i)=>({t,i})).filter(x=>x.t.to===r.status&&x.t.origin==='external').pop();
  const hadCorrections=r.timeline.some((t,i)=>(t.action==='Draft revised'||t.action==='Generated draft revised')&&(!lastReturn||i>lastReturn.i));
  if(!hadCorrections)throw new Error('Edit and save corrections before resubmitting a returned request.');
 }
 const at=clock();const changed:DisbursementRequest={...r,status:'Pending Accounting Approval',updatedAt:at,submittedAt:at,
  accounting:undefined,msKate:undefined,approvedForReleaseAt:undefined,
  timeline:[...r.timeline,timeline(r,u,r.status==='Draft'?'Submitted':'Corrections resubmitted','Pending Accounting Approval','Awaiting real Accounting verification')]};
 return audit({...db,disbursementRequests:requests(db).map(x=>x.id===id?changed:x)},r,u,changed.timeline[changed.timeline.length-1].action,`${r.status} → Pending Accounting Approval · PHP ${r.amount.toFixed(2)}`);
}
/** Read-only external stage predicates for a FUTURE trusted shared-database adapter.
 * CMS has NO external approval, payment or reconciliation mutation control. */
export function releaseEligible(r:DisbursementRequest):boolean{
 return r.status==='Approved for Release'&&r.accounting?.state==='Approved'&&r.accounting.origin==='external'&&r.msKate?.state==='Approved'&&r.msKate.origin==='external'&&!!r.approvedForReleaseAt&&!r.release;
}
export function externallyConsistent(r:DisbursementRequest):boolean{
 if(['Pending Ms Kate Approval','Returned by Ms Kate','Rejected by Ms Kate','Approved for Release','Released / Paid','Reconciled'].includes(r.status)&&r.accounting?.state!=='Approved')return false;
 if(['Approved for Release','Released / Paid','Reconciled'].includes(r.status)&&r.msKate?.state!=='Approved')return false;
 if(['Released / Paid','Reconciled'].includes(r.status)&&(!r.release||!r.approvedForReleaseAt))return false;
 if(r.status==='Reconciled'&&!r.reconciliation)return false;
 return true;
}
export function visibleDisbursements(db:Database,u:User,adminBranch:BranchId|'ALL'='ALL'){
 return requests(db).filter(r=>u.role==='admin'?(adminBranch==='ALL'||(r.sourceBranches||[r.branch]).includes(adminBranch)):(r.requestorId===u.id&&(u.role==='pb'||r.branch===u.branch)));
}


/** Actual expense ledger is the only amount source; "Disbursement Request" never asks the user to type totals. */
/** A cycle closes only when a trusted release record exists. Older Approved RF/RFP
 * replenishments are retained as a *legacy accounting boundary* when a later,
 * actually paid CMS disbursement is not yet available. Submitted/approved-but-
 * unpaid requests never advance the boundary. All timestamps are UTC ISO and
 * compared to the existing source expense's createdAt.
 */
export function coverageCutoffs(db:Database,fund:Fund):Record<BranchId,{at:string;source:string}>{
 const result={} as Record<BranchId,{at:string;source:string}>;
 for(const b of BRANCHES){
  const paid=requests(db).filter(r=>r.sourceMode==='generated'&&r.sourceFund===fund&&
   (r.status==='Released / Paid'||r.status==='Reconciled')&&!!r.release?.recordedAt&&
   (fund==='RFP'||(r.sourceBranches||[r.branch]).includes(b.id)))
   .sort((a,c)=>(c.release?.recordedAt||'').localeCompare(a.release?.recordedAt||''))[0];
  const legacy=db.fundEntries.filter(e=>e.branch===b.id&&e.fund===fund&&e.kind==='replenishment'&&e.status==='Approved')
   .sort((a,c)=>c.createdAt.localeCompare(a.createdAt))[0];
  const paidAt=paid?.release?.recordedAt||'';
  // Never treat an approval without an actual release as paid. Legacy records
  // remain labeled clearly until the shared ledger can confirm their release.
  result[b.id]=paidAt&&paidAt>=(legacy?.createdAt||'')?{at:paidAt,source:'Recorded release'}:
   legacy?{at:legacy.createdAt,source:'Legacy approved replenishment (unverified release)'}:{at:'',source:'No prior recorded release'};
 }
 return result;
}
/** Expense collection is automatic, never a user-selected subset. Rejected and
 * source-ledger records needing explanation remain unavailable. */
export function eligibleFundExpenses(db:Database,u:User,fund:Fund,editingRequestId?:string):FundEntry[]{
 if(!isDisbursementCreator(u)||fund!==(u.role==='pb'?'RFP':'RF'))return [];
 const reserved=new Set(requests(db).filter(r=>r.id!==editingRequestId&&r.sourceMode==='generated'&&
  !['Rejected by Accounting','Rejected by Ms Kate'].includes(r.status)).flatMap(r=>r.sourceExpenseIds||[]));
 const cutoffs=coverageCutoffs(db,fund);
 const alreadyPaid=new Set(requests(db).filter(r=>r.sourceFund===fund&&(r.status==='Released / Paid'||r.status==='Reconciled')&&!!r.release?.recordedAt).flatMap(r=>r.sourceExpenseIds||[]));
 const branchIsInLegacyPending=new Set(db.fundEntries.filter(e=>e.kind==='replenishment'&&e.fund===fund&&e.status==='Pending').map(e=>e.branch));
 return db.fundEntries.filter(e=>e.kind==='expense'&&e.fund===fund&&!['Rejected','Report Required','Report Submitted'].includes(e.status)&&
  !(u.role==='cashier'&&e.branch!==u.branch)&&!branchIsInLegacyPending.has(e.branch)&&
  !alreadyPaid.has(e.id)&&(cutoffs[e.branch].source==='Recorded release'||e.createdAt>cutoffs[e.branch].at)&&!reserved.has(e.id))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.no.localeCompare(b.no));
}
/** Enforce a single active generated cycle for PB RFP (all branches), or for the
 * assigned Cashier RF branch; history and rejected cycles remain readable. */
export function activeDisbursementCycle(db:Database,u:User,fund:Fund):DisbursementRequest|undefined{
 return requests(db).filter(r=>r.sourceMode==='generated'&&r.sourceFund===fund&&
  !['Rejected by Accounting','Rejected by Ms Kate','Released / Paid','Reconciled'].includes(r.status)&&
  (u.role==='pb'||r.branch===u.branch)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
}
export function makeGeneratedSnapshot(db:Database,ids:string[],fund:Fund){
 const idset=new Set(ids);
 const lines:GeneratedDisbursementLine[]=db.fundEntries.filter(e=>idset.has(e.id)&&e.fund===fund&&e.kind==='expense')
  .sort((a,b)=>a.date.localeCompare(b.date)||a.no.localeCompare(b.no)||a.id.localeCompare(b.id))
  .map(e=>({sourceId:e.id,reference:e.no,date:e.date,branch:e.branch,amount:e.amount,onlineCharge:e.onlineCharge||0,total:expenseGross(e),remarks:e.plate?`Car (${e.plate}) · ${e.description}`:e.description||e.notes||e.category,receiptNo:e.receiptNo,status:e.status,receiptName:e.proof?.name}));
 const amount=Math.round(lines.reduce((sum,l)=>sum+l.total,0)*100)/100;
 // Receipts stay in the original FundEntry; request snapshots store stable source IDs + names, not duplicated base64.
 const attachments:Receipt[]=[];
 const branches=BRANCHES.map(b=>b.id).filter(b=>lines.some(l=>l.branch===b));
 const sourceBalances:NonNullable<DisbursementRequest['sourceBalances']>={};
 for(const branch of (fund==='RFP'?BRANCHES.map(b=>b.id):branches)){
  const expenses=Math.round(lines.filter(l=>l.branch===branch).reduce((sum,l)=>sum+l.total,0)*100)/100;
  const remaining=balance(db,branch,fund);
  sourceBalances[branch]={fundBalance:Math.round((remaining+expenses)*100)/100,expenses,remaining};
 }
 return {lines,amount,attachments,branches,sourceBalances};
}
function validateSourceSelection(db:Database,u:User,fund:Fund,ids:string[],editingRequestId?:string){
 if(!isDisbursementCreator(u))throw new Error('Only active Cashier/PB accounts can prepare requests.');
 if(fund!==(u.role==='pb'?'RFP':'RF'))throw new Error('The request fund must match your assigned role.');
 if(!ids.length||new Set(ids).size!==ids.length)throw new Error('An automatic disbursement needs one or more distinct recorded expenses.');
 const eligible=eligibleFundExpenses(db,u,fund,editingRequestId).map(e=>e.id);
 if(ids.length!==eligible.length||eligible.some(id=>!ids.includes(id))){
  throw new Error('Disbursements must contain all eligible source expenses in the current cycle; manual selection is unavailable or reserved. Refresh the automatic review.');
 }
 const snapshot=makeGeneratedSnapshot(db,eligible,fund);
 if(snapshot.lines.length!==eligible.length||snapshot.amount<=0)throw new Error('No valid source expenses are available for this cycle.');
 return snapshot;
}
/** Canonical request generation: include ALL eligible rows, no manual item picking. */
export function createAutomaticDisbursement(db:Database,u:User,fund:Fund,remarks=''):Database{
 if(activeDisbursementCycle(db,u,fund))throw new Error('An active disbursement cycle already exists. Open that request to review or revise it.');
 return createGeneratedDisbursement(db,u,fund,eligibleFundExpenses(db,u,fund).map(e=>e.id),remarks);
}
export function refreshAutomaticDisbursement(db:Database,id:string,u:User,remarks:string):Database{
 const r=requests(db).find(item=>item.id===id);
 if(!r||r.sourceMode!=='generated')throw new Error('Generated request not found.');
 return reviseGeneratedDisbursement(db,id,u,eligibleFundExpenses(db,u,r.sourceFund||'RF',id).map(e=>e.id),remarks);
}
/** Resolve read-only receipt links on demand. Keep PDF/image bytes in the original expense record only. */
export function resolvedRequestReceipts(db:Database,r:Pick<DisbursementRequest,'sourceMode'|'sourceExpenseIds'|'attachments'>):Receipt[]{
 if(r.sourceMode!=='generated')return r.attachments||[];
 const seen=new Set<string>();const result:Receipt[]=[];
 for(const id of r.sourceExpenseIds||[]){const proof=db.fundEntries.find(e=>e.id===id)?.proof;if(!proof)continue;const key=`${proof.name}:${proof.data}`;if(!seen.has(key)){seen.add(key);result.push(proof);}}
 return result;
}
export function createGeneratedDisbursement(db:Database,u:User,fund:Fund,ids:string[],remarks=''):Database{
 if(isDisbursementCreator(u)&&activeDisbursementCycle(db,u,fund))throw new Error('Unavailable: another disbursement cycle is active or has reserved these expenses.');
 const s=validateSourceSelection(db,u,fund,ids);const branch=u.role==='cashier'?u.branch:(s.branches[0]||u.branch),at=clock();
 const r:DisbursementRequest={id:uid(),requestNo:nextNo(db,branch),schemaVersion:1,requestDate:todayPH(),requestorId:u.id,requestorName:u.name,employeeId:u.id,requestorRole:u.role as DisbursementRequestorRole,branch,category:fund==='RFP'?'Parts Fund Replenishment':'Revolving Fund Replenishment',purpose:`Replenish ${s.lines.length} recorded ${fund} expense(s)`,amount:s.amount,attachments:s.attachments,remarks:remarks.trim(),status:'Draft',revision:1,createdAt:at,updatedAt:at,sourceMode:'generated',sourceFund:fund,sourceExpenseIds:[...ids],sourceLines:s.lines,sourceBranches:s.branches,sourceBalances:s.sourceBalances,coverageCutoffs:coverageCutoffs(db,fund),coverageUntil:at,timeline:[]};
 r.timeline=[timeline(r,u,'Auto-generated from recorded expenses','Draft',`${ids.length} source ledger rows; source amounts and receipts copied as a review snapshot`)];
 return audit({...db,disbursementRequests:[r,...requests(db)]},r,u,'Auto-generated',`${ids.length} ${fund} expenses · PHP ${r.amount.toFixed(2)} · no financial posting`);
}
export function reviseGeneratedDisbursement(db:Database,id:string,u:User,ids:string[],remarks:string):Database{
 const r=requests(db).find(x=>x.id===id);if(!r||r.sourceMode!=='generated')throw new Error('Generated request not found.');
 requireOwner(r,u);
 if(!['Draft','Returned by Accounting','Returned by Ms Kate'].includes(r.status))throw new Error('Request is locked.');
 const fund=r.sourceFund||'RF',s=validateSourceSelection(db,u,fund,ids,id);
 const changes:NonNullable<DisbursementTimeline['changes']>={};
 if(r.amount!==s.amount)changes.amount={before:r.amount,after:s.amount};
 if(JSON.stringify(r.sourceExpenseIds)!==JSON.stringify(ids))changes.sourceExpenseIds={before:r.sourceExpenseIds||[],after:ids};
 if(r.remarks!==remarks.trim())changes.remarks={before:r.remarks,after:remarks.trim()};
 if(JSON.stringify(r.sourceLines)!==JSON.stringify(s.lines))changes.sourceSnapshot={before:r.sourceLines?.map(x=>({id:x.sourceId,total:x.total})),after:s.lines.map(x=>({id:x.sourceId,total:x.total}))};
 if(!Object.keys(changes).length)return db;
 const changed:DisbursementRequest={...r,amount:s.amount,attachments:s.attachments,remarks:remarks.trim(),sourceExpenseIds:[...ids],sourceLines:s.lines,sourceBranches:s.branches,sourceBalances:s.sourceBalances,coverageCutoffs:coverageCutoffs(db,fund),coverageUntil:clock(),revision:r.revision+1,updatedAt:clock(),timeline:[...r.timeline,timeline(r,u,'Generated draft revised',r.status,`Source-ledger revision ${r.revision+1}`,changes)]};
 return audit({...db,disbursementRequests:requests(db).map(x=>x.id===id?changed:x)},r,u,'Generated draft revised',`Revision ${changed.revision} · source expenses ${ids.length}`);
}
