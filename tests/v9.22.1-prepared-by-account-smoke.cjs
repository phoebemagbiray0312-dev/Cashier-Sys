const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const dest=fs.mkdtempSync(path.join(os.tmpdir(),'cms-preparer-'));
try{
 const build=spawnSync('tsc',['--strict','--target','es2022','--module','commonjs','--lib','es2022,dom','--skipLibCheck','lib/disbursement-requests.ts','--outDir',dest],{cwd:root,encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+'\n'+build.stderr);
 const m=require(path.join(dest,'disbursement-requests.js')),d=require(path.join(dest,'data.js'));
 const pb={id:'pb-23',name:'Maria Santos',username:'msantos',password:'pw',role:'pb',branch:'UCM',active:true};
 const cashier={id:'cash-23',name:'Juan Dela Cruz',username:'jdela',password:'pw',role:'cashier',branch:'UCQC',active:true};
 const db=d.createSeed();db.users=[pb,cashier];
 const receipt={name:'receipt.pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'};
 const expense=(id,branch,fund,createdBy)=>({id,no:id,date:'2026-10-21',createdAt:'2026-10-21T05:00:00.000Z',createdBy,kind:'expense',fund,branch,amount:250,onlineCharge:5,description:'Part expense',notes:'',proof:receipt,status:'Pending',category:'Parts',payee:'Supplier',vat:'Non-VAT',voucher:'',receiptNo:'',tin:''});
 db.fundEntries=[expense('E1','UCM','RFP',pb.id),expense('E2','UCQC','RF',cashier.id)];
 const pbDb=m.createAutomaticDisbursement(db,pb,'RFP');
 const cashDb=m.createAutomaticDisbursement(db,cashier,'RF');
 const pbReq=pbDb.disbursementRequests[0],cashReq=cashDb.disbursementRequests[0];
 assert.equal(pbReq.requestorName,'Maria Santos');assert.equal(pbReq.requestorId,'pb-23');
 assert.equal(cashReq.requestorName,'Juan Dela Cruz');assert.equal(cashReq.requestorRole,'cashier');
 const afterRename=m.submitDisbursementRequest(pbDb,pbReq.id,{...pb,name:'Updated Profile Name'});
 assert.equal(afterRename.disbursementRequests[0].requestorName,'Maria Santos','Saved requester identity is a historical snapshot, not rewritten from current profile');
 const ui=fs.readFileSync(path.join(root,'components/DisbursementWorkspace.tsx'),'utf8');
 assert(ui.includes('Prepared by · Account name')&&ui.includes('paperData.requestorName'));
 assert(ui.includes("data.requestorRole==='pb'?'Parts Buyer':'Cashier'"),'Role shown separately');
 assert(!ui.includes('Prepared by · PB / Cashier'),'No generic role-only signatory');
 const pdf=fs.readFileSync(path.join(root,'lib/disbursement-paper.ts'),'utf8');
 assert(pdf.includes("'Prepared by: '+r.requestorName"),'PDF binds stored actual requester');
 console.log('PASS v9.22.1 prepared by identity: PB, cashier, immutable request snapshot, on-screen name, signature, and PDF.');
}finally{fs.rmSync(dest,{recursive:true,force:true});}
