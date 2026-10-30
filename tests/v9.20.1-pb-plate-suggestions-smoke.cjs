const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-v9201-'));
try {
  const result = spawnSync('tsc', ['--strict','--target','es2022','--module','commonjs','--lib','es2022,dom','--skipLibCheck','lib/data.ts','--outDir',dest], {cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  const data = require(path.join(dest,'data.js'));
  const db = data.createSeed();
  const now = new Date().toISOString();
  const pos = {id:'pos-uclp',no:'POS-UCLP-100',branch:'UCLP',status:'Pending',plate:'ABC-1234',date:'2026-10-21',createdAt:now,createdBy:'cashier',client:'Customer',phone:'',vehicle:'Toyota Vios 2022',concern:'',items:[],payments:[]};
  const expense = {id:'pb-uclp',no:'RFP-UCLP-100',fund:'RFP',kind:'expense',branch:'UCLP',date:'2026-10-21',createdAt:now,createdBy:'pb',amount:1250,category:'Automotive Parts',payee:'Supplier',description:'Brake Pad',status:'Pending',plate:'ABC1234',quantity:1,unitCost:1250};
  db.pos.push(pos); db.fundEntries.push(expense);
  assert.equal(data.plateSuggestions(db,'UCLP','abc')[0].plate,'ABC1234');
  assert.equal(data.plateSuggestions(db,'UCLP','ABC')[0].unlinkedParts,1);
  assert.equal(data.plateSuggestions(db,'UCM','abc').length,0,'PB suggestion list must respect selected branch');
  const linked = data.linkPartsOnSale(db,pos);
  assert.equal(linked.fundEntries.find(e=>e.id==='pb-uclp').linkedPosId,pos.id,'PB purchase auto-links to same branch and normalized plate');
  assert.equal(data.posCostBreakdown(pos,linked).some(row=>row.id==='pb-uclp'&&row.amount===1250),true,'linked PB purchase included in POS COGS');
  const source=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  assert(source.includes('partPlateConfirmed'),'PB suggestion selected state is separate from Cashier POS');
  assert(source.includes('plateSuggestions(db,partForm.branch,partForm.plate)'), 'PB suggestions follow selected RFP branch');
  assert(source.includes('setPartPlateConfirmed(`${partForm.branch}:${item.plate}`)'), 'PB selected plate dismisses dropdown');
  assert(source.includes("setPartPlateConfirmed('');setPartForm(p=>({...p,branch:value as BranchId}))"), 'switching branch clears suggestion selection');
  assert(source.includes('matchingPOS(db,purchaseBranch,plate)'),'RFP POS auto-match remains branch-scoped');
  let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
  const parsed=ts.createSourceFile('app/page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(x=>x.messageText).join('; '));
  console.log('PASS v9.20.1: PB plate autocomplete by selected branch, dismiss on selection, no cross-branch suggestions, POS auto-link and COGS intact, TSX parses.');
} finally {fs.rmSync(dest,{recursive:true,force:true})}
