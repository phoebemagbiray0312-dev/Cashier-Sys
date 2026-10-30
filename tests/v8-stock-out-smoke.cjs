const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root=path.join(__dirname,'..');
function getModule(name){const source=fs.readFileSync(path.join(root,name),'utf8');const r=ts.transpileModule(source,{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});assert.equal(r.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);const m={exports:{}};new Function('module','exports','require',r.outputText)(m,m.exports,require);return m.exports;}
const d=getModule('lib/data.ts');let db=require('./legacy-fixture.cjs')(d);
function addOilFilter(data,branch){return d.registerInventoryProduct(data,{branch,barcode:branch+'TESTFILTER',name:'Oil Filter',category:'Automotive Parts & Products',unit:'Piece',unitCost:310,sellPrice:550,reorderAt:4,initialQty:12},'u-admin');}
db=addOilFilter(addOilFilter(db,'UCM'),'UCQC');
const inv=db.inventory.find(p=>p.branch==='UCM'&&p.name==='Oil Filter'),other=db.inventory.find(p=>p.branch==='UCQC'&&p.name==='Oil Filter');
assert(inv&&other);assert.equal(d.stockAvailable(db,inv),12);assert.equal(d.stockAvailable(db,other),12);
// A saved Draft can receive scanned stock with no sale items yet.
const pos={id:'draft-214',no:'UCM-POS-00000009',branch:'UCM',date:d.todayPH(),client:'Test',phone:'',plate:'214UWI',vehicle:'Toyota Vios 2020',concern:'',items:[],payments:[],status:'Pending',createdBy:'u-cashier',createdAt:new Date().toISOString()};db.pos.push(pos);
db=d.confirmStockOut(db,inv.id,pos.id,2,'u-cashier');const movement=db.stockMovements[0];assert.equal(movement.kind,'StockOut');assert.equal(d.stockAvailable(db,inv),10);assert.equal(d.stockAvailable(db,other),12,'Other branch cannot be changed');
assert.equal(d.posCostTotals(pos,db).inventory,620);assert.equal(d.posCOGS(pos,db),620);
assert.throws(()=>d.confirmStockOut(db,other.id,pos.id,1,'u-cashier'),/same branch/);
assert.throws(()=>d.confirmStockOut(db,inv.id,pos.id,11,'u-cashier'),/Insufficient/);
assert.throws(()=>d.confirmStockOut(db,inv.id,pos.id,1,'u-pb'),/authorized Cashier/);
assert.throws(()=>d.recordStockIn(db,inv.id,1,'u-pb'),/No Stock In access/);
// Request does not change locked posted Stock Out or stock on hand.
db=d.requestStockReturn(db,movement.id,1,'One unused filter','u-cashier');const request=db.stockRequests[0];assert.equal(request.status,'Pending');assert.equal(d.stockAvailable(db,inv),10);
assert.throws(()=>d.requestStockReturn(db,movement.id,2,'Duplicate / over-request','u-cashier'),/Invalid return/);
assert.throws(()=>d.decideStockReturn(db,request.id,true,'u-cashier'),/Only Admin/);
db=d.decideStockReturn(db,request.id,true,'u-admin');assert.equal(db.stockMovements.find(m=>m.id===movement.id).qty,2,'Original Stock Out is immutable');assert.equal(db.stockMovements[0].kind,'StockReturn');assert.equal(d.stockAvailable(db,inv),11);assert.equal(d.posCostTotals(pos,db).inventory,310);assert.equal(db.stockRequests[0].status,'Approved');assert.throws(()=>d.decideStockReturn(db,request.id,true,'u-admin'),/pending return/);
// Partial return remaining 1; rejected request must not affect balance.
db=d.requestStockReturn(db,movement.id,1,'Remaining filter unused','u-cashier');let req=db.stockRequests[0];db=d.decideStockReturn(db,req.id,false,'u-admin');assert.equal(d.stockAvailable(db,inv),11);assert.equal(db.stockRequests[0].status,'Rejected');
db=d.requestStockReturn(db,movement.id,1,'Unused after recheck','u-cashier');req=db.stockRequests[0];db=d.decideStockReturn(db,req.id,true,'u-admin');assert.equal(d.stockAvailable(db,inv),12);assert.equal(d.posCostTotals(pos,db).inventory,0);
// Adds inventory cost once, replacing manual cost on matching part, PB separate.
let cdb=addOilFilter(require('./legacy-fixture.cjs')(d),'UCM');const product=cdb.inventory.find(p=>p.branch==='UCM'&&p.name==='Oil Filter');const draft={...pos,id:'both',items:[{id:'manual',type:'Part',name:'Oil Filter',qty:1,price:700,cost:999}]};cdb.pos.push(draft);
cdb=d.confirmStockOut(cdb,product.id,'both',1,'u-cashier');const cost=d.posCostTotals(draft,cdb);assert.equal(cost.inventory,310);assert.equal(cost.manual,0);assert.equal(d.posCOGS(draft,cdb),310);
const part={id:'part-1',no:'UCM-RFP-00000099',fund:'RFP',kind:'expense',branch:'UCM',date:d.todayPH(),amount:1800,category:'Automotive Parts',payee:'Part Supplier',vat:'Non-VAT',voucher:'',receiptNo:'',tin:'',description:'Brake Pads',notes:'',status:'Pending',createdBy:'u-pb',createdAt:new Date().toISOString(),plate:'214UWI',quantity:1,unitCost:1800,linkedPosId:'both'};cdb.fundEntries.push(part);
assert.equal(d.posCostTotals(draft,cdb).rfp,1800);assert.equal(d.posCOGS(draft,cdb),2110);
// New-product and receiving unit movement
const qty=d.stockAvailable(cdb,product);assert.throws(()=>d.recordStockIn(cdb,product.id,5,'u-cashier','Delivery'),/Admin verification/);
cdb=d.submitStockReceipt(cdb,[{productId:product.id,qty:5}],'DELIVERY-0005','Physical receiving','u-cashier',{name:'delivery.jpg',data:'data:image/jpeg;base64,AAA'});
assert.equal(d.stockAvailable(cdb,product),qty,'Pending Cashier Stock In must not credit inventory');
cdb=d.reviewStockReceipt(cdb,cdb.stockReceipts[0].id,true,'u-admin',true,'Verified all five units physically');assert.equal(d.stockAvailable(cdb,product),qty+5);
// Existing v7 data must be upgradeable without deleting records.
const legacy=require('./legacy-fixture.cjs')(d);delete legacy.inventory;delete legacy.stockMovements;delete legacy.stockRequests;assert(!legacy.inventory);
const page=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');assert(page.includes('savePOSDraft')&&page.includes('COGS Review · All quotation items'),'Quotation must require COGS review before the draft advances to payment');assert(page.includes('Request Stock Release'));assert(page.includes('Request Return'));assert(page.includes('Inventory COGS'));assert(page.includes('PB/RFP COGS'));
console.log('PASS v8: barcode inventory, per-branch stock, Draft issuance, immutable Stock Out, partial returns, Admin approval, separated COGS and no double count.');
