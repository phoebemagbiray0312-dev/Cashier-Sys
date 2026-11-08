import type {DisbursementRequest} from './disbursement-requests';
export type Role = 'admin'|'cashier'|'pb';
export type Status = 'Pending'|'Approved'|'Rejected'|'Report Required'|'Report Submitted';
export type Fund = 'RF'|'RFP';
export type BranchId = 'UCQC'|'UCM'|'UCLP'|'MMM';
export const BRANCHES: {id:BranchId;name:string;short:string}[] = [
  {id:'UCQC',name:'UC Quezon City',short:'UC Quezon City'},
  {id:'UCM',name:'UC Mandaluyong',short:'UC Mandaluyong'},
  {id:'UCLP',name:'UC Las Piñas',short:'UC Las Piñas'},
  {id:'MMM',name:'MM Mandaluyong',short:'MM Mandaluyong'}
];
export const RF_CATEGORIES = ['Gasoline / Fuel','Transportation','Parking / Toll Fees','Food / Grocery','Office Supplies','Cleaning Supplies','Repairs & Maintenance','Utilities','Miscellaneous','Staff Welfare','Client Expense'] as const;
/** Local reference catalogue for frontend validation. Replace source with Supabase vehicle directory later. */
export const CAR_CATALOG = [
 'Toyota Vios','Toyota Wigo','Toyota Innova','Toyota Fortuner','Toyota Hilux','Toyota Corolla Altis','Toyota Avanza','Toyota Rush','Toyota Raize','Toyota Yaris','Toyota Hiace','Toyota Camry','Toyota Land Cruiser',
 'Honda City','Honda Civic','Honda Brio','Honda Jazz','Honda CR-V','Honda HR-V','Honda BR-V','Honda Accord',
 'Mitsubishi Mirage','Mitsubishi Mirage G4','Mitsubishi Xpander','Mitsubishi Montero Sport','Mitsubishi Strada','Mitsubishi L300',
 'Nissan Almera','Nissan Navara','Nissan Terra','Nissan Urvan','Nissan Kicks',
 'Ford Ranger','Ford Everest','Ford Territory','Ford EcoSport','Ford Explorer',
 'Suzuki Swift','Suzuki Dzire','Suzuki Ertiga','Suzuki Celerio','Suzuki Jimny','Suzuki S-Presso',
 'Hyundai Accent','Hyundai Stargazer','Hyundai Tucson','Hyundai Santa Fe','Hyundai Starex','Hyundai Creta',
 'Kia Soluto','Kia Stonic','Kia Seltos','Kia Sportage','Kia Carnival',
 'Isuzu D-Max','Isuzu mu-X','Chevrolet Trailblazer','Chevrolet Colorado','Mazda 2','Mazda 3','Mazda CX-5','Subaru Forester','Subaru XV','Subaru Impreza',
 'MG 5','MG ZS','Geely Coolray','Geely Okavango','BYD Atto 3','BYD Seal','Chery Tiggo 7 Pro','Chery Tiggo 8 Pro','GAC GS3','GAC GS8'
] as const;
export const vehicleName=(brandModel:string,year:string|number)=>`${brandModel.trim()} ${String(year).trim()}`.trim();
export const monthRange=(month:string):[string,string]=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))month=todayPH().slice(0,7);const [y,m]=month.split('-').map(Number);return [`${month}-01`,`${month}-${String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0')}`];};
export const timeMinutesPH=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return Number(parts.find(p=>p.type==='hour')?.value||0)*60+Number(parts.find(p=>p.type==='minute')?.value||0);};
/** PB request period starts after previous fully approved replenishment. */
export function pendingRFPDisbursementRows(db:Database,branch:BranchId):FundEntry[]{
 const last=db.fundEntries.filter(e=>e.branch===branch&&e.fund==='RFP'&&e.kind==='replenishment'&&e.status==='Approved').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
 return db.fundEntries.filter(e=>e.branch===branch&&e.fund==='RFP'&&e.kind==='expense'&&e.status!=='Rejected'&&(!last||e.createdAt>last.createdAt)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export const BRANCH_NAME = (id:BranchId) => BRANCHES.find(b=>b.id===id)?.name || id;
export interface User {id:string;username:string;password:string;name:string;role:Role;branch:BranchId;active:boolean;lastLoginDate?:string;}
export interface Receipt {name:string;data:string}
export interface FundEntry {
  id:string;no:string;fund:Fund;kind:'expense'|'replenishment';branch:BranchId;date:string;amount:number;category:string;payee:string;vat:'VAT'|'Non-VAT';voucher:string;receiptNo:string;tin:string;description:string;notes:string;proof?:Receipt;signature?:string;onlineCharge?:number;
  status:Status;createdBy:string;createdAt:string;decisionBy?:string;decisionAt?:string;decisionNote?:string;
  plate?:string;car?:string;quantity?:number;unitCost?:number;linkedPosId?:string;purchaseId?:string;checkNo?:string;bank?:string;depositDate?:string;
  /** Frontend-only review stages. Production Accounting and President approvals must be authenticated through shared Supabase. */
  accountingStatus?:'Pending'|'Verified'|'Returned';presidentStatus?:'Pending'|'Approved'|'Rejected';
  accountingBy?:string;accountingAt?:string;presidentBy?:string;presidentAt?:string;receivedAt?:string;
  /** Internal routing for replenishment disbursements. Legacy records without it remain viewable. */
  requestedApproverId?:string;disbursementReviewStatus?:'Pending'|'Approved'|'Returned';
  disbursementReviewedBy?:string;disbursementReviewedAt?:string;disbursementReviewNote?:string;
}
export type InventoryCategory = 'Automotive Parts & Products'|'Shop Supplies';
export interface InventoryProduct {id:string;barcode:string;name:string;category:InventoryCategory;branch:BranchId;unit:string;/** Legacy stored value; not used for POS pricing. */sellPrice?:number;unitCost:number;openingQty:number;reorderAt:number;createdAt:string;updatedAt?:string;updatedBy?:string;archivedAt?:string;trackingMode?:'quantity'|'serialized';priceConfigured?:boolean;pendingInitialQty?:number;pendingUnitCodes?:string[];}
/** Append-only movement ledger. StockOut and StockReturn records must never be mutated. */
export interface StockMovement {id:string;productId:string;branch:BranchId;kind:'StockIn'|'StockOut'|'StockReturn';qty:number;unitCost:number;posId?:string;sourceStockOutId?:string;by:string;at:string;notes?:string;unitCodes?:string[];receiptId?:string;issueId?:string;}
export interface StockReceiptLine {productId:string;qty:number;unitCodes?:string[];}
/** A pending Stock In does not alter available inventory. Admin verifies physical count first. */
export interface StockReceipt {id:string;branch:BranchId;reference:string;lines:StockReceiptLine[];notes:string;proof?:Receipt;status:'Pending'|'Approved'|'Rejected';createdBy:string;createdAt:string;verifiedBy?:string;verifiedAt?:string;verificationNotes?:string;physicalCountConfirmed?:boolean;}
/** Stock is never deducted by a scan or a cashier request. A different Admin
 * authorizes a documented issue against an existing open POS/vehicle. */
export interface StockIssueRequest {id:string;branch:BranchId;posId:string;lines:StockReceiptLine[];reason:string;status:'Pending'|'Approved'|'Rejected';createdBy:string;createdAt:string;decidedBy?:string;decidedAt?:string;decisionNotes?:string;}
export interface StockCorrection {id:string;stockOutId:string;branch:BranchId;posId:string;qty:number;reason:string;requestedBy:string;requestedAt:string;status:'Pending'|'Approved'|'Rejected';decidedBy?:string;decidedAt?:string;decisionNotes?:string;}
export interface POSLine {id:string;type:'Service'|'Part';name:string;qty:number;price:number;lineTotal?:number;cost:number;supplier?:string;receiptNo?:string;proof?:Receipt;costSource?:'Direct'|'PB / Inventory'|'No direct cost';}
export interface POSPayment {id:string;mode:'Cash'|'GCash'|'Bank Transfer'|'Card';amount:number;date:string;terminalId?:string;provider?:string;reference?:string;}
export interface TerminalEvent {id:string;branch:BranchId;mode:'GCash'|'Bank Transfer'|'Card';kind:'Payment'|'Declined'|'Void'|'Refund';provider:string;terminalId:string;reference:string;amount:number;date:string;notes:string;posId?:string;paymentId?:string;originalEventId?:string;createdBy:string;createdAt:string;}
export interface TerminalSettlement {id:string;branch:BranchId;date:string;provider:string;terminalId:string;batchRef:string;expected:number;reportedTotal:number;variance:number;unmatchedAtSubmission:number;exceptionCountAtSubmission:number;notes:string;recordedBy:string;recordedAt:string;status:'Pending'|'Verified'|'Flagged';supersedesId?:string;reviewedBy?:string;reviewedAt?:string;reviewNotes?:string;}
export interface POSDraftHistory {revision:number;at:string;by:string;action:string;before?:{client:string;phone:string;vehicle:string;plate:string;concern:string;date:string;items:Partial<POSLine>[];cogsReviewedAt?:string};after:{client:string;phone:string;vehicle:string;plate:string;concern:string;date:string;items:Partial<POSLine>[];cogsReviewedAt?:string};}
export type POSServiceType = 'Checkup Only'|'Repair / Service'|'Parts & Repair'|'Checkup → Repair';
export interface POS {serviceType?:POSServiceType;id:string;no:string;branch:BranchId;date:string;client:string;phone:string;vehicle:string;plate:string;concern:string;items:POSLine[];payments:POSPayment[];draftHistory?:POSDraftHistory[];firstQuotation?:{items:POSLine[];saleTotal:number;savedAt:string;savedBy:string};quotationPhase?:'Initial'|'Final';status:'Pending'|'Closed';parentId?:string;createdBy:string;createdAt:string;closedAt?:string;cogsReviewedAt?:string;cogsReviewedBy?:string;}
export interface DeletedPOSDraft {id:string;no:string;branch:BranchId;plate:string;deletedAt:string;deletedBy:string;reason:string;original:POS;}
export interface Count {id:string;branch:BranchId;userId:string;date:string;kind:'BOD'|'EOD';actual:number;expected:number;difference:number;notes:string;createdAt:string;denominations?:Record<string,number>;signature?:string;scope?:'Sales Cash'|'RF'|'RFP';}
export interface Incident {id:string;branch:BranchId;userId:string;date:string;type:'Missed Opening'|'Missed Closing'|'Missed Sales Turnover'|'Cash Discrepancy'|'Expense Explanation';detail:string;status:'Required'|'Submitted'|'Reviewed';explanation:string;createdAt:string;submittedAt?:string;entryId?:string;reviewedAt?:string;}
export interface Turnover {id:string;branch:BranchId;date:string;amount:number;notes:string;signature?:string;createdBy:string;createdAt:string;kind?:'Sales'|'Funds';expected?:number;actual?:number;variance?:number;}
export interface ChangeRequest {id:string;type:'Edit RFP'|'Change Branch';entryId:string;branch:BranchId;requestedBy:string;changes:Partial<FundEntry>;original?:Partial<FundEntry>;reason:string;status:'Pending'|'Approved'|'Rejected';createdAt:string;decidedBy?:string;}
export interface Audit {id:string;at:string;by:string;action:string;detail:string;}
export interface Database {
  users:User[];fundEntries:FundEntry[];disbursementRequests?:DisbursementRequest[];pos:POS[];deletedPOSDrafts?:DeletedPOSDraft[];inventory:InventoryProduct[];stockMovements:StockMovement[];stockRequests:StockCorrection[];stockReceipts:StockReceipt[];stockIssues?:StockIssueRequest[];terminalEvents?:TerminalEvent[];terminalSettlements?:TerminalSettlement[];counts:Count[];incidents:Incident[];turnovers:Turnover[];requests:ChangeRequest[];audit:Audit[];
  settings:{rfBase:Record<BranchId,number>;rfpBase:Record<BranchId,number>;categories:string[];signatories?:{checked:string;approved:string};reportLogo?:Receipt};
}
export const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ID-${Date.now()}-${Math.random().toString(36).slice(2,7)}`);
export function todayPH():string {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function hourPH():number {return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',hourCycle:'h23'}).format(new Date()));}
export function datePH(date:string){return new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-PH',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Manila'});}
export const pesos = (n:number) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
export const money = (n:number) => new Intl.NumberFormat('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
export const number = (v:unknown) => Math.max(0,Number(v)||0);
/** A clean browser starts without demo transactions, inventory, balances or accounts.
 * The first administrator creates an account through the one-time setup screen. */
export function createSeed():Database {
 const empty=():Record<BranchId,number>=>({UCQC:0,UCM:0,UCLP:0,MMM:0});
 return {users:[],fundEntries:[],disbursementRequests:[],pos:[],deletedPOSDrafts:[],inventory:[],stockMovements:[],stockRequests:[],stockReceipts:[],stockIssues:[],terminalEvents:[],terminalSettlements:[],counts:[],incidents:[],turnovers:[],requests:[],audit:[],settings:{rfBase:empty(),rfpBase:empty(),categories:[...RF_CATEGORIES],signatories:{checked:'',approved:''}}};
}

/** Frontend-only first-run bootstrap. No preconfigured passwords or seed accounts. */
export function setupFirstAdmin(db:Database,details:{name:string;username:string;password:string;branch:BranchId}):Database {
 if(db.users.length)throw new Error('Initial admin setup is only available when no user accounts exist.');
 const name=details.name.trim(),username=details.username.trim().toLowerCase();
 if(name.length<2)throw new Error('Enter the administrator full name.');
 if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))throw new Error('Username must contain 3–32 letters, numbers, dots, underscores or hyphens.');
 if(details.password.length<10)throw new Error('Use a password with at least 10 characters.');
 if(!BRANCHES.some(b=>b.id===details.branch))throw new Error('Select a valid administrator branch.');
 const account:User={id:uid(),name,username,password:details.password,role:'admin',branch:details.branch,active:true};
 return log({...db,users:[account]},account.id,'Initial administrator created',`Admin setup for ${username} · ${BRANCH_NAME(details.branch)}`);
}

/** Upgrades must never silently delete existing login accounts.
 * Even accounts originally used for demonstrations may be the only way to access
 * work stored in this browser. New installations remain account-free via createSeed().
 * Administrators can explicitly deactivate accounts once a replacement exists.
 */
export function removeEmptyDemoAccounts(db:Database,_hasSavedOfficeFiles=false):Database {
 return db;
}

/** Remove ONLY the recognizable untouched v9.0-v9.8 sample records when loading
 * an existing browser database. Never reset genuine business data or identifiers.
 * References to an old sample POS/fund record keep the record intact. */
export function removeLegacySeedFixtures(db:Database):Database {
 const demoPOS=db.pos.find(p=>p.no==='UCM-POS-00000001'&&p.client==='Sample Customer'&&p.plate==='ABC1234'&&p.vehicle==='Toyota Vios 2020'&&p.concern==='Routine service'&&p.status==='Closed'&&p.items.length===2&&p.items[0].name==='Oil Change'&&p.items[0].price===1800&&p.items[1].name==='Engine Oil'&&p.items[1].price===2200&&p.payments.length===1&&p.payments[0].mode==='Cash'&&p.payments[0].amount===4000);
 const referencedPOS=demoPOS&&(
   db.stockMovements.some(m=>m.posId===demoPOS.id)||
   (db.stockIssues||[]).some(i=>i.posId===demoPOS.id)||
   db.pos.some(p=>p.parentId===demoPOS.id)||
   db.fundEntries.some(e=>e.linkedPosId===demoPOS.id)||
   (db.terminalEvents||[]).some(e=>e.posId===demoPOS.id)
 );
 const pos=demoPOS&&!referencedPOS?db.pos.filter(p=>p.id!==demoPOS.id):db.pos;
 const patterns=[
  {no:'UCM-Rotating Fund-00000001',branch:'UCM',amount:1250,payee:'Shop Supplies Co.',category:'Office Supplies',fund:'RF',createdBy:'u-cashier'},
  {no:'UCQC-Rotating Fund-00000001',branch:'UCQC',amount:680,payee:'Office Mart',category:'Office Supplies',fund:'RF',createdBy:'u-admin'},
  {no:'UCM-RFP-00000001',branch:'UCM',amount:3800,payee:'Auto Parts Supplier',category:'Automotive Parts',fund:'RFP',createdBy:'u-pb'}
 ];
 const matches=(e:FundEntry)=>patterns.some(p=>e.no===p.no&&e.branch===p.branch&&e.amount===p.amount&&e.payee===p.payee&&e.category===p.category&&e.fund===p.fund&&e.createdBy===p.createdBy)&&e.kind==='expense'&&e.voucher===''&&e.receiptNo===''&&e.tin===''&&e.notes==='Sample transaction for frontend testing'&&!e.linkedPosId&&!e.purchaseId&&!db.requests.some(r=>r.entryId===e.id)&&!db.incidents.some(i=>i.entryId===e.id);
 const fundEntries=db.fundEntries.filter(e=>!matches(e));
 const audit=db.audit.filter(a=>!(a.by==='system'&&a.action==='Demo initialized'&&a.detail==='Sample data created; amounts are illustrative only'));
 const removed=(db.pos.length-pos.length)+(db.fundEntries.length-fundEntries.length)+(db.audit.length-audit.length);
 if(!removed)return db;
 // Clear inherited demo fund balances only if the browser had *nothing else*
 // besides the three original seed expenses and original seed POS.
 const noGenuineRecords=!(db.disbursementRequests||[]).length&&!pos.length&&!fundEntries.length&&!db.inventory.length&&!db.stockMovements.length&&!db.stockRequests.length&&!db.stockReceipts.length&&!(db.stockIssues||[]).length&&!(db.terminalEvents||[]).length&&!(db.terminalSettlements||[]).length&&!db.counts.length&&!db.incidents.length&&!db.turnovers.length&&!db.requests.length&&!audit.length;
 const initialAmountsUnchanged=BRANCHES.every(b=>db.settings.rfBase[b.id]===50000&&db.settings.rfpBase[b.id]===120000);
 const settings=noGenuineRecords&&initialAmountsUnchanged?{...db.settings,rfBase:{UCQC:0,UCM:0,UCLP:0,MMM:0},rfpBase:{UCQC:0,UCM:0,UCLP:0,MMM:0}}:db.settings;
 const cleanAudit=noGenuineRecords?audit:[{id:uid(),at:new Date().toISOString(),by:'system',action:'Legacy demo fixture cleanup',detail:`Removed ${db.pos.length-pos.length} untouched sample POS and ${db.fundEntries.length-fundEntries.length} untouched sample fund expense(s). Preserved genuine transactions and references.`},...audit];
 return {...db,pos,fundEntries,audit:cleanAudit,settings};
}

/** v8.4 migration: only discard untouched auto-created v8.0–v8.3 sample products.
 * Never delete an Admin-created product, an edited sample, or any product
 * referenced by a stock movement. Stock Out/COGS/audit history stay intact. */
export function removeUntouchedDemoProducts(db:Database):Database {
 const demoDetails:{suffix:string;name:string;category:InventoryCategory;unit:string;sellPrice:number;unitCost:number;openingQty:number;reorderAt:number}[]=[
  {suffix:'10001',name:'Engine Oil 5W-30',category:'Automotive Parts & Products',unit:'Bottle',sellPrice:780,unitCost:440,openingQty:24,reorderAt:5},
  {suffix:'10002',name:'Oil Filter',category:'Automotive Parts & Products',unit:'Piece',sellPrice:550,unitCost:310,openingQty:12,reorderAt:4},
  {suffix:'10003',name:'Cleaning Detergent',category:'Shop Supplies',unit:'Bottle',sellPrice:0,unitCost:160,openingQty:15,reorderAt:3}
 ];
 const referenced=new Set((db.stockMovements||[]).map(m=>m.productId));
 const isLegacyDemo=(p:InventoryProduct)=>{
  const fixture=demoDetails.find(d=>p.barcode===`${p.branch}${d.suffix}`);
  return !!fixture && p.name===fixture.name && p.category===fixture.category
   && p.unit===fixture.unit && p.sellPrice===fixture.sellPrice
   && p.unitCost===fixture.unitCost && p.openingQty===fixture.openingQty
   && p.reorderAt===fixture.reorderAt && !p.updatedAt && !p.updatedBy;
 };
 let removed=0,archived=0;
 const inventory=(db.inventory||[]).flatMap(p=>{
  if(!isLegacyDemo(p)||p.archivedAt)return [p];
  if(referenced.has(p.id)){
   archived++;
   // Preserve original product identity for posted Stock Out, COGS and audit.
   // Archived products are hidden from usable inventory and can't be issued again.
   return [{...p,archivedAt:new Date().toISOString()}];
  }
  removed++;return [];
 });
 return !removed&&!archived?db:log({...db,inventory},'system','Demo inventory cleanup',`Removed ${removed} untouched sample products; archived ${archived} used samples to preserve POS/COGS history.`);
}

export const STORAGE_KEY = 'underchargers-fund-management-demo-v1';
export function loadDB():Database {if(typeof window==='undefined')return createSeed();try{const s=localStorage.getItem(STORAGE_KEY);if(s){const d=JSON.parse(s) as Database;if(d?.settings?.rfBase && Array.isArray(d.users) && Array.isArray(d.pos) && Array.isArray(d.fundEntries)){const legacy=['Shop Supplies','Cleaning','Maintenance','Other'];const categories=d.settings.categories||[];d.settings.categories=[...RF_CATEGORIES,...categories.filter(c=>!legacy.includes(c)&&!RF_CATEGORIES.some(a=>a===c))];d.settings.signatories=d.settings.signatories||{checked:'',approved:''};d.turnovers=(d.turnovers||[]).map(t=>({...t,kind:t.kind||'Sales',actual:t.actual??t.amount}));d.inventory=d.inventory||[];d.stockMovements=d.stockMovements||[];d.stockRequests=d.stockRequests||[];d.stockReceipts=d.stockReceipts||[];d.stockIssues=d.stockIssues||[];d.deletedPOSDrafts=d.deletedPOSDrafts||[];d.disbursementRequests=d.disbursementRequests||[];d.terminalEvents=d.terminalEvents||[];d.terminalSettlements=d.terminalSettlements||[];const cleaned=removeLegacySeedFixtures(removeUntouchedDemoProducts(d));const officeRaw=localStorage.getItem('uc_report_studio_v1');let hasFiles=false;try{hasFiles=Array.isArray(JSON.parse(officeRaw||'[]'))&&JSON.parse(officeRaw||'[]').length>0;}catch{hasFiles=!!officeRaw;}return removeEmptyDemoAccounts(cleaned,hasFiles);}}}catch{}return createSeed();}
export function storeDB(db:Database):boolean {try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));return true;}catch{return false;}}
export const expenseGross=(entry:Pick<FundEntry,'amount'|'onlineCharge'>)=>Math.round((entry.amount+(entry.onlineCharge||0))*100)/100;
export function balance(db:Database,branch:BranchId,fund:Fund):number {
 const initial=(fund==='RF'?db.settings.rfBase:db.settings.rfpBase)[branch]||0;
 return db.fundEntries.filter(e=>e.branch===branch&&e.fund===fund&&e.status!=='Rejected').reduce((sum,e)=>sum+(e.kind==='replenishment'?(e.status==='Approved'?e.amount:0):-expenseGross(e)),initial);
}
/** Only replace cash that has already been spent and not yet replenished. 
 * Pending replenishments are not included in the cash-on-hand balance; a second
 * request is blocked in the UI until the previous one is decided. */
export function replenishmentDue(db:Database, branch:BranchId, fund:Fund):number {
 const target=(fund==='RF'?db.settings.rfBase:db.settings.rfpBase)[branch]||0;
 return Math.round(Math.max(0,target-balance(db,branch,fund))*100)/100;
}

/** Per-branch financial summary: no fund movements or balances cross branch boundaries. */
export function branchFundTotals(db:Database,fund:Fund){
 const rows=BRANCHES.map(b=>{
  const target=(fund==='RF'?db.settings.rfBase:db.settings.rfpBase)[b.id]||0;
  const expenses=db.fundEntries.filter(e=>e.branch===b.id&&e.fund===fund&&e.kind==='expense'&&e.status!=='Rejected').reduce((n,e)=>n+expenseGross(e),0);
  const received=db.fundEntries.filter(e=>e.branch===b.id&&e.fund===fund&&e.kind==='replenishment'&&e.status==='Approved').reduce((n,e)=>n+e.amount,0);
  return {branch:b.id,name:b.name,target,expenses,received,remaining:balance(db,b.id,fund),toReplenish:replenishmentDue(db,b.id,fund)};
 });
 return {rows,grand:rows.reduce((s,r)=>({target:s.target+r.target,expenses:s.expenses+r.expenses,received:s.received+r.received,remaining:s.remaining+r.remaining,toReplenish:s.toReplenish+r.toReplenish}),{target:0,expenses:0,received:0,remaining:0,toReplenish:0})};
}

export function nextNumber(db:Database,branch:BranchId,type:'RF'|'RFP'|'POS'):string {
  const prefix=type==='RF'?`${branch}-Rotating Fund-`:`${branch}-${type}-`;const all=type==='POS'?[...db.pos.map(v=>v.no),...(db.deletedPOSDrafts||[]).map(v=>v.no)]:db.fundEntries.filter(v=>v.fund===type).map(v=>v.no);
  const max=Math.max(0,...all.filter(v=>v.startsWith(prefix)).map(v=>Number(v.slice(prefix.length))||0));
  return `${prefix}${String(max+1).padStart(8,'0')}`;
}
export function log(db:Database,by:string,action:string,detail:string):Database {return {...db,audit:[{id:uid(),at:new Date().toISOString(),by,action,detail},...db.audit].slice(0,1000)};}
export const posLineTotal=(i:POSLine)=>i.lineTotal??Math.round(i.qty*i.price*100)/100;
export const posTotal=(p:POS)=>Math.round(p.items.reduce((v,i)=>v+posLineTotal(i),0)*100)/100;
export const paidTotal=(p:POS)=>p.payments.reduce((v,i)=>v+i.amount,0);
/** Branch-aware stock quantity from initial count and immutable ledger. */
export function stockAvailable(db:Database,p:InventoryProduct):number {
 return Math.round((p.openingQty+(db.stockMovements||[]).filter(m=>m.productId===p.id&&m.branch===p.branch).reduce((n,m)=>n+(m.kind==='StockOut'?-m.qty:m.qty),0))*1000)/1000;
}
export function postedStockOuts(db:Database,posId:string):StockMovement[]{
 return (db.stockMovements||[]).filter(m=>m.posId===posId&&m.kind==='StockOut');
}
export function returnableQty(db:Database,stockOutId:string):number {
 const out=(db.stockMovements||[]).find(m=>m.id===stockOutId&&m.kind==='StockOut');
 if(!out)return 0;
 const returned=(db.stockMovements||[]).filter(m=>m.kind==='StockReturn'&&m.sourceStockOutId===stockOutId).reduce((n,m)=>n+m.qty,0);
 return Math.max(0,out.qty-returned);
}
export function pendingReturnQty(db:Database,stockOutId:string):number {
 return (db.stockRequests||[]).filter(r=>r.stockOutId===stockOutId&&r.status==='Pending').reduce((n,r)=>n+r.qty,0);
}
/** Pure, checked ledger operations make duplicate scans and unauthorized stock changes testable. */
/** Demo data permission guard. Production must enforce this in Supabase RLS/server APIs too. */
export type ProductDetails = Pick<InventoryProduct,'barcode'|'name'|'category'|'unit'|'unitCost'|'reorderAt'|'trackingMode'>;
export type NewInventoryProduct = ProductDetails & {branch:BranchId;initialQty:number;initialUnitCodes?:string[]};
/** Admin scan-first registration. No cost or selling price on the initial scan/name form. */
export type PendingInventoryRegistration = {
 branch:BranchId;barcode:string;name:string;category:InventoryCategory;unit:string;reorderAt:number;
 trackingMode:'quantity'|'serialized';initialQty:number;initialUnitCodes?:string[];
};
export type ProductCostUpdate = {productId:string;unitCost:number};
/** Legacy exported name retained for existing integrations; selling price is not a product-master field. */
export type ProductPriceUpdate = ProductCostUpdate;
export const needsCostConfiguration=(p:InventoryProduct)=>p.priceConfigured===false;
export const needsPriceConfiguration=needsCostConfiguration;

/** Atomic Admin registration of scanned physical products into Pending Stock.
 * No Stock In movement and no available quantity are posted until actual unit cost is configured. */
export function registerPendingInventoryProducts(db:Database,inputs:PendingInventoryRegistration[],by:string,registrationOnly=false):Database {
 requireAdmin(db,by);
 if(!inputs.length)throw new Error('Scan and name at least one product.');
 const seen=new Set<string>();
 const allUnitCodes=new Set((db.stockMovements||[]).flatMap(m=>m.unitCodes||[]));
 const products:InventoryProduct[]=inputs.map(input=>{
  if(!BRANCHES.some(b=>b.id===input.branch))throw new Error('Invalid receiving branch.');
  const barcode=input.barcode.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const name=input.name.trim(),unit=input.unit.trim()||'Piece';
  if(!barcode||!name)throw new Error('Product name and barcode are required for each scan.');
  if(!['Automotive Parts & Products','Shop Supplies'].includes(input.category))throw new Error('Select a valid product category.');
  if(!Number.isInteger(input.reorderAt)||input.reorderAt<0)throw new Error('Invalid low-stock threshold.');
  if(!Number.isInteger(input.initialQty)||input.initialQty<(registrationOnly?0:1))throw new Error('Invalid initial quantity for registration.');
  const key=`${input.branch}:${barcode}`;
  if(seen.has(key)||db.inventory.some(p=>p.branch===input.branch&&p.barcode===barcode))throw new Error(`Duplicate product barcode ${barcode} in ${input.branch}.`);
  seen.add(key);
  const codes=(input.initialUnitCodes||[]).map(v=>v.toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean);
  if(input.trackingMode==='serialized'){
   if(codes.length!==input.initialQty||new Set(codes).size!==codes.length||codes.some(code=>allUnitCodes.has(code)))throw new Error(`Unique unit codes required for every physically counted ${name}.`);
   codes.forEach(code=>allUnitCodes.add(code));
  }
  return {id:uid(),barcode,name,category:input.category,branch:input.branch,unit,unitCost:0,openingQty:0,reorderAt:input.reorderAt,createdAt:new Date().toISOString(),trackingMode:input.trackingMode,priceConfigured:false,pendingInitialQty:input.initialQty,...(input.trackingMode==='serialized'?{pendingUnitCodes:codes}:{})};
 });
 return log({...db,inventory:[...products,...db.inventory]},by,'Pending Stock products submitted',`${products.length} products · ${products.map(p=>`${p.barcode} (${p.branch})`).join(', ')} · Awaiting cost configuration`);
}

/** Configure actual COGS unit cost and post verified initial stock; NO fixed selling price is saved. */
export function configurePendingProductCosts(db:Database,updates:ProductCostUpdate[],by:string):Database {
 requireAdmin(db,by);
 if(!updates.length)throw new Error('Select at least one Pending Stock product.');
 let next=db;
 const seen=new Set<string>();
 for(const item of updates){
  if(seen.has(item.productId))throw new Error('Repeated product cost entry.');
  seen.add(item.productId);
  const product=next.inventory.find(p=>p.id===item.productId&&!p.archivedAt);
  if(!product||!needsCostConfiguration(product))throw new Error('Product is not awaiting cost configuration.');
  if(!Number.isFinite(item.unitCost)||item.unitCost<=0)throw new Error(`Enter a valid positive Unit Cost for ${product.name}.`);
  const qty=product.pendingInitialQty||0;
  const codes=product.pendingUnitCodes||[];
  if(!Number.isInteger(qty)||qty<0)throw new Error('Pending quantity is invalid. Please investigate.');
  if(product.trackingMode==='serialized'&&codes.length!==qty)throw new Error('Pending serial unit codes do not match the receiving count.');
  const at=new Date().toISOString();
  const movement:StockMovement|undefined=qty>0?{id:uid(),productId:product.id,branch:product.branch,kind:'StockIn',qty,unitCost:item.unitCost,by,at,notes:'Legacy initial physical stock entry from product registration',...(product.trackingMode==='serialized'?{unitCodes:[...codes]}:{})}:undefined;
  next=log({...next,inventory:next.inventory.map(p=>p.id===product.id?{...p,unitCost:item.unitCost,priceConfigured:true,pendingInitialQty:0,pendingUnitCodes:undefined,updatedAt:at,updatedBy:by}:p),stockMovements:movement?[movement,...next.stockMovements]:next.stockMovements},by,movement?'Legacy cost configuration + initial stock posting':'Unit cost set — no stock credited',`${product.barcode} · ${product.name} · ${qty} initial units · ${product.branch} · Unit COGS ${item.unitCost}`);
 }
 return next;
}

/** Compatibility for older imports; now configures COGS only. */
export const configurePendingProductPrices=configurePendingProductCosts;

function requireAdmin(db:Database,by:string):User {
 const actor=db.users.find(u=>u.id===by&&u.active);
 if(!actor||actor.role!=='admin')throw new Error('Only Admin can register or update inventory products.');
 return actor;
}
function cleanProductDetails(input:ProductDetails):ProductDetails {
 const barcode=input.barcode.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const name=input.name.trim(),unit=input.unit.trim()||'Piece';
 if(!barcode||!name||!Number.isFinite(input.unitCost)||input.unitCost<=0||!Number.isInteger(input.reorderAt)||input.reorderAt<0)throw new Error('Valid barcode, product name, positive unit cost, and alert quantity are required.');
 if(!['Automotive Parts & Products','Shop Supplies'].includes(input.category))throw new Error('Invalid product category.');
 return {barcode,name,unit,category:input.category,unitCost:input.unitCost,reorderAt:input.reorderAt,trackingMode:input.trackingMode||'quantity'};
}
export function registerInventoryProduct(db:Database,input:NewInventoryProduct,by:string):Database {
 requireAdmin(db,by);
 if(!BRANCHES.some(b=>b.id===input.branch))throw new Error('Choose a valid branch.');
 const details=cleanProductDetails(input);
 if(!Number.isInteger(input.initialQty)||input.initialQty<0)throw new Error('Initial quantity must be a nonnegative whole number.');
 if((details.trackingMode||'quantity')==='serialized'&&input.initialQty>0){
  const codes=(input.initialUnitCodes||[]).map(v=>v.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean);
  if(codes.length!==input.initialQty||new Set(codes).size!==codes.length)throw new Error('Provide one distinct serial barcode for EACH physically counted unit.');
  const used=new Set((db.stockMovements||[]).flatMap(m=>m.unitCodes||[]));
  if(codes.some(c=>used.has(c)))throw new Error('One or more serialized unit codes are already assigned.');
 }
 if(db.inventory.some(p=>p.branch===input.branch&&p.barcode===details.barcode))throw new Error('Barcode already registered in this branch.');
 const product:InventoryProduct={...details,id:uid(),branch:input.branch,openingQty:0,createdAt:new Date().toISOString()};
 const next=log({...db,inventory:[product,...db.inventory]},by,'Inventory product created',`${details.barcode} · ${details.name} · ${input.branch}`);
 if(!input.initialQty)return next;
 if(details.trackingMode==='serialized'){
  const movement:StockMovement={id:uid(),productId:product.id,branch:product.branch,kind:'StockIn',qty:input.initialQty,unitCost:product.unitCost,by,at:new Date().toISOString(),notes:'Admin physical count confirmed during new product registration',unitCodes:input.initialUnitCodes!.map(v=>v.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean)};
  return log({...next,stockMovements:[movement,...next.stockMovements]},by,'Initial serialized Stock In',`${product.name} · +${input.initialQty} individually tagged units · ${product.branch}`);
 }
 return recordStockIn(next,product.id,input.initialQty,by,'Admin physical count confirmed during new product registration');
}
/** Atomic Admin-only batch product registration. An invalid row or duplicate rejects
 * the entire batch, so partial product lists are never persisted. */
export function registerInventoryProductsBulk(db:Database,items:NewInventoryProduct[],by:string):Database {
 requireAdmin(db,by);
 if(!items.length)throw new Error('Scan at least one new product before saving.');
 const seen=new Set<string>();
 for(const item of items){
  if(!BRANCHES.some(b=>b.id===item.branch))throw new Error('Choose a valid branch.');
  const code=cleanProductDetails(item).barcode;
  if(!Number.isInteger(item.initialQty)||item.initialQty<0)throw new Error('Initial quantity must be a nonnegative whole number.');
  const key=`${item.branch}:${code}`;
  if(seen.has(key))throw new Error(`Duplicate barcode in batch: ${code}`);
  if(db.inventory.some(p=>p.branch===item.branch&&p.barcode===code))throw new Error(`Already registered: ${code} (${item.branch})`);
  seen.add(key);
 }
 return items.reduce((next,item)=>registerInventoryProduct(next,item,by),db);
}
export function updateInventoryProduct(db:Database,productId:string,input:ProductDetails,by:string):Database {
 requireAdmin(db,by);
 const old=db.inventory.find(p=>p.id===productId);
 if(!old)throw new Error('Inventory product not found.');
 if((old.trackingMode||'quantity')!==(input.trackingMode||'quantity')&&(db.stockMovements.some(m=>m.productId===old.id)||(db.stockReceipts||[]).some(r=>r.lines.some(l=>l.productId===old.id))))throw new Error('Tracking mode is locked after the first inventory movement or receipt.');
 const details=cleanProductDetails(input);
 if(db.inventory.some(p=>p.id!==productId&&p.branch===old.branch&&p.barcode===details.barcode))throw new Error('Barcode already registered in this branch.');
 const fields:(keyof ProductDetails)[]=['barcode','name','category','unit','unitCost','reorderAt','trackingMode'];
 const changes=fields.filter(f=>old[f]!==details[f]).map(f=>`${f}: ${old[f]} → ${details[f]}`);
 if(!changes.length)return db;
 const next={...db,inventory:db.inventory.map(p=>p.id===productId?{...p,...details,updatedAt:new Date().toISOString(),updatedBy:by}:p)};
 return log(next,by,'Inventory product updated',`${old.branch} · ${old.id} · ${changes.join(' | ')}`);
}
export function recordStockIn(db:Database,productId:string,qty:number,by:string,notes=''):Database {
 const product=db.inventory.find(p=>p.id===productId);
 if(product?.trackingMode==='serialized')throw new Error('Serialized units require individually verified barcode Stock In.');
 if(!product||product.archivedAt||!Number.isInteger(qty)||qty<=0)throw new Error('Invalid/archived product or positive quantity required.');
 const actor=db.users.find(u=>u.id===by&&u.active);
 if(!actor||actor.role!=='admin')throw new Error('No Stock In access: Cashier Stock In requires Admin verification.');
 const movement:StockMovement={id:uid(),productId,branch:product.branch,kind:'StockIn',qty,unitCost:product.unitCost,by,at:new Date().toISOString(),notes};
 return log({...db,stockMovements:[movement,...db.stockMovements]},by,'Stock In',`${product.name} · ${product.branch} · +${qty}`);
}
const normUnitCode=(v:string)=>v.trim().toUpperCase().replace(/\s+/g,'');
function verifiedUnitCodes(db:Database,productId:string):Set<string>{
 const live=new Set<string>();
 for(const movement of [...db.stockMovements].reverse()){
  if(movement.productId!==productId)continue;
  if(movement.kind==='StockIn'||movement.kind==='StockReturn')for(const c of movement.unitCodes||[])live.add(c);
  if(movement.kind==='StockOut')for(const c of movement.unitCodes||[])live.delete(c);
 }
 return live;
}
/** One receiving batch; scanner repeats never implicitly increase quantities. */
export function submitStockReceipt(db:Database,lines:StockReceiptLine[],reference:string,notes:string,by:string,proof?:Receipt,requireIndependentReview=false):Database {
 const actor=db.users.find(u=>u.id===by&&u.active);
 if(!actor||(actor.role!=='cashier'&&actor.role!=='admin'))throw new Error('Only Cashier or Admin may receive stock.');
 const receivingBranch:BranchId=actor.role==='admin'?(db.inventory.find(p=>p.id===lines[0]?.productId)?.branch||actor.branch):actor.branch;
 if(!lines.length||!reference.trim())throw new Error('Add items and a delivery reference before submitting Stock In.');
 if(!proof||!proof.name||!proof.data)throw new Error('Attach a supporting delivery receipt or photo for Stock In verification.');
 if((db.stockReceipts||[]).some(r=>r.branch===receivingBranch&&r.status!=='Rejected'&&r.reference.trim().toUpperCase()===reference.trim().toUpperCase()))throw new Error('This delivery reference already has a pending/approved receipt in the branch. Investigate duplicates before receiving again.');
 const seen=new Set<string>(),allCodes=new Set<string>(),cleanLines:StockReceiptLine[]=[];
 for(const line of lines){
  const p=db.inventory.find(p=>p.id===line.productId&&!p.archivedAt);
  if(!p||p.branch!==receivingBranch)throw new Error('Every Stock In item must belong to the selected receiving branch.');
  if(seen.has(p.id))throw new Error('Duplicate item row: edit its physical quantity instead.');
  seen.add(p.id);
  if(!Number.isInteger(line.qty)||line.qty<=0)throw new Error('Physical received quantity must be a positive whole number.');
  const codes=(line.unitCodes||[]).map(normUnitCode).filter(Boolean);
  if(p.trackingMode==='serialized'){
   if(codes.length!==line.qty)throw new Error(`${p.name}: enter one unique unit barcode per received item.`);
   const occupied=new Set((db.stockMovements||[]).flatMap(m=>m.unitCodes||[]));
   for(const r of db.stockReceipts||[])if(r.status==='Pending'||r.status==='Approved')for(const x of r.lines)for(const c of x.unitCodes||[])occupied.add(c);
   for(const c of codes){if(allCodes.has(c)||occupied.has(c))throw new Error(`Duplicate unit barcode: ${c}`);allCodes.add(c);}
  } else if(codes.length)throw new Error('Unit codes are only for serialized products.');
  cleanLines.push({productId:p.id,qty:line.qty,...(codes.length?{unitCodes:codes}:{})});
 }
 const confirmed=actor.role==='admin'&&!requireIndependentReview;
 const now=new Date().toISOString();
 const receipt:StockReceipt={id:uid(),branch:receivingBranch,reference:reference.trim(),lines:cleanLines,notes:notes.trim(),proof,status:confirmed?'Approved':'Pending',createdBy:by,createdAt:now,...(confirmed?{verifiedBy:by,verifiedAt:now,physicalCountConfirmed:true,verificationNotes:'Admin confirmed actual physical quantity and supporting delivery evidence on receipt.'}:{})};
 const newMovements:StockMovement[]=confirmed?cleanLines.map(line=>({id:uid(),productId:line.productId,branch:receivingBranch,kind:'StockIn',qty:line.qty,unitCost:db.inventory.find(p=>p.id===line.productId)!.unitCost,by,at:now,notes:`Admin physically verified stock receipt ${receipt.reference}`,receiptId:receipt.id,...(line.unitCodes?.length?{unitCodes:line.unitCodes}:{})})):[];
 return log({...db,stockReceipts:[receipt,...(db.stockReceipts||[])],stockMovements:[...newMovements,...db.stockMovements]},by,confirmed?'Admin Stock In physically verified and posted':'Stock In awaiting physical verification',`${receivingBranch} · ${reference} · ${cleanLines.length} products`);
}
/** Approval posts append-only Stock In movements atomically; a declined receipt changes no stock. */
export function reviewStockReceipt(db:Database,id:string,approve:boolean,by:string,physicalCountConfirmed:boolean,notes=''):Database {
 const actor=db.users.find(u=>u.id===by&&u.active),receipt=(db.stockReceipts||[]).find(r=>r.id===id);
 if(!actor||actor.role!=='admin'||!receipt||receipt.status!=='Pending')throw new Error('Only Admin can review a pending Stock In.');
 if(actor.id===receipt.createdBy)throw new Error('The Stock In preparer cannot verify their own receipt.');
 if(approve&&!physicalCountConfirmed)throw new Error('Admin must confirm physical count and delivery evidence first.');
 if(approve&&!receipt.proof&&!receipt.reference.trim())throw new Error('Delivery evidence/reference required.');
 for(const line of receipt.lines)if(approve&&!db.inventory.some(p=>p.id===line.productId&&!p.archivedAt&&p.branch===receipt.branch))throw new Error('Product or branch has changed. Reconcile before approving.');
 const at=new Date().toISOString();
 const stockMovements=approve?[...receipt.lines.map(x=>{const product=db.inventory.find(p=>p.id===x.productId)!;return {id:uid(),productId:x.productId,branch:receipt.branch,kind:'StockIn' as const,qty:x.qty,unitCost:product.unitCost,by,at,notes:`Verified Stock In: ${receipt.reference}`,receiptId:receipt.id,unitCodes:x.unitCodes};}),...db.stockMovements]:db.stockMovements;
 const stockReceipts=db.stockReceipts.map(r=>r.id===id?{...r,status:approve?'Approved' as const:'Rejected' as const,verifiedBy:by,verifiedAt:at,verificationNotes:notes,physicalCountConfirmed:approve?true:false}:r);
 return log({...db,stockMovements,stockReceipts},by,approve?'Physical Stock In approved':'Stock In rejected',`${receipt.branch} · ${receipt.reference} · ${notes}`);
}
/** Both Cashier and Admin-prepared receiving needs an independent reviewer.
 * Exact per-product counted quantities are required and immutable after submission. */
export function verifyControlledStockReceipt(db:Database,id:string,approve:boolean,by:string,counted:Record<string,number>,notes:string):Database {
 const receipt=(db.stockReceipts||[]).find(r=>r.id===id);
 if(!receipt||receipt.status!=='Pending')throw new Error('Pending Stock In receipt not found.');
 if(!notes.trim()||notes.trim().length<10)throw new Error('Enter verification findings (at least 10 characters).');
 if(approve){
  const keys=Object.keys(counted);
  if(keys.length!==receipt.lines.length||receipt.lines.some(line=>!Object.prototype.hasOwnProperty.call(counted,line.productId)||!Number.isInteger(counted[line.productId])||counted[line.productId]<0))throw new Error('Count every product independently before approval.');
  const mismatch=receipt.lines.find(line=>counted[line.productId]!==line.qty);
  if(mismatch){const item=db.inventory.find(p=>p.id===mismatch.productId);throw new Error(`Physical count mismatch for ${item?.name||mismatch.productId}. Expected ${mismatch.qty}, counted ${counted[mismatch.productId]}. Reject and submit a new corrected receipt; do not overwrite the original.`);}
 }
 return reviewStockReceipt(db,id,approve,by,approve,notes);
}
/** Reserve quantities while requests await approval. Physical stock is not yet deducted. */
export function pendingIssueQty(db:Database,productId:string,excludingIssueId=''):number {
 return (db.stockIssues||[]).filter(r=>r.status==='Pending'&&r.id!==excludingIssueId).flatMap(r=>r.lines).filter(l=>l.productId===productId).reduce((n,l)=>n+l.qty,0);
}
/** Do not release items from scanning alone. Link each request to an existing customer POS. */
export function requestStockIssue(db:Database,posId:string,lines:StockReceiptLine[],reason:string,by:string):Database {
 const actor=db.users.find(u=>u.id===by&&u.active),pos=db.pos.find(p=>p.id===posId);
 if(!actor||actor.role!=='cashier'||!pos||pos.branch!==actor.branch||pos.status!=='Pending')throw new Error('Stock release requires your branch Cashier and an existing open POS.');
 if(pos.quotationPhase==='Initial')throw new Error('Finish Final Quotation and COGS Review before requesting stock release on a downpayment POS.');
 if(!pos.plate.trim()||!pos.client.trim())throw new Error('Complete the POS plate number and customer before requesting stock release.');
 if(!reason.trim()||reason.trim().length<12)throw new Error('Describe the customer job / why these items are needed (at least 12 characters).');
 if(!lines.length)throw new Error('Scan at least one product.');
 const seen=new Set<string>(),serials=new Set<string>(),cleanLines:StockReceiptLine[]=[];
 for(const line of lines){
  const product=db.inventory.find(p=>p.id===line.productId&&!p.archivedAt);
  if(!product||product.branch!==actor.branch||needsPriceConfiguration(product))throw new Error('Product is unavailable or belongs to another branch.');
  if(seen.has(product.id))throw new Error('Duplicate product. Set one physical quantity per product.');
  seen.add(product.id);
  if(!Number.isInteger(line.qty)||line.qty<=0)throw new Error('Stock release quantities must be positive whole numbers.');
  if(line.qty>stockAvailable(db,product)-pendingIssueQty(db,product.id))throw new Error(`${product.name}: insufficient unreserved stock; another issue request may be pending.`);
  const codes=(line.unitCodes||[]).map(normUnitCode).filter(Boolean);
  if(product.trackingMode==='serialized'){
   const live=verifiedUnitCodes(db,product.id);
   if(codes.length!==line.qty||new Set(codes).size!==codes.length||!codes.every(c=>live.has(c)))throw new Error(`${product.name}: scan each unique available unit code.`);
   const reserved=new Set((db.stockIssues||[]).filter(r=>r.status==='Pending').flatMap(r=>r.lines).flatMap(l=>l.unitCodes||[]));
   for(const code of codes){if(serials.has(code)||reserved.has(code))throw new Error(`Unit code ${code} is already in a pending release.`);serials.add(code);}
  }else if(codes.length)throw new Error('Regular products cannot include unique unit codes.');
  cleanLines.push({productId:product.id,qty:line.qty,...(codes.length?{unitCodes:codes}:{})});
 }
 const request:StockIssueRequest={id:uid(),branch:actor.branch,posId,lines:cleanLines,reason:reason.trim(),createdBy:by,createdAt:new Date().toISOString(),status:'Pending'};
 return log({...db,stockIssues:[request,...(db.stockIssues||[])]},by,'Stock release requested — NOT deducted',`${pos.no} · ${actor.branch} · ${cleanLines.map(l=>`${db.inventory.find(p=>p.id===l.productId)?.barcode} x${l.qty}`).join(', ')} · ${request.reason}`);
}
/** Separate authorization: only Admin can post release; mismatch/shortage blocks ALL lines. */
export function decideStockIssue(db:Database,id:string,approve:boolean,by:string,notes:string):Database {
 const actor=db.users.find(u=>u.id===by&&u.active),request=(db.stockIssues||[]).find(r=>r.id===id);
 if(!actor||actor.role!=='admin'||!request||request.status!=='Pending')throw new Error('Only Admin can review a pending release request.');
 if(actor.id===request.createdBy)throw new Error('The request preparer cannot authorize their own stock release.');
 if(!notes.trim()||notes.trim().length<10)throw new Error('Add review findings / reason (at least 10 characters).');
 const pos=db.pos.find(p=>p.id===request.posId);
 if(approve&&(!pos||pos.status!=='Pending'||pos.branch!==request.branch))throw new Error('Associated POS was closed or changed. Reject this request and investigate.');
 const at=new Date().toISOString();
 const movements:StockMovement[]=[];
 if(approve){
  for(const line of request.lines){
   const product=db.inventory.find(p=>p.id===line.productId&&!p.archivedAt&&p.branch===request.branch);
   if(!product||needsPriceConfiguration(product))throw new Error('Product is no longer available for issue.');
   if(line.qty>stockAvailable(db,product))throw new Error(`${product.name}: physical stock no longer supports approval.`);
   if(product.trackingMode==='serialized'&&!(line.unitCodes||[]).every(c=>verifiedUnitCodes(db,product.id).has(c)))throw new Error('Serialized unit is no longer available.');
   movements.push({id:uid(),productId:product.id,branch:request.branch,kind:'StockOut',qty:line.qty,unitCost:product.unitCost,posId:request.posId,issueId:id,by,at,notes:`Admin-authorized release for ${pos!.no}: ${request.reason}; Review: ${notes.trim()}`,...(line.unitCodes?.length?{unitCodes:line.unitCodes}:{})});
  }
 }
 const stockIssues=(db.stockIssues||[]).map(r=>r.id===id?{...r,status:approve?'Approved' as const:'Rejected' as const,decidedBy:by,decidedAt:at,decisionNotes:notes.trim()}:r);
 return log({...db,stockIssues,stockMovements:approve?[...movements,...db.stockMovements]:db.stockMovements},by,approve?'Admin-authorized Stock Out posted':'Stock release rejected',`${pos?.no||request.posId} · ${request.branch} · ${request.lines.length} products · ${notes.trim()}`);
}
/** Multiple confirmed consumed products post together (all or nothing). */
export function confirmStockOutBatch(db:Database,posId:string,lines:StockReceiptLine[],by:string):Database {
 if(!lines.length)throw new Error('Scan at least one product before Stock Out.');
 const seen=new Set<string>();
 let next=db;
 for(const line of lines){
  if(seen.has(line.productId))throw new Error('Duplicate product. Edit quantity instead.');
  seen.add(line.productId);
  next=confirmStockOut(next,line.productId,posId,line.qty,by,line.unitCodes);
 }
 return next;
}
export function confirmStockOut(db:Database,productId:string,posId:string,qty:number,by:string,unitCodes?:string[]):Database {
 const product=db.inventory.find(p=>p.id===productId),pos=db.pos.find(p=>p.id===posId),actor=db.users.find(u=>u.id===by&&u.active);
 if(!actor||actor.role!=='cashier'||!product||product.archivedAt||!pos||actor.branch!==pos.branch||product.branch!==pos.branch||pos.status!=='Pending')throw new Error('Stock Out requires an open POS and authorized Cashier in the same branch.');
 if(needsPriceConfiguration(product))throw new Error('Product needs Admin Cost Configuration before POS consumption.');
 if(!Number.isInteger(qty)||qty<=0||stockAvailable(db,product)<qty)throw new Error('Insufficient stock or invalid quantity.');
 const codes=(unitCodes||[]).map(normUnitCode).filter(Boolean);
 if(product.trackingMode==='serialized'){const live=verifiedUnitCodes(db,product.id);if(codes.length!==qty||new Set(codes).size!==qty||!codes.every(c=>live.has(c)))throw new Error('Scan unique, available unit barcodes for every serialized item.');}
 else if(codes.length)throw new Error('Do not enter unit codes for regular products.');
 const movement:StockMovement={id:uid(),productId,branch:product.branch,kind:'StockOut',qty,unitCost:product.unitCost,posId,by,at:new Date().toISOString(),...(codes.length?{unitCodes:codes}:{})};
 return log({...db,stockMovements:[movement,...db.stockMovements]},by,'Locked Stock Out',`${product.name} · ${pos.no} · -${qty} · ${pesos(qty*product.unitCost)}`);
}
export function requestStockReturn(db:Database,stockOutId:string,qty:number,reason:string,by:string):Database {
 const out=db.stockMovements.find(m=>m.id===stockOutId&&m.kind==='StockOut'),actor=db.users.find(u=>u.id===by&&u.active);
 if(!out||!out.posId||!actor||actor.role!=='cashier'||actor.branch!==out.branch)throw new Error('Unauthorized stock return.');
 const available=returnableQty(db,stockOutId)-pendingReturnQty(db,stockOutId);
 if(!Number.isInteger(qty)||qty<=0||qty>available||!reason.trim())throw new Error('Invalid return quantity or missing reason.');
 const request:StockCorrection={id:uid(),stockOutId,branch:out.branch,posId:out.posId,qty,reason:reason.trim(),requestedBy:by,requestedAt:new Date().toISOString(),status:'Pending'};
 return log({...db,stockRequests:[request,...db.stockRequests]},by,'Stock Out return requested',`${out.id} · ${qty} · ${reason}`);
}
export function decideStockReturn(db:Database,requestId:string,approve:boolean,by:string,notes=''):Database {
 const req=db.stockRequests.find(r=>r.id===requestId),actor=db.users.find(u=>u.id===by&&u.active);
 if(!req||req.status!=='Pending'||!actor||actor.role!=='admin')throw new Error('Only Admin can decide a pending return.');
 if(approve&&req.qty>returnableQty(db,req.stockOutId))throw new Error('Return exceeds remaining Stock Out quantity.');
 const original=db.stockMovements.find(m=>m.id===req.stockOutId)!;
 const already=new Set(db.stockMovements.filter(m=>m.kind==='StockReturn'&&m.sourceStockOutId===original.id).flatMap(m=>m.unitCodes||[]));
 const returnedCodes=original.unitCodes?.filter(c=>!already.has(c)).slice(0,req.qty);
 const movement:StockMovement={id:uid(),productId:original.productId,branch:original.branch,kind:'StockReturn',qty:req.qty,unitCost:original.unitCost,sourceStockOutId:original.id,posId:original.posId,by,at:new Date().toISOString(),notes:`Approved request ${req.id}: ${req.reason}`,...(returnedCodes?.length?{unitCodes:returnedCodes}:{})};
 const stockRequests=db.stockRequests.map(r=>r.id===requestId?{...r,status:approve?'Approved' as const:'Rejected' as const,decidedBy:by,decidedAt:new Date().toISOString(),decisionNotes:notes}:r);
 return log({...db,stockRequests,stockMovements:approve?[movement,...db.stockMovements]:db.stockMovements},by,approve?'Stock return approved':'Stock return rejected',`${req.stockOutId} · ${req.qty} · ${notes}`);
}
/** Keep cost sources separate: POS/manual, branch inventory used, and PB/RFP purchases.
 * PB and inventory quantities remove matching manual cost so identical parts never double count. */
export function posCostBreakdown(p:POS,db?:Database){
 const lines=p.items.map(i=>({id:i.id,description:i.name,source:'POS / Manual COGS',amount:i.qty*i.cost}));
 if(!db)return lines;
 const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const remaining=new Map(p.items.filter(i=>i.type==='Part').map(i=>[i.id,i.qty]));
 function absorb(description:string,qty:number){
  let left=qty;
  for(const manual of p.items){
   if(manual.type!=='Part'||key(manual.name)!==key(description)||left<=0)continue;
   const possible=Math.min(remaining.get(manual.id)||0,left);
   if(possible){const row=lines.find(x=>x.id===manual.id);if(row)row.amount=Math.round((row.amount-possible*manual.cost)*100)/100;remaining.set(manual.id,(remaining.get(manual.id)||0)-possible);left-=possible;}
  }
 }
 const linked=db.fundEntries.filter(e=>e.fund==='RFP'&&e.kind==='expense'&&e.status!=='Rejected'&&e.linkedPosId===p.id);
 for(const part of linked){absorb(part.description,part.quantity||1);lines.push({id:part.id,description:part.description,source:`PB / RFP · ${part.no} · ${part.payee}`,amount:part.amount});}
 for(const out of postedStockOuts(db,p.id)){
  const product=db.inventory.find(x=>x.id===out.productId);if(!product)continue;
  const returned=db.stockMovements.filter(m=>m.kind==='StockReturn'&&m.sourceStockOutId===out.id).reduce((n,m)=>n+m.qty,0);
  const net=Math.max(0,out.qty-returned);if(!net)continue;
  absorb(product.name,net);
  lines.push({id:out.id,description:`${product.name} · ${net} ${product.unit}`,source:`From Inventory · ${out.id.slice(0,8)}`,amount:Math.round(net*out.unitCost*100)/100});
 }
 return lines.filter(r=>r.amount>0);
}
export function posCostTotals(p:POS,db:Database){
 const rows=posCostBreakdown(p,db);
 return {manual:rows.filter(r=>r.source==='POS / Manual COGS').reduce((n,r)=>n+r.amount,0),inventory:rows.filter(r=>r.source.startsWith('From Inventory')).reduce((n,r)=>n+r.amount,0),rfp:rows.filter(r=>r.source.startsWith('PB / RFP')).reduce((n,r)=>n+r.amount,0)};
}
export const posCOGS=(p:POS,db?:Database)=>posCostBreakdown(p,db).reduce((v,i)=>v+i.amount,0);
export function posClosedDate(p:POS):string{if(!p.closedAt)return p.date;const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(p.closedAt));const val=(type:string)=>parts.find(x=>x.type===type)?.value||'';return `${val('year')}-${val('month')}-${val('day')}`;}
export function reportDateMatch(date:string,from='',to=''){return (!from||date>=from)&&(!to||date<=to);}
export function amountInWords(amount:number){
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const under1000=(x:number):string=>{const a=[];if(x>=100){a.push(ones[Math.floor(x/100)]+' Hundred');x%=100;}if(x>=20){a.push(tens[Math.floor(x/10)]);x%=10;}if(x>0)a.push(ones[x]);return a.join(' ');};
  const absolute=Math.round(Math.max(0,amount)*100),pesosPart=Math.floor(absolute/100),centavos=absolute%100;
  let remaining=pesosPart;const groups:string[]=[];
  for(const [value,name] of [[1e9,'Billion'],[1e6,'Million'],[1000,'Thousand'],[1,'']] as [number,string][]){const part=Math.floor(remaining/value);if(part){groups.push(`${under1000(part)} ${name}`.trim());remaining%=value;}}
  return `${groups.join(' ')||'Zero'} Pesos and ${String(centavos).padStart(2,'0')}/100 Only`;
}
export function normalizePlate(plate:string){return plate.toUpperCase().replace(/[^A-Z0-9]/g,'');}
export function csvEscape(value:unknown):string {let s=String(value??'');if(/^[=+@\t\r]/.test(s) || /^-[^0-9]/.test(s))s="'"+s;return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
export function downloadFile(name:string,content:string,mime='text/csv;charset=utf-8'){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export function categoryTotals(entries:FundEntry[]) {return entries.filter(e=>e.fund==='RF'&&e.kind==='expense'&&e.status!=='Rejected').reduce<Record<string,number>>((result,e)=>{result[e.category]=(result[e.category]||0)+expenseGross(e);return result;},{});}
export function matchingPOS(db:Database,branch:BranchId,plate:string) {return db.pos.filter(p=>p.branch===branch&&normalizePlate(p.plate)===normalizePlate(plate)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
/** Frontend-only plate directory for POS suggestions. Prefer latest POS contact and PB car when no sale yet. */
export function plateSuggestions(db:Database,branch:BranchId,term:string){
 const query=normalizePlate(term);if(!query)return [];
 const plates=new Set([...db.pos.filter(p=>p.branch===branch).map(p=>normalizePlate(p.plate)),...db.fundEntries.filter(e=>e.branch===branch&&e.fund==='RFP'&&e.kind==='expense').map(e=>normalizePlate(e.plate||''))]);
 return [...plates].filter(p=>p&&p.includes(query)).sort((a,b)=>a.startsWith(query)===b.startsWith(query)?a.localeCompare(b):a.startsWith(query)?-1:1).slice(0,8).map(plate=>{
  const visit=matchingPOS(db,branch,plate)[0];
  const purchase=db.fundEntries.filter(e=>e.branch===branch&&e.fund==='RFP'&&e.kind==='expense'&&e.status!=='Rejected'&&normalizePlate(e.plate||'')===plate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  return {plate,car:(purchase&&!purchase.linkedPosId?purchase.car:undefined)||visit?.vehicle||purchase?.car||'',client:visit?.client||'',phone:visit?.phone||'',concern:visit?.concern||'',unlinkedParts:db.fundEntries.filter(e=>e.fund==='RFP'&&e.kind==='expense'&&e.branch===branch&&e.status!=='Rejected'&&!e.linkedPosId&&normalizePlate(e.plate||'')===plate).length};
 });
}
/** Links only unassigned PB part-lines to a new Cashier POS (not to unrelated previous visits). */
export function linkPartsOnSale(db:Database,pos:POS):Database{
 // Do not silently assign parts to a new visit if another open POS exists for the same plate.
 if(db.pos.some(p=>p.id!==pos.id&&p.status==='Pending'&&normalizePlate(p.plate)===normalizePlate(pos.plate)))return db;
 const items=db.fundEntries.filter(e=>e.fund==='RFP'&&e.kind==='expense'&&e.status!=='Rejected'&&!e.linkedPosId&&e.branch===pos.branch&&normalizePlate(e.plate||'')===normalizePlate(pos.plate));
 if(!items.length)return db;
 return {...db,fundEntries:db.fundEntries.map(e=>items.some(i=>i.id===e.id)?{...e,linkedPosId:pos.id}:e)};
}

/** Atomically posts consumed products to the correct open visit, creating a visible
 * Draft only when no matching visit exists. Failed stock validation persists nothing. */
export function assignConsumedStockToPOS(db:Database,branch:BranchId,rawPlate:string,lines:StockReceiptLine[],by:string,posId?:string):{db:Database;pos:POS;created:boolean}{
 const actor=db.users.find(u=>u.id===by&&u.active),plate=normalizePlate(rawPlate);
 if(!actor||actor.role!=='cashier'||actor.branch!==branch)throw new Error('Only the authorized branch Cashier may assign stock to a POS.');
 if(!plate)throw new Error('Enter a valid plate number before confirming consumed inventory.');
 let target=posId?db.pos.find(p=>p.id===posId):undefined;
 if(posId&&(!target||target.branch!==branch||target.status!=='Pending'||normalizePlate(target.plate)!==plate))throw new Error('Selected POS is not a valid open visit for this plate and branch.');
 if(db.pos.some(p=>p.status==='Pending'&&p.branch!==branch&&normalizePlate(p.plate)===plate))throw new Error(`Unit ${plate} is still open in another branch. Close that transaction first.`);
 let next=db,created=false;
 if(!target){
  const open=db.pos.filter(p=>p.status==='Pending'&&normalizePlate(p.plate)===plate);
  if(open.some(p=>p.branch!==branch))throw new Error(`Unit ${plate} already has an open POS at another branch. Close it before transferring the vehicle.`);
  if(open.length>1)throw new Error('Multiple POS Drafts found. Choose the correct visit.');
  target=open[0];
  if(!target){
   const old=matchingPOS(db,branch,plate)[0];
   const rfp=db.fundEntries.find(e=>e.branch===branch&&e.fund==='RFP'&&e.kind==='expense'&&e.status!=='Rejected'&&normalizePlate(e.plate||'')===plate&&e.car);
   target={id:uid(),no:nextNumber(db,branch,'POS'),branch,date:todayPH(),plate,vehicle:old?.vehicle||rfp?.car||'',client:old?.client||'',phone:old?.phone||'',concern:'',items:[],payments:[],status:'Pending',createdBy:by,createdAt:new Date().toISOString()};
   next=linkPartsOnSale({...db,pos:[target,...db.pos]},target);
   created=true;
  }
 }
 next=confirmStockOutBatch(next,target.id,lines,by);
 return {db:log(next,by,created?'POS Draft auto-created from consumed stock':'Consumed stock attached to existing POS Draft',`${target.no} · ${plate} · ${lines.length} products`),pos:target,created};
}

/** Report accounting: opening is cumulative balance immediately before `from`.
 * Selected-period expenses and approved replenishments reconcile exactly to the reported closing.
 * The fund target is the configured starting/target fund balance. */
export function disbursementSummary(db:Database,branch:BranchId,fund:Fund,from='',to=''){
 const base=(fund==='RF'?db.settings.rfBase:db.settings.rfpBase)[branch]||0;
 const rows=db.fundEntries.filter(e=>e.branch===branch&&e.fund===fund&&e.status!=='Rejected');
 const signed=(e:FundEntry)=>e.kind==='expense'?-expenseGross(e):e.status==='Approved'?e.amount:0;
 const opening=base+rows.filter(e=>!!from&&e.date<from).reduce((n,e)=>n+signed(e),0);
 const period=rows.filter(e=>reportDateMatch(e.date,from,to));
 const expenses=period.filter(e=>e.kind==='expense').reduce((n,e)=>n+expenseGross(e),0);
 const deposits=period.filter(e=>e.kind==='replenishment'&&e.status==='Approved').reduce((n,e)=>n+e.amount,0);
 const remaining=opening+deposits-expenses;
 return {base,opening,expenses,deposits,remaining,amountRequested:Math.max(0,base-remaining),period,checkDeposits:period.filter(e=>e.kind==='replenishment'&&e.status==='Approved')};
}
export function isFridayPH(date:string){return new Date(`${date}T12:00:00+08:00`).getUTCDay()===5;}
