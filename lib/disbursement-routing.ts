import {type Database,type FundEntry,type User,log} from './data';

/** Only active Admin accounts can be selected for an RF/RFP replenishment request.
 * This internal review never represents Accounting verification or President signoff. */
export function disbursementApprovers(db:Database,requesterId:string,branch?:string):User[]{
 return db.users.filter(u=>u.active&&u.role==='admin'&&u.id!==requesterId)
  .sort((a,b)=>Number(b.branch===branch)-Number(a.branch===branch)||a.name.localeCompare(b.name));
}
export function canReviewDisbursement(db:Database,entry:FundEntry,userId:string):boolean{
 const reviewer=db.users.find(u=>u.id===userId);
 return !!reviewer?.active&&reviewer.role==='admin'&&entry.kind==='replenishment'&&entry.createdBy!==userId
  &&(!entry.requestedApproverId||entry.requestedApproverId===userId);
}
/** New routed disbursements need internal Admin approval BEFORE external demo stages.
 * For legacy requests without routing metadata, preserve their former behavior. */
export function disbursementAdminReviewed(entry:FundEntry):boolean{
 return !entry.requestedApproverId||entry.disbursementReviewStatus==='Approved';
}
export function reviewDisbursement(db:Database,entryId:string,reviewerId:string,decision:'Approved'|'Returned',notes=''):Database{
 const entry=db.fundEntries.find(e=>e.id===entryId);
 if(!entry||entry.kind!=='replenishment')throw new Error('Disbursement request not found.');
 if(!entry.requestedApproverId)throw new Error('This legacy request has no assigned approver; use the existing legacy review flow.');
 if(!canReviewDisbursement(db,entry,reviewerId))throw new Error('Only the selected active Admin can review this disbursement.');
 if(entry.status!=='Pending'||entry.disbursementReviewStatus!=='Pending')throw new Error('This request is not awaiting Admin review.');
 if(decision==='Returned'&&notes.trim().length<5)throw new Error('Enter a return reason (at least 5 characters).');
 const at=new Date().toISOString(),note=notes.trim();
 const next=db.fundEntries.map(e=>e.id!==entryId?e:{...e,
  disbursementReviewStatus:decision,disbursementReviewedBy:reviewerId,disbursementReviewedAt:at,disbursementReviewNote:note,
  ...(decision==='Returned'?{status:'Rejected' as const,accountingStatus:'Returned' as const,decisionBy:reviewerId,decisionAt:at,decisionNote:note}:{})
 });
 return log({...db,fundEntries:next},reviewerId,decision==='Approved'?'Disbursement routed approval':'Disbursement returned to preparer',
  `${entry.no} · ${entry.fund} · ${entry.branch} · selected reviewer ${reviewerId} · ${note||'Approved for external verification'} (not a fund receipt)`);
}
