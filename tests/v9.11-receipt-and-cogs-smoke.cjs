const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');const os=require('node:os');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'uc-v911-'));
try{
 const run=spawnSync('tsc',['--strict','--target','es2020','--module','commonjs','--skipLibCheck','lib/pos-line-entry.ts','lib/pos-cogs-review.ts','--outDir',out],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
 const cost=require(path.join(out,'pos-cogs-review.js'));
 const row={id:'1',type:'Service',name:'Labor',qty:1,price:1000,cost:0};
 assert.match(cost.costReviewIssues([row])[0],/choose a COGS source/i);
 assert.deepEqual(cost.costReviewIssues([{...row,costSource:'No direct cost'}]),[],'Zero-cost labor explicitly reviewed');
 assert.deepEqual(cost.costReviewIssues([{...row,costSource:'Direct',cost:250,supplier:'Mechanic A'}]),[],'Paid service direct cost');
 assert.match(cost.costReviewIssues([{...row,costSource:'Direct',cost:250,supplier:''}])[0],/supplier or payee/i);
 const part={...row,type:'Part',name:'Oil filter'};
 assert.match(cost.costReviewIssues([{...part,costSource:'No direct cost'}])[0],/cannot be classified/i);
 assert.deepEqual(cost.costReviewIssues([{...part,costSource:'PB / Inventory'}]),[],'PB/inventory awaiting verified cost source');
 assert.deepEqual(cost.costReviewIssues([{...part,costSource:'Direct',cost:400,supplier:'Vendor A'}]),[]);
 const pos={id:'pos1',items:[{...part,costSource:'PB / Inventory',qty:1}]};
 const item={id:'pb1',fund:'RFP',kind:'expense',linkedPosId:'pos1',status:'Pending',description:'Oil filter',quantity:1};
 const db={fundEntries:[item],inventory:[],stockMovements:[]};
 assert.match(cost.externalCostCoverageIssues(pos,db)[0],/approved PB purchase/i,'Pending PB purchases cannot certify final COGS');
 assert.deepEqual(cost.externalCostCoverageIssues(pos,{...db,fundEntries:[{...item,status:'Approved'}]}),[],'Approved PB receipt covers the quoted part');
 const inventoryDb={fundEntries:[],inventory:[{id:'item1',name:'Oil Filter'}],stockMovements:[{id:'s1',productId:'item1',posId:'pos1',kind:'StockOut',qty:1}]};
 assert.deepEqual(cost.externalCostCoverageIssues(pos,inventoryDb),[],'Posted inventory release covers the part');
 assert.equal(cost.externalCostCoverageIssues(pos,{...inventoryDb,stockMovements:[...inventoryDb.stockMovements,{kind:'StockReturn',sourceStockOutId:'s1',qty:1}]}).length,1,'Returned inventory no longer covers COGS');

 const app=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
 const composer=fs.readFileSync(path.join(root,'components/POSLineComposer.tsx'),'utf8');
 assert(app.includes('useState<POSLineDraft>(initialLine())'),'React state type must agree with optional proof');
 assert(app.includes('costReviewIssues(lines)')&&app.includes('costReviewIssues(pos.items)'),'COGS review validated in both wizard and saved draft');
 assert(app.includes('mayPayRemaining(pos)||costReviewIssues(pos.items).length'),'Remaining payments blocked until Final Quotation and COGS review completed');
 assert(app.includes('cogsReviewedAt:undefined'),'Added draft line invalidates COGS review');
 assert(app.includes('plateConfirmed')&&app.includes('setPlateConfirmed(normalizePlate(item.plate))'),'Selected plate suggestions dismissed');
 assert(composer.includes('receipt-head')&&composer.includes('receipt-input-row'),'Receipt-style quotation entry');
 assert(!composer.includes('Internal costing')&&!composer.includes('<FileInput')&&!composer.includes('Supplier'),'Supplier and COGS fields removed from quotation');
 assert(composer.includes('inputMode="decimal"')&&composer.includes('type="text"'),'No numeric spinner on selling price');
 assert(composer.includes('Request Stock Release'),'Registered inventory cannot bypass Stock Release');
 assert(app.includes('recordPOSPayment')&&app.includes('Request Stock Release'),'Payment and stock gate preserved');
 assert(app.includes('externalCostCoverageIssues(p,db)'),'Final sale requires proof of external part cost');
 assert(app.includes('cannotReviseDraft(db,pos)'),'Revision gate is checked before any quotation or stock mutation');
 let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
 for(const name of ['components/POSLineComposer.tsx','components/POSCostReview.tsx','app/page.tsx']){
  const source=fs.readFileSync(path.join(root,name),'utf8');const parsed=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length,0,`${name} parse error`);
 }
 console.log('PASS v9.11: COGS stage mandatory per line, receipt layout, typing hotfix, suggested plate dismissal, payments & inventory guards');
}finally{fs.rmSync(out,{recursive:true,force:true})}
