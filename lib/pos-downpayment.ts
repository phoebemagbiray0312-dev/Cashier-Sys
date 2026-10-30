import {paidTotal,posTotal,log,type Database,type POS,type POSPayment} from './data';
import {saveUnitPOSDraft} from './pos-draft-control';
import {recordPOSPayment,type TerminalDetails} from './terminal';

/** A paid-in-advance quotation may be saved before cost review. ONLY its first
 * partial payment can bypass review; the final payment/closure never can. */
export function recordInitialDownpayment(db:Database,candidate:POS,by:string,mode:POSPayment['mode'],amount:number,details?:Omit<TerminalDetails,'mode'|'amount'>):{db:Database;pos:POS}{
 if(candidate.payments.length||candidate.cogsReviewedAt||candidate.status!=='Pending')throw new Error('The first downpayment must be on an unreviewed, unpaid quotation.');
 const initialTotal=posTotal(candidate);
 if(!candidate.items.length||initialTotal<=0)throw new Error('Enter valid quotation lines before accepting downpayment.');
 if(!Number.isFinite(amount)||amount<=0||amount>=initialTotal-0.004)throw new Error('Downpayment must be positive and LESS than the quotation total. Use the regular COGS-first flow to collect full payment.');
 const first:POS={...candidate,quotationPhase:'Initial',cogsReviewedAt:undefined,cogsReviewedBy:undefined,firstQuotation:{items:candidate.items.map(l=>({...l,proof:l.proof&&{...l.proof}})),saleTotal:initialTotal,savedAt:new Date().toISOString(),savedBy:by}};
 const saved=saveUnitPOSDraft(db,first,by);
 if(!saved.created)throw new Error('This vehicle already has a draft. Open its current POS instead of collecting a duplicate first downpayment.');
 const next=recordPOSPayment(saved.db,saved.pos.id,mode,amount,by,details);
 const latest=next.pos.find(p=>p.id===saved.pos.id)!;
 return {db:log(next,by,'Downpayment accepted; COGS deferred',`${latest.no} · original quotation ₱${initialTotal.toFixed(2)} · paid ₱${paidTotal(latest).toFixed(2)} · final quotation and COGS required before balance payment`),pos:latest};
}
/** Distinguish true downpayment-stage drafts from older/regular POS. */
export function awaitingFinalQuotation(p:POS):boolean{return p.status==='Pending'&&p.quotationPhase==='Initial'&&paidTotal(p)>0;}
export function mayPayRemaining(p:POS):boolean{return p.status==='Pending'&&p.quotationPhase!=='Initial'&&!!p.cogsReviewedAt;}
