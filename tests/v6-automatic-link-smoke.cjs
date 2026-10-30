const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const root=path.join(__dirname,'..');function getModule(name){const source=fs.readFileSync(path.join(root,name),'utf8');const result=ts.transpileModule(source,{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`Syntax issue in ${name}`);const m={exports:{}};new Function('module','exports','require',result.outputText)(m,m.exports,require);return m.exports;}
const d=getModule('lib/data.ts');const db=require('./legacy-fixture.cjs')(d);db.pos=[];db.fundEntries=[];
assert.equal(d.normalizePlate('214 u-wi'),'214UWI');assert.equal(d.normalizePlate(' aBc-123 '),'ABC123');
const expense=(id,branch,plate,part,supplier,qty,cost,extras={})=>({id,purchaseId:'pay-1',no:'UCM-RFP-00000002',kind:'expense',fund:'RFP',branch,date:'2026-10-17',amount:qty*cost,category:'Automotive Parts',payee:supplier,vat:'Non-VAT',voucher:'',receiptNo:'',tin:'',description:part,notes:'',status:'Pending',createdBy:'u-pb',createdAt:'2026-10-17T08:00:00+08:00',plate,car:'Toyota Vios 2020',quantity:qty,unitCost:cost,...extras});
const a=expense('a','UCM','214UWI','Brake Pads','Supplier A',1,1800);const b=expense('b','UCM','214UWI','Oil Filter','Supplier B',2,450);db.fundEntries.push(a,b);
assert.equal(d.plateSuggestions(db,'UCM','214')[0].plate,'214UWI');assert.equal(d.plateSuggestions(db,'UCM','214')[0].car,'Toyota Vios 2020');assert.equal(d.plateSuggestions(db,'UCM','214')[0].unlinkedParts,2);
const old={id:'old',no:'UCM-POS-00000001',branch:'UCM',plate:'214UWI',vehicle:'Ford Ranger 2017',client:'Returning Customer',phone:'0987654321',date:'2026-10-01',items:[],payments:[],status:'Closed',createdBy:'u-cashier',createdAt:'2026-10-01T08:00:00+08:00',closedAt:'2026-10-01T10:00:00+08:00',concern:''};db.pos.push(old);
const sug=d.plateSuggestions(db,'UCM','214u')[0];assert.equal(sug.car,'Toyota Vios 2020','Unlinked PB car must override stale old POS vehicle');assert.equal(sug.client,'Returning Customer');
const sale={...old,id:'new',no:'UCM-POS-00000002',date:'2026-10-17',status:'Pending',vehicle:'Toyota Vios 2020',closedAt:undefined,items:[{id:'line',type:'Part',name:'Brake Pads',qty:1,price:3000,cost:999}],createdAt:'2026-10-17T09:00:00+08:00'};
let linked=d.linkPartsOnSale(db,sale);assert.deepEqual(linked.fundEntries.map(e=>e.linkedPosId),['new','new']);assert.equal(linked.fundEntries.filter(e=>e.linkedPosId==='old').length,0,'Prior closed visit must not receive PB parts');
assert.equal(d.posCOGS(sale,linked),2700,'Manual Brake Pads cost must be replaced by RFP 1800 and Oil Filter 900 added');
assert.equal(d.posCostBreakdown(sale,linked).length,2,'Matched manual part must not be double counted');
const partial={...sale,id:'partial',items:[{id:'m2',name:'Brake Pads',type:'Part',qty:2,price:3000,cost:999}]};
const onlyBrake={...linked,fundEntries:[{...a,linkedPosId:'partial'}]};
assert.equal(d.posCOGS(partial,onlyBrake),2799,'One actual PB brake part plus one remaining manual unit should not double count');
const after=d.linkPartsOnSale(linked,{...sale,id:'another'});assert.deepEqual(after.fundEntries.map(e=>e.linkedPosId),['new','new'],'Reused plate cannot relink previously pinned parts');
linked.fundEntries.push(expense('third','UCQC','214UWI','Tire','Other',1,700));linked.fundEntries.push(expense('rejected','UCM','214UWI','Gear','Other',1,100,{status:'Rejected'}));
const cross=d.linkPartsOnSale(linked,{...sale,id:'visit3'});assert.equal(cross.fundEntries.find(e=>e.id==='third').linkedPosId,undefined,'Branch isolated');assert.equal(cross.fundEntries.find(e=>e.id==='rejected').linkedPosId,undefined,'Rejected excluded');
const source=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
assert(source.includes('1. Customer & Vehicle')&&source.includes('Quotation · Transaction Entry')&&source.includes('COGS Review · All quotation items')&&source.includes('Payment Method · Cash / Terminal / QR'),'POS stages must include quotation, cost review and payment');
assert(source.includes('linkPartsOnSale(result.db,result.pos)')&&source.includes('saveUnitPOSDraft(db,p,user.id)'),'PB parts link once on initial POS creation; same-plate drafts are revised');
assert(source.includes('Add Another Part')&&source.includes('setPurchaseLines')&&source.includes('Missing Receipt — Upload Later'));
assert(!source.includes('Link Part</button>'),'PB manual link button must be gone');
assert(source.includes('kind===\'EOD\'&&timeMinutesPH()<16*60'));
assert(source.includes('Daily Sales Turnover')&&!source.includes('Friday Sales Turnover'));
assert(source.includes('Missed Sales Turnover')&&source.includes('8*60+30'));
console.log('PASS v6: 214UWI auto-fill, multiple parts/suppliers, once-only cashier POS association, COGS dedup, missing receipt, daily close and quotation → COGS Review → Payment POS source.');
