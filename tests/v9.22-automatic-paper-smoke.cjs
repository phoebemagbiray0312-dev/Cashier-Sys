const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dest=fs.mkdtempSync(path.join(os.tmpdir(),'cms-v922-'));
try{
 const tsc=spawnSync('tsc',['--strict','--target','es2022','--module','commonjs','--lib','es2022,dom','--skipLibCheck','lib/disbursement-requests.ts','--outDir',dest],{cwd:root,encoding:'utf8'});
 assert.equal(tsc.status,0,tsc.stdout+'\n'+tsc.stderr);
 const m=require(path.join(dest,'disbursement-requests.js')),d=require(path.join(dest,'data.js'));
 const pb={id:'PB',name:'PB Account',username:'p',password:'x',role:'pb',branch:'UCM',active:true};
 const cash={id:'C',name:'Cashier Account',username:'c',password:'x',role:'cashier',branch:'UCQC',active:true};
 const admin={...pb,id:'A',role:'admin'};
 let db={...d.createSeed(),users:[pb,cash,admin],settings:{...d.createSeed().settings,rfBase:{UCQC:5000,UCM:5000,UCLP:5000,MMM:5000},rfpBase:{UCQC:50000,UCM:50000,UCLP:50000,MMM:50000}}};
 const receipt={name:'receipt.pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'};
 function expense(id,branch,fund,amount,charge,createdAt){return {id,no:id,date:createdAt.slice(0,10),createdAt,createdBy:pb.id,kind:'expense',fund,branch,amount,onlineCharge:charge,description:'Job parts',notes:'',plate:'ABC1234',proof:receipt,status:'Pending',category:'Parts',payee:'Supplier',vat:'Non-VAT',voucher:'',receiptNo:'',tin:''};}
 db.fundEntries=[expense('PB1','UCM','RFP',800,10,'2026-10-19T10:00:00.000Z'),expense('PB2','MMM','RFP',500,0,'2026-10-19T11:00:00.000Z'),expense('C1','UCQC','RF',100,5,'2026-10-19T10:00:00.000Z'),expense('C2','UCM','RF',100,0,'2026-10-19T11:00:00.000Z')];
 assert.deepEqual(m.eligibleFundExpenses(db,pb,'RFP').map(e=>e.id),['PB1','PB2']);
 assert.deepEqual(m.eligibleFundExpenses(db,cash,'RF').map(e=>e.id),['C1']);
 assert.throws(()=>m.createGeneratedDisbursement(db,pb,'RFP',['PB1']),/all eligible|manual selection/,'No partial manual selection');
 assert.throws(()=>m.createAutomaticDisbursement(db,admin,'RFP'),/Only active/,'Admin cannot impersonate PB');
 db=m.createAutomaticDisbursement(db,pb,'RFP');let r=db.disbursementRequests[0];
 assert.equal(r.amount,1310);assert.equal(r.sourceLines.length,2);assert.equal(r.attachments.length,0);assert.equal(m.resolvedRequestReceipts(db,r).length,1);
 assert.equal(m.activeDisbursementCycle(db,pb,'RFP').id,r.id);
 assert.throws(()=>m.createAutomaticDisbursement(db,pb,'RFP'),/active/);
 db.fundEntries.push(expense('PB3','UCLP','RFP',100,5,'2026-10-19T12:00:00.000Z'));
 assert.throws(()=>m.submitDisbursementRequest(db,r.id,pb),/Refresh the automatic draft/,'New expenses cannot silently be omitted');
 db=m.refreshAutomaticDisbursement(db,r.id,pb,'Cycle updated');r=db.disbursementRequests[0];
 assert.equal(r.amount,1415);assert.equal(r.sourceLines.length,3);assert.equal(r.revision,2);
 db=m.submitDisbursementRequest(db,r.id,pb);r=db.disbursementRequests[0];
 assert.equal(r.status,'Pending Accounting Approval');assert.equal(r.accounting,undefined);assert.equal(r.msKate,undefined);assert.equal(r.release,undefined);
 assert.throws(()=>m.refreshAutomaticDisbursement(db,r.id,pb,'Change'),/locked/);
 db.fundEntries.push(expense('PB4','UCQC','RFP',200,0,'2026-10-19T13:00:00.000Z'));
 assert.equal(r.sourceLines.length,3,'Submitted request snapshot stays fixed');
 assert.equal(r.amount,1415);
 assert.throws(()=>m.createAutomaticDisbursement(db,pb,'RFP'),/active/,'New cycle blocked while request pending');
 // A release can only be supplied by a trusted external integration in production.
 const final={...r,status:'Released / Paid',accounting:{state:'Approved',origin:'external'},msKate:{state:'Approved',origin:'external'},approvedForReleaseAt:'2026-10-20T07:00:00.000Z',release:{recordedAt:'2026-10-20T09:00:00.000Z',amount:1415,method:'Bank Transfer',date:'2026-10-20',reference:'REAL-REF',releasingUserId:'TRUSTED',proof:receipt,authorizationId:'AUTH'}};
 db.disbursementRequests=[final];
 const cutoff=m.coverageCutoffs(db,'RFP');assert.equal(cutoff.UCM.source,'Recorded release');assert.equal(cutoff.UCLP.source,'Recorded release');
 assert.deepEqual(m.eligibleFundExpenses(db,pb,'RFP').map(x=>x.id),['PB4'],'Unclaimed expenses carry forward rather than disappear on release');
 db.fundEntries.push(expense('PB5','UCM','RFP',75,5,'2026-10-20T10:00:00.000Z'));
 assert.deepEqual(m.eligibleFundExpenses(db,pb,'RFP').map(x=>x.id),['PB4','PB5']);
 db=m.createAutomaticDisbursement(db,cash,'RF');assert.equal(db.disbursementRequests[0].amount,105,'Cashier RF only');
 const ui=fs.readFileSync(path.join(root,'components/DisbursementWorkspace.tsx'),'utf8');
 assert(!ui.includes('type="checkbox"')&&!ui.includes('Select all eligible')&&!ui.includes('Clear selection'),'Manual checkboxes removed');
 assert(ui.includes('ApprovalPaper')&&ui.includes('View receipt')&&ui.includes('Amount Requested')&&ui.includes('Total per Branch'));
 assert(ui.includes('Download Paper + Receipts PDF')&&ui.includes('Approval tracking'));
 assert(!ui.includes('Simulate Accounting')&&!ui.includes('Simulate Ms Kate'));
 let ts;try{ts=require('typescript');}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
 for(const f of ['app/page.tsx','components/DisbursementWorkspace.tsx','lib/disbursement-requests.ts']){
  const p=ts.createSourceFile(f,fs.readFileSync(path.join(root,f),'utf8'),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(p.parseDiagnostics.length,0,f+' has syntax errors');
 }
 console.log('PASS v9.22 automatic paper: all-expense cycle, branch scope, no picker, draft refresh, fixed submitted snapshots, release cutoff, receipts, and approval permissions.');
}finally{fs.rmSync(dest,{recursive:true,force:true});}
