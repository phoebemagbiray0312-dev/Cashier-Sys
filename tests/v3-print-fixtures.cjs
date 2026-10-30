let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const tmp=path.join(root,'tests','_tmp');fs.mkdirSync(tmp,{recursive:true});
for(const file of ['data','print']){const target=path.join(root,'lib',`${file}.ts`);const src=fs.readFileSync(target,'utf8');const code=ts.transpileModule(src,{fileName:target,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;fs.writeFileSync(path.join(tmp,`${file}.js`),code);}
const d=require(path.join(tmp,'data.js'));const pr=require(path.join(tmp,'print.js'));
function capture(file,cb){let body='';global.window={open:()=>({document:{open(){},write(text){body=text},close(){}},focus(){}}),alert:msg=>{throw Error(msg)}};cb();fs.writeFileSync(path.join(tmp,file),body);return body;}
function makeRows(n){const db=require('./legacy-fixture.cjs')(d);db.fundEntries=[];for(let i=0;i<n;i++)db.fundEntries.push({id:`rf-${i}`,no:`UCM-RF-${i+1}`,fund:'RF',kind:'expense',branch:'UCM',date:'2026-09-20',amount:100+i,category:d.RF_CATEGORIES[i%d.RF_CATEGORIES.length],payee:'Company with medium length name here',vat:i%2?'VAT':'Non-VAT',voucher:`CV-${i+1}`,receiptNo:`RC-${i+1}`,tin:'100-100-100',description:'LONG RECEIPT DESCRIPTION WITH OTHER PARTICULARS AND VALUES THAT SHOULD NOT CREATE EXTRA LINES',notes:'',status:'Pending',createdBy:'u-cashier',createdAt:'2026-09-20T09:00:00+08:00'});return db;}
for(const count of [30,31,60,61]){const db=makeRows(count);const html=capture(`fund-${count}.html`,()=>pr.printFundReport(db,'UCM','RF',db.fundEntries,'2026-09-01','2026-09-30'));const detail=(html.match(/class="print-page fund-print"/g)||[]).length;const expected=count<=18?1:Math.ceil((count-18)/30)+1;if(detail!==expected)throw Error(`Expected ${expected} combined sheets for ${count} got ${detail}`);if((html.match(/fund-summary-title/g)||[]).length<1)throw Error('Missing replenishment summary');console.log(`Report ${count}: combined sheets ${detail}, separate summary pages 0`);}
{
 const db=makeRows(5);const old=db.fundEntries[0];old.date='2026-08-10';old.amount=500;db.fundEntries.push({...old,id:'rep1',kind:'replenishment',amount:300, date:'2026-09-12',status:'Approved',bank:'BDO',checkNo:'CK-218'});const s=d.disbursementSummary(db,'UCM','RF','2026-09-01','2026-09-30');if(s.opening!==49500||s.expenses!==410||s.deposits!==300||s.remaining!==49390)throw Error(`Period computation mismatch ${JSON.stringify(s)}`);console.log('Period accounting: PASS',s);
 capture('fund-checks.html',()=>pr.printFundReport(db,'UCM','RF',db.fundEntries,'2026-09-01','2026-09-30'));
}
{
 const db=require('./legacy-fixture.cjs')(d);const p=db.pos[0];const r=db.fundEntries.find(e=>e.fund==='RFP');r.linkedPosId=p.id;r.description='Engine Oil';r.quantity=1;r.amount=1250;r.status='Approved';let cost=d.posCOGS(p,db);if(cost!==1700)throw Error(`Double counted COGS ${cost}`);r.description='Wheel Hub';r.amount=900;r.quantity=1;cost=d.posCOGS(p,db);if(cost!==2600)throw Error(`Linked RFP COGS missing ${cost}`);console.log('COGS dedup & addition: PASS');
}
{
 const db=require('./legacy-fixture.cjs')(d);const p=db.pos[0];p.closedAt='2026-10-03T21:00:00+08:00';p.date='2026-09-12';if(d.posClosedDate(p)!=='2026-10-03')throw Error('Wrong POS close date');capture('sales.html',()=>pr.printSales(db,'UCM','2026-10-01','2026-10-31'));console.log('Closed sales date: PASS');
}
