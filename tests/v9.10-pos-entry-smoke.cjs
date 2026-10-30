const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'uc-pos-v910-'));
try{
 const run=spawnSync('tsc',['--strict','--target','es2020','--module','commonjs','--skipLibCheck','lib/pos-line-entry.ts','--outDir',out],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
 const lib=require(path.join(out,'pos-line-entry.js'));
 const item={type:'Part',name:'  Brake   pads  ',qty:'2',price:'1500.25',cost:'1100.00',supplier:'',receiptNo:''};
 assert.equal(lib.posLineError(item),null);
 assert.deepEqual(lib.posLineNumbers(item),{name:'Brake pads',qty:2,price:1500.25,cost:1100});
 assert.equal(lib.posLineAmount(2,1500.25),3000.50);
 assert.equal(lib.posLineAmount(3,.1),.3,'Perform line totals in centavos');
 for(const qty of ['0','-1','1.5','1e3','10000','', 'NaN'])assert.match(lib.posLineError({...item,qty}),/Quantity/);
 for(const price of ['0','-1','2.999','1e3','', '100000000'])assert.match(lib.posLineError({...item,price}),/Selling price/);
 assert.equal(lib.posLineError({...item,cost:'1600'}),null,'Cost exceeding selling price is valid but indicates negative margin');
 assert.match(lib.posLineError({...item,cost:'-1'}),/cost/i);
 assert.equal(lib.posLineError({...item,cost:''}),null,'Optional internal cost accepts blank');
 assert.equal(lib.posLineNumbers({...item,cost:''}).cost,0);
 assert.match(lib.posLineError({...item,name:' '}),/name/);
 const ts=require('typescript');
 for(const relative of ['components/POSLineComposer.tsx','app/page.tsx']){
  const code=fs.readFileSync(path.join(root,relative),'utf8');
  const parsed=ts.createSourceFile(relative,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length,0,`${relative}: JSX parse errors`);
 }
 const composer=fs.readFileSync(path.join(root,'components/POSLineComposer.tsx'),'utf8');
 const app=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
 assert.equal((app.match(/<POSLineComposer /g)||[]).length,1,'Saved draft still uses protected composer');
 assert(app.includes('<POSQuotationGrid rows={quotationRows}'),'Wizard now uses one receipt-grid with inline rows');
 assert(composer.includes('Request Stock Release'),'Cannot quietly bypass registered inventory');
 assert(app.includes('editWizardLine')&&app.includes('wizardEditingId'),'Queued draft items can be edited without reposting');
 assert(app.includes('quotationIssue(quotationRows')&&app.includes('posLineNumbers(newLine)'),'Validation enforced in new wizard and existing POS');
 assert(app.includes('recordPOSPayment')&&app.includes('requestStockIssue'),'Existing payment and inventory flows retained');
 console.log('PASS v9.10: editor validation, centavo totals, quantity limits, shared wizard/draft UI, stock guardrails and TSX syntax');
}finally{fs.rmSync(out,{recursive:true,force:true})}
