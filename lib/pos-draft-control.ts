import {log,normalizePlate,paidTotal,posTotal,type Database,type POS,type POSLine,type BranchId} from './data';

/** A unit's active visit is global to all branches in the CURRENT datastore. */
export function openUnitVisits(db:Database,rawPlate:string):POS[]{
 const plate=normalizePlate(rawPlate);
 return plate?db.pos.filter(p=>p.status==='Pending'&&normalizePlate(p.plate)===plate):[];
}
export function unitVisitDecision(db:Database,rawPlate:string,branch:BranchId):{kind:'new'|'resume'|'blocked'|'conflict';visit?:POS;reason?:string}{
 const matching=openUnitVisits(db,rawPlate);
 if(matching.length>1)return {kind:'conflict',reason:`Unit ${normalizePlate(rawPlate)} already has multiple open POS transactions. Ask Admin to investigate and close the duplicate records before proceeding.`};
 const visit=matching[0];
 if(!visit)return {kind:'new'};
 if(visit.branch!==branch)return {kind:'blocked',visit,reason:`Unit ${visit.plate} has an OPEN POS (${visit.no}) at ${visit.branch}. The previous branch must close the transaction before this branch can create a new one.`};
 return {kind:'resume',visit};
}
export function cannotReviseDraft(db:Database,pos:POS):string|null{
 if(pos.status!=='Pending')return 'Closed POS transactions cannot be edited.';
 if(pos.payments.length&&paidTotal(pos)>=posTotal(pos)-0.005)return 'Fully paid POS cannot be revised. Request an authorized correction if needed.';
 if((db.stockMovements||[]).some(m=>m.posId===pos.id&&m.kind==='StockOut'))return 'Posted stock consumption exists. Quotation is locked to protect inventory and costing.';
 if((db.stockIssues||[]).some(x=>x.posId===pos.id&&x.status!=='Rejected'))return 'Stock release requests exist for this POS. Complete/reconcile the release before editing the quotation.';
 return null;
}
export type POSDraftSnapshot={client:string;phone:string;vehicle:string;plate:string;concern:string;date:string;items:Array<Pick<POSLine,'id'|'type'|'name'|'qty'|'price'|'cost'|'supplier'|'receiptNo'|'costSource'|'lineTotal'>>;cogsReviewedAt?:string};
export function snapshotPOS(p:POS):POSDraftSnapshot{return {client:p.client,phone:p.phone,vehicle:p.vehicle,plate:p.plate,concern:p.concern,date:p.date,items:p.items.map(({id,type,name,qty,price,cost,supplier,receiptNo,costSource,lineTotal})=>({id,type,name,qty,price,cost,supplier,receiptNo,costSource,lineTotal})),cogsReviewedAt:p.cogsReviewedAt};}
export function reviseDraftHistory(before:POS|undefined,after:POS,by:string,action:string,at=new Date().toISOString()):POS{
 const oldSnapshot=before?(before.draftHistory?.[before.draftHistory.length-1]?.after||snapshotPOS(before)):undefined;
 const nextSnapshot=snapshotPOS(after);
 if(before&&JSON.stringify(oldSnapshot)===JSON.stringify(nextSnapshot))return before;
 const history=before?.draftHistory?.length?before.draftHistory:before?[{revision:1,at:before.createdAt,by:before.createdBy,action:'Original legacy draft (before revisions)',after:snapshotPOS(before)}]:[];
 const revision=history.length+1;
 return {...after,draftHistory:[...history,{revision,at,by,action,before:oldSnapshot,after:nextSnapshot}]};
}
/** Save one active unit per branch. Never create a second draft for the same plate. */
export function saveUnitPOSDraft(db:Database,candidate:POS,by:string):{db:Database;pos:POS;created:boolean;changed:boolean}{
 if(!normalizePlate(candidate.plate))throw new Error('Valid plate required.');
 const decision=unitVisitDecision(db,candidate.plate,candidate.branch);
 if(decision.kind==='blocked'||decision.kind==='conflict')throw new Error(decision.reason);
 if(decision.kind==='resume'){
  const old=decision.visit!;
  const reason=cannotReviseDraft(db,old);if(reason)throw new Error(reason);
  if(old.payments.length&&posTotal(candidate)+0.005<paidTotal(old))throw new Error(`New quotation total cannot be below the already received payments (₱${paidTotal(old).toFixed(2)}).`);
  const oldData=snapshotPOS(old);
  const nextData=snapshotPOS(candidate);
  const realChange=JSON.stringify({...oldData,cogsReviewedAt:undefined})!==JSON.stringify({...nextData,cogsReviewedAt:undefined});
  const phaseChanged=candidate.quotationPhase==='Final'&&old.quotationPhase==='Initial';
  const same:POS={...old,client:candidate.client,phone:candidate.phone,vehicle:candidate.vehicle,concern:candidate.concern,date:candidate.date,items:candidate.items,firstQuotation:old.firstQuotation||candidate.firstQuotation,quotationPhase:candidate.quotationPhase||old.quotationPhase,cogsReviewedAt:realChange||phaseChanged?candidate.cogsReviewedAt:old.cogsReviewedAt,cogsReviewedBy:realChange||phaseChanged?candidate.cogsReviewedBy:old.cogsReviewedBy};
  let revised=reviseDraftHistory(old,same,by,phaseChanged?'Final quotation and COGS approved':'Quotation and COGS revised');
  // Identical item rows still constitute a meaningful signed-off final quotation stage.
  if(phaseChanged&&revised===old){const history=old.draftHistory||[];revised={...same,draftHistory:[...history,{revision:history.length+1,at:new Date().toISOString(),by,action:'Final quotation continued from original',before:snapshotPOS(old),after:snapshotPOS(same)}]};}
  if(revised===old)return {db,pos:old,created:false,changed:false};
  const updated={...db,pos:db.pos.map(p=>p.id===old.id?revised:p)};
  return {db:log(updated,by,old.payments.length?'Partially paid POS draft revised':'POS draft revised',`${old.no} · ${old.plate} · Revision ${revised.draftHistory?.length} · total ${posTotal(old).toFixed(2)} → ${posTotal(revised).toFixed(2)} · received ${paidTotal(old).toFixed(2)} (preserved)`),pos:revised,created:false,changed:true};
 }
 const created=reviseDraftHistory(undefined,candidate,by,'Draft created');
 return {db:log({...db,pos:[created,...db.pos]},by,'POS draft created',`${created.no} · ${created.plate} · ${posTotal(created).toFixed(2)}`),pos:created,created:true,changed:true};
}

/** A deleted draft is removed from active POS but preserved as a local audit snapshot.
 * NEVER delete an issued, paid, or referenced POS. Re-check all invariants at deletion time. */
export function draftDeletionIssue(db:Database,pos:POS):string|null{
 if(pos.status!=='Pending')return 'Closed transactions cannot be deleted.';
 if(pos.payments.length)return 'This POS already has a payment. Deletion is prohibited.';
 if((db.terminalEvents||[]).some(e=>e.posId===pos.id))return 'Terminal activity exists for this POS. Reconcile it first.';
 if((db.stockMovements||[]).some(m=>m.posId===pos.id))return 'Posted stock activity exists for this POS. Deletion is prohibited.';
 if((db.stockIssues||[]).some(r=>r.posId===pos.id))return 'Stock release request history exists for this POS. Deletion is prohibited.';
 if((db.stockRequests||[]).some(r=>r.posId===pos.id))return 'Stock correction records exist for this POS. Deletion is prohibited.';
 if(db.fundEntries.some(e=>e.linkedPosId===pos.id))return 'Linked Parts Buyer purchases exist. Unlink or reconcile them through an authorized workflow before deleting.';
 if(db.pos.some(p=>p.parentId===pos.id))return 'Linked POS extensions exist. Deletion is prohibited.';
 return null;
}
export function deletePOSDraft(db:Database,posId:string,by:string,reason:string):Database{
 const actor=db.users.find(u=>u.id===by&&u.active);
 if(!actor||actor.role!=='cashier')throw new Error('Only an active Cashier can delete a POS draft.');
 const pos=db.pos.find(p=>p.id===posId);
 if(!pos)throw new Error('POS draft no longer exists. Refresh the list.');
 if(pos.branch!==actor.branch)throw new Error('Only the Cashier assigned to this branch may delete its POS draft.');
 const issue=draftDeletionIssue(db,pos);
 if(issue)throw new Error(issue);
 const cleanReason=reason.trim();
 if(cleanReason.length<5)throw new Error('Please enter a deletion reason (at least 5 characters).');
 const deletedAt=new Date().toISOString();
 const snapshot={id:pos.id,no:pos.no,branch:pos.branch,plate:pos.plate,deletedAt,deletedBy:actor.id,reason:cleanReason,original:pos};
 const next={...db,pos:db.pos.filter(p=>p.id!==pos.id),deletedPOSDrafts:[snapshot,...(db.deletedPOSDrafts||[])]};
 return log(next,actor.id,'POS draft deleted (archived)',`${pos.no} · ${pos.plate} · ${pos.branch} · Reason: ${cleanReason} · Original draft and revision history retained in archive`);
}
