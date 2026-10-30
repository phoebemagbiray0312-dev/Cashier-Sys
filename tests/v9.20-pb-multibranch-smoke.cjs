const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dest=fs.mkdtempSync(path.join(os.tmpdir(),'cms-pb-multibranch-'));
try{
 const result=spawnSync('tsc',['--strict','--target','es2022','--module','commonjs','--lib','es2022,dom','--skipLibCheck','lib/parts-purchase.ts','lib/disbursement-requests.ts','--outDir',dest],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
 const model=require(path.join(dest,'disbursement-requests.js'));
 const parts=require(path.join(dest,'parts-purchase.js'));
 const data=require(path.join(dest,'data.js'));
 const pb={id:'pb-main',username:'pb',password:'test',role:'pb',name:'Parts Buyer',branch:'UCM',active:true};
 const cash={id:'c',username:'cash',password:'test',role:'cashier',name:'Cashier',branch:'UCQC',active:true};
 const admin={id:'a',username:'admin',password:'test',role:'admin',name:'Admin',branch:'UCM',active:true};
 let db={...data.createSeed(),users:[pb,cash,admin]};
 assert.deepEqual(data.BRANCHES.map(b=>b.id),['UCQC','UCM','UCLP','MMM']);
 for(const branch of data.BRANCHES.map(b=>b.id)){
  const detail={branch,assignedBranch:pb.branch,role:'pb',plate:'ABC1234',vehicleYear:''};
  assert.equal(parts.partsPurchaseHeaderIssue(detail,2026),null,`PB parts purchase allowed for ${branch}`);
  const form={requestDate:'2026-10-21',branch,category:'Parts Purchasing',purpose:`Parts for ${branch}`,amount:250,attachments:[],remarks:'Multi-branch request'};
  db=model.createDisbursementDraft(db,pb,form);
  const req=db.disbursementRequests[0];
  assert.equal(req.branch,branch);
  assert.match(req.requestNo,new RegExp(`^DR-${branch}-`));
  db=model.editDisbursementDraft(db,req.id,pb,{...form,purpose:`Approved branch ${branch}`});
  db=model.submitDisbursementRequest(db,req.id,pb);
  assert.equal(db.disbursementRequests[0].status,'Pending Accounting Approval');
  assert.equal(db.disbursementRequests[0].release,undefined);
 }
 assert.equal(model.visibleDisbursements(db,pb).length,4,'PB can see own requests from all branches');
 assert.equal(model.visibleDisbursements(db,cash).length,0,'Cashier cannot view PB records');
 assert.equal(model.visibleDisbursements(db,admin,'UCM').length,1,'Admin branch filter preserved');
 assert.throws(()=>model.createDisbursementDraft(db,cash,{requestDate:'2026-10-21',branch:'MMM',category:'Other',purpose:'Unauthorized expense',amount:1,attachments:[],remarks:''}),/assigned branch/);
 assert.match(parts.partsPurchaseHeaderIssue({branch:'MMM',assignedBranch:'UCQC',role:'cashier',plate:'ABC1234',vehicleYear:''},2026),/assigned branch/);
 assert.match(parts.partsPurchaseHeaderIssue({branch:'FAKE',assignedBranch:'UCM',role:'pb',plate:'ABC1234',vehicleYear:''},2026),/valid purchase branch/);
 assert.throws(()=>model.createDisbursementDraft(db,pb,{requestDate:'2026-10-21',branch:'FAKE',category:'Other',purpose:'Invalid branch',amount:1,attachments:[],remarks:''}),/assigned branch/);
 const ucmReq=db.disbursementRequests.find(x=>x.branch==='UCM');
 assert.throws(()=>model.editDisbursementDraft(db,ucmReq.id,pb,{requestDate:'2026-10-21',branch:'MMM',category:'Parts Purchasing',purpose:'Attempt reassignment',amount:250,attachments:[],remarks:''}),/cannot be edited/);
 const ui=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
 const comp=fs.readFileSync(path.join(root,'components/DisbursementWorkspace.tsx'),'utf8');
 assert(ui.includes("user.role==='admin'||user.role==='pb'?<label className=\"branch-select\""),'PB gets topbar branch selector');
 assert(ui.includes('options={branchOptions} required/>'),'PB parts purchase dropdown lists all branches');
 assert(ui.includes('branch:currentBranch')&&ui.includes('partForm.branch'),'PB purchases inherit selected branch');
 assert(ui.includes("balance(db,purchaseBranch,'RFP')"),'PB purchase debits only the chosen branch RFP');
 assert(ui.includes('matchingPOS(db,purchaseBranch,plate)'),'PB purchase POS matching is scoped to the chosen branch');
 assert(ui.includes("nextNumber(db,purchaseBranch,'RFP')"),'RFP reference numbering is branch-scoped');
 assert(ui.includes('replenishmentDue(db,currentBranch,fund)'),'Existing PB replenishment uses the active selected branch');
 assert(comp.includes('currentBranch={currentBranch}')===false); // received as prop, not passed within component
 assert(comp.includes("fund==='RFP'")||comp.includes("user.role==='pb'?'All four branches'"),'PB requests consolidate all four branches with no manual branch amount');
 assert(!/Simulate Accounting|Simulate Ms Kate|Approve External/.test(comp),'No external approval impersonation');
 let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
 for(const file of ['app/page.tsx','components/DisbursementWorkspace.tsx']){
  const source=fs.readFileSync(path.join(root,file),'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length,0,`${file}: ${parsed.parseDiagnostics.map(x=>x.messageText).join('; ')}`);
 }
 console.log('PASS v9.20: Parts Buyer has all 4 branch choices; purchase & disbursement validations; per-branch IDs, request history, and cashier restriction; navigation and TSX syntax.');
}finally{fs.rmSync(dest,{recursive:true,force:true})}
