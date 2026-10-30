import {log,paidTotal,posTotal,todayPH,uid,type BranchId,type Database,type POSPayment,type TerminalEvent,type TerminalSettlement,type User} from './data';
import {costReviewIssues} from './pos-cogs-review';

export type TerminalMode = Exclude<POSPayment['mode'],'Cash'>;
export type TerminalEventKind = TerminalEvent['kind'];
export const TERMINAL_MODES:TerminalMode[]=['Card','GCash','Bank Transfer'];
export const terminalEvents=(db:Database):TerminalEvent[]=>db.terminalEvents||[];
export const terminalSettlements=(db:Database):TerminalSettlement[]=>db.terminalSettlements||[];
const two=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const clean=(s:string)=>s.trim().replace(/\s+/g,' ');
const key=(s:string)=>clean(s).toUpperCase();
const validDate=(s:string)=>/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)&&!Number.isNaN(new Date(`${s}T12:00:00Z`).valueOf())&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
const amountCheck=(amount:number)=>{if(!Number.isFinite(amount)||amount<=0||Math.abs(two(amount)-amount)>0.000001)throw new Error('Enter a positive peso amount with at most two decimals.');return two(amount)};
function cashier(db:Database,userId:string):User {const u=db.users.find(x=>x.id===userId&&x.active);if(!u||u.role!=='cashier')throw new Error('Only an active Cashier can record terminal activity.');return u}
function admin(db:Database,userId:string):User{const u=db.users.find(x=>x.id===userId&&x.active);if(!u||u.role!=='admin')throw new Error('Only an active Admin can review terminal reconciliation.');return u}
export interface TerminalDetails {mode:TerminalMode;terminalId:string;provider:string;reference:string;date:string;amount:number;notes?:string;}
function validateDetails(db:Database,branch:BranchId,input:TerminalDetails){
 if(!TERMINAL_MODES.includes(input.mode))throw new Error('Choose a supported terminal/digital payment method.');
 const provider=clean(input.provider),terminalId=clean(input.terminalId),reference=clean(input.reference);
 if(provider.length<2||terminalId.length<2||reference.length<4)throw new Error('Provider, terminal/device ID and receipt reference (4+ characters) are required.');
 if(provider.length>80||terminalId.length>80||reference.length>100)throw new Error('Terminal details are too long.');
 if(!validDate(input.date))throw new Error('Enter a valid transaction date.');
 const amount=amountCheck(input.amount);
 if(terminalEvents(db).some(e=>e.branch===branch&&key(e.provider)===key(provider)&&key(e.reference)===key(reference)))throw new Error('Duplicate terminal reference for this branch and provider. Review the existing transaction instead.');
 return {provider,terminalId,reference,amount};
}
/** A successful POS terminal payment must be recorded atomically with its traceable terminal receipt.
 * Unmatched/manual terminal activity never increases the POS paid amount. */
export function recordPOSPayment(db:Database,posId:string,mode:POSPayment['mode'],amount:number,userId:string,details?:Omit<TerminalDetails,'mode'|'amount'>):Database{
 const u=cashier(db,userId),pos=db.pos.find(p=>p.id===posId);
 if(!pos||pos.branch!==u.branch||pos.status!=='Pending')throw new Error('Payments require an open POS in your own branch.');
 const value=amountCheck(amount),remaining=two(posTotal(pos)-paidTotal(pos));
 const isInitialDownpayment=pos.quotationPhase==='Initial'&&pos.payments.length===0&&!pos.cogsReviewedAt&&value<remaining-0.004;
 if(!isInitialDownpayment&&(pos.quotationPhase==='Initial'||!pos.cogsReviewedAt||costReviewIssues(pos.items).length))throw new Error('Complete Final Quotation and COGS Review before additional or full payment. Only the initial partial downpayment may bypass costing.');
 if(value>remaining+0.000001)throw new Error(`Payment exceeds the remaining POS balance (₱${remaining.toFixed(2)}).`);
 let event:TerminalEvent|undefined;
 const payment:POSPayment={id:uid(),mode,amount:value,date:details?.date||todayPH()};
 if(mode!=='Cash'){
  if(!details)throw new Error('Terminal/provider, receipt reference and transaction date are required for digital payments.');
  const checked=validateDetails(db,u.branch,{...details,mode,amount:value});
  Object.assign(payment,{terminalId:checked.terminalId,provider:checked.provider,reference:checked.reference});
  event={id:uid(),branch:u.branch,mode,kind:'Payment',...checked,date:details.date,notes:clean(details.notes||''),posId:pos.id,paymentId:payment.id,createdBy:userId,createdAt:new Date().toISOString()};
 }
 let next:Database={...db,pos:db.pos.map(p=>p.id===posId?{...p,payments:[...p.payments,payment]}:p)};
 if(event)next={...next,terminalEvents:[event,...terminalEvents(db)]};
 return log(next,userId,'POS payment recorded',`${pos.no} · ${mode} · ${value.toFixed(2)}${event?` · ${event.provider} · ${event.reference}`:''}`);
}
export function recordTerminalEvent(db:Database,input:TerminalDetails&{kind:TerminalEventKind;originalReference?:string},userId:string):Database{
 const u=cashier(db,userId),checked=validateDetails(db,u.branch,input),notes=clean(input.notes||'');
 if(input.kind!=='Payment'&&input.kind!=='Declined'&&input.kind!=='Void'&&input.kind!=='Refund')throw new Error('Unsupported terminal transaction type.');
 let originalId:string|undefined;
 if(input.kind==='Void'||input.kind==='Refund'){
  const original=terminalEvents(db).find(e=>e.branch===u.branch&&e.kind==='Payment'&&key(e.provider)===key(checked.provider)&&key(e.reference)===key(input.originalReference||''));
  if(!original||key(original.terminalId)!==key(checked.terminalId)||original.mode!==input.mode)throw new Error('Find the original captured payment on the same terminal before recording a reversal.');
  const reversed=two(terminalEvents(db).filter(e=>e.originalEventId===original.id&&(e.kind==='Void'||e.kind==='Refund')).reduce((n,e)=>n+e.amount,0));
  if(checked.amount>two(original.amount-reversed))throw new Error('Void/refund exceeds the remaining unreversed original transaction.');
  originalId=original.id;
 }
 if(input.kind!=='Payment'&&!notes)throw new Error('Explain the declined, voided or refunded transaction.');
 const event:TerminalEvent={id:uid(),branch:u.branch,mode:input.mode,kind:input.kind,...checked,date:input.date,notes,posId:undefined,paymentId:undefined,originalEventId:originalId,createdBy:userId,createdAt:new Date().toISOString()};
 return log({...db,terminalEvents:[event,...terminalEvents(db)]},userId,'Terminal event recorded',`${input.kind} · ${event.mode} · ${event.provider} · ${event.reference} · ${event.amount.toFixed(2)} (terminal only; no POS adjustment)`);
}
/** Older digital POS payments are preserved. A cashier can attach actual receipt metadata
 * to the same historical payment without changing its amount or duplicating revenue. */
export function backfillTerminalPayment(db:Database,posId:string,paymentId:string,details:Omit<TerminalDetails,'mode'|'amount'>,userId:string):Database{
 const u=cashier(db,userId),pos=db.pos.find(p=>p.id===posId),payment=pos?.payments.find(p=>p.id===paymentId);
 if(!pos||pos.branch!==u.branch||!payment||payment.mode==='Cash')throw new Error('Choose a digital POS payment in your own branch.');
 if(terminalEvents(db).some(e=>e.paymentId===paymentId)||payment.reference)throw new Error('This POS payment is already linked to a terminal reference.');
 const checked=validateDetails(db,u.branch,{...details,mode:payment.mode,amount:payment.amount});
 const event:TerminalEvent={id:uid(),branch:u.branch,mode:payment.mode,kind:'Payment',...checked,date:details.date,notes:clean(details.notes||''),posId,paymentId,createdAt:new Date().toISOString(),createdBy:userId};
 return log({...db,pos:db.pos.map(p=>p.id!==posId?p:{...p,payments:p.payments.map(pm=>pm.id!==paymentId?pm:{...pm,provider:checked.provider,terminalId:checked.terminalId,reference:checked.reference})}),terminalEvents:[event,...terminalEvents(db)]},userId,'Legacy POS terminal receipt linked',`${pos.no} · ${event.provider} · ${event.reference}`);
}
/** Match an unmatched approved terminal event to an open POS, reusing its original
 * reference instead of inventing a second terminal event. Cashier confirms the sale. */
export function linkUnmatchedTerminalToOpenPOS(db:Database,eventId:string,posId:string,userId:string):Database{
 const u=cashier(db,userId),event=terminalEvents(db).find(e=>e.id===eventId),pos=db.pos.find(p=>p.id===posId);
 if(!event||event.kind!=='Payment'||event.paymentId||event.branch!==u.branch)throw new Error('Choose an unmatched approved terminal payment for your branch.');
 if(!pos||pos.status!=='Pending'||pos.branch!==u.branch)throw new Error('Choose a matching open POS in the same branch.');
 if(pos.quotationPhase==='Initial'||!pos.cogsReviewedAt||costReviewIssues(pos.items).length)throw new Error('Unmatched terminal payments cannot be linked until Final Quotation and COGS Review are approved.');
 const remaining=two(posTotal(pos)-paidTotal(pos));
 if(event.amount>remaining+0.000001)throw new Error('Terminal payment exceeds the remaining POS balance.');
 const payment:POSPayment={id:uid(),mode:event.mode,amount:event.amount,date:event.date,provider:event.provider,terminalId:event.terminalId,reference:event.reference};
 return log({...db,pos:db.pos.map(p=>p.id===posId?{...p,payments:[...p.payments,payment]}:p),terminalEvents:terminalEvents(db).map(e=>e.id===eventId?{...e,posId,paymentId:payment.id}:e)},userId,'Unmatched terminal payment linked to POS',`${pos.no} · ${event.provider} · ${event.reference} · ${event.amount.toFixed(2)}`);
}
/** Attach a manually captured terminal event to a matching legacy digital payment.
 * Existing sales totals and the existing POS payment are unchanged. */
export function linkUnmatchedTerminalToLegacy(db:Database,eventId:string,posId:string,paymentId:string,userId:string):Database{
 const u=cashier(db,userId),event=terminalEvents(db).find(e=>e.id===eventId),pos=db.pos.find(p=>p.id===posId),payment=pos?.payments.find(p=>p.id===paymentId);
 if(!event||event.kind!=='Payment'||event.paymentId||event.branch!==u.branch||!pos||pos.branch!==u.branch||!payment||payment.mode==='Cash')throw new Error('Select an unmatched receipt and digital POS payment in your branch.');
 if(payment.mode!==event.mode||two(payment.amount)!==two(event.amount))throw new Error('Payment method and amount must exactly match the terminal receipt.');
 if(terminalEvents(db).some(e=>e.paymentId===payment.id)||payment.reference)throw new Error('The POS payment already has a recorded terminal reference.');
 return log({...db,pos:db.pos.map(p=>p.id!==posId?p:{...p,payments:p.payments.map(pm=>pm.id!==paymentId?pm:{...pm,provider:event.provider,terminalId:event.terminalId,reference:event.reference})}),terminalEvents:terminalEvents(db).map(e=>e.id===eventId?{...e,posId,paymentId}:e)},userId,'Existing terminal receipt matched to legacy POS payment',`${pos.no} · ${event.reference}`);
}
export function legacyUntrackedPayments(db:Database,branch:BranchId|'ALL'='ALL'){
 const linked=new Set(terminalEvents(db).filter(e=>e.paymentId).map(e=>e.paymentId));
 return db.pos.filter(p=>branch==='ALL'||p.branch===branch).flatMap(p=>p.payments.filter(pay=>pay.mode!=='Cash'&&!linked.has(pay.id)).map(payment=>({pos:p,payment})));
}
export function terminalDaySummary(db:Database,branch:BranchId,date:string,provider:string,terminalId:string){
 const rows=terminalEvents(db).filter(e=>e.branch===branch&&e.date===date&&key(e.provider)===key(provider)&&key(e.terminalId)===key(terminalId));
 const captured=two(rows.filter(e=>e.kind==='Payment').reduce((n,e)=>n+e.amount,0));
 const adjustments=two(rows.filter(e=>e.kind==='Void'||e.kind==='Refund').reduce((n,e)=>n+e.amount,0));
 const unmatched=rows.filter(e=>e.kind==='Payment'&&!e.paymentId).length;
 const exceptions=rows.filter(e=>e.kind!=='Payment').length;
 return {rows,captured,adjustments,expected:two(captured-adjustments),unmatched,exceptions};
}
export function submitTerminalSettlement(db:Database,input:{date:string;provider:string;terminalId:string;batchRef:string;reportedTotal:number;notes:string},userId:string):Database{
 const u=cashier(db,userId),provider=clean(input.provider),terminalId=clean(input.terminalId),batchRef=clean(input.batchRef),notes=clean(input.notes||'');
 if(!validDate(input.date)||provider.length<2||terminalId.length<2||batchRef.length<3)throw new Error('Complete settlement date, provider, terminal and batch reference.');
 if(!Number.isFinite(input.reportedTotal)||Math.abs(two(input.reportedTotal)-input.reportedTotal)>0.000001)throw new Error('Settled total must be a valid amount with at most two decimals.');
 const latest=terminalSettlements(db).filter(s=>s.branch===u.branch&&s.date===input.date&&key(s.provider)===key(provider)&&key(s.terminalId)===key(terminalId)).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt))[0];
 if(latest&&latest.status!=='Flagged')throw new Error('This terminal/date has a pending or verified batch. A revised batch is allowed only after Admin flags the original.');
 if(terminalSettlements(db).some(s=>s.branch===u.branch&&key(s.provider)===key(provider)&&key(s.batchRef)===key(batchRef)))throw new Error('Duplicate settlement batch reference.');
 const summary=terminalDaySummary(db,u.branch,input.date,provider,terminalId);
 if(!summary.rows.length)throw new Error('No terminal transactions for the selected date and terminal.');
 const reportedTotal=two(input.reportedTotal),variance=two(reportedTotal-summary.expected);
 const settlement:TerminalSettlement={id:uid(),branch:u.branch,date:input.date,provider,terminalId,batchRef,expected:summary.expected,reportedTotal,variance,unmatchedAtSubmission:summary.unmatched,exceptionCountAtSubmission:summary.exceptions,notes,recordedBy:userId,recordedAt:new Date().toISOString(),status:'Pending',supersedesId:latest?.id};
 return log({...db,terminalSettlements:[settlement,...terminalSettlements(db)]},userId,'Terminal batch submitted',`${u.branch} · ${provider}/${terminalId} · ${batchRef} · variance ${variance.toFixed(2)}`);
}
export function reviewTerminalSettlement(db:Database,id:string,decision:'Verified'|'Flagged',notes:string,adminId:string):Database{
 const u=admin(db,adminId),s=terminalSettlements(db).find(s=>s.id===id);
 if(!s||s.status!=='Pending')throw new Error('Settlement is unavailable or already reviewed.');
 if(s.recordedBy===u.id)throw new Error('You cannot approve a settlement you submitted.');
 const reason=clean(notes);
 if(reason.length<8)throw new Error('Admin verification notes must contain at least 8 characters.');
 const latest=terminalDaySummary(db,s.branch,s.date,s.provider,s.terminalId);
 if(decision==='Verified'&&(s.variance!==0||s.unmatchedAtSubmission>0||s.exceptionCountAtSubmission>0||latest.expected!==s.expected||latest.unmatched!==0||latest.exceptions!==0||legacyUntrackedPayments(db,s.branch).some(x=>x.payment.date===s.date)))throw new Error('Batch is mismatched, has untracked historical payments, contains exceptions, or changed after submission. Flag this batch for investigation.');
 const updated=terminalSettlements(db).map(row=>row.id!==id?row:{...row,status:decision,reviewedBy:u.id,reviewedAt:new Date().toISOString(),reviewNotes:reason});
 return log({...db,terminalSettlements:updated},u.id,`Terminal batch ${decision.toLowerCase()}`,`${s.batchRef} · ${s.branch} · ${reason}`);
}
export function validateTerminalStore(db:Database):boolean{return Array.isArray(db.terminalEvents)&&Array.isArray(db.terminalSettlements)}
