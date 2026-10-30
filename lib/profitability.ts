import {BRANCHES, BRANCH_NAME, expenseGross, paidTotal, posCOGS, posCostTotals, posClosedDate, posTotal, type BranchId, type Database, type FundEntry, type POS} from './data';

/** Admin management view only: never a posted GL, tax return, or bank reconciliation. */
export type ProfitScope = BranchId | 'ALL' | 'UC' | 'MM';
export type ProfitFilter = {from:string; to:string; scope:ProfitScope};
export type ProfitCompany = 'Underchargers' | 'Mastermind Autoworks';
export interface ProfitBranch {
 branch:BranchId; company:ProfitCompany; sales:number; cogs:number; cogsManual:number; cogsRFP:number; cogsInventory:number; grossProfit:number;
 rfExpenses:number; paymentCharges:number; operatingExpenses:number; estimatedEarnings:number;
 recordedCollections:number; openDepositCollections:number; posCount:number; zeroCogsCount:number;
 pendingExpenseCount:number; unallocatedPartsPurchases:number; terminalRefunds:number;
}
export interface ProfitTotals extends Omit<ProfitBranch,'branch'|'company'> {}
export interface ProfitReport {
 filter:ProfitFilter; branches:ProfitBranch[]; total:ProfitTotals;
 companies:{company:ProfitCompany; total:ProfitTotals; branches:ProfitBranch[]}[];
 sales:POS[]; rfExpenses:FundEntry[]; rfpPurchases:FundEntry[];
 pendingCount:number; unallocatedPartsCount:number;
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const sum=(nums:number[])=>round(nums.reduce((total,n)=>total+(Number.isFinite(n)?n:0),0));
const companyOf=(branch:BranchId):ProfitCompany=>branch==='MMM'?'Mastermind Autoworks':'Underchargers';
const inRange=(date:string,from:string,to:string)=>Boolean(date)&&(!from||date>=from)&&(!to||date<=to);
const INCLUDED=(e:FundEntry)=>e.kind==='expense'&&e.status!=='Rejected';
const isVisible=(branch:BranchId,scope:ProfitScope)=>scope==='ALL'||scope==='UC'&&branch!=='MMM'||scope==='MM'&&branch==='MMM'||branch===scope;

/**
 * Reconciliation policy:
 * - Recognize sales/COGS on POS *closed date*, not payment or quotation date.
 * - Reuse posCOGS, which reconciles POS, PB/RFP and inventory Stock Out without counting parts twice.
 * - RF operating expenses + RFP payment-processing charges are recognised on entry date.
 * - RFP purchase principal is NOT an additional operating expense or COGS here: unallocated purchases
 *   stay outside the earnings figure until attached to a closed POS/stock consumption. Fund top-ups,
 *   stock receipts, sales turnovers and internal transfers are not expenses/revenue.
 * - Display payments (including open-POS downpayments) separately, never added again to sales.
 * - Pending RF/RFP expense rows are provisional; absence of external overhead/taxes prevents a true net profit.
 */
export function calculateProfitability(db:Database,filter:ProfitFilter):ProfitReport {
 const scope=isProfitScope(filter.scope)?filter.scope:'ALL';
 const from=/^\d{4}-\d{2}-\d{2}$/.test(filter.from)?filter.from:'';
 const to=/^\d{4}-\d{2}-\d{2}$/.test(filter.to)?filter.to:'';
 const normalized={scope,from,to};
 const visibleBranches=BRANCHES.map(b=>b.id).filter(b=>isVisible(b,scope));
 const sales=db.pos.filter(p=>p.status==='Closed'&&visibleBranches.includes(p.branch)&&inRange(posClosedDate(p),from,to));
 const rfExpenses=db.fundEntries.filter(e=>INCLUDED(e)&&e.fund==='RF'&&visibleBranches.includes(e.branch)&&inRange(e.date,from,to));
 const rfpPurchases=db.fundEntries.filter(e=>INCLUDED(e)&&e.fund==='RFP'&&visibleBranches.includes(e.branch)&&inRange(e.date,from,to));
 const branches:ProfitBranch[]=visibleBranches.map(branch=>{
  const branchSales=sales.filter(p=>p.branch===branch);
  const branchRF=rfExpenses.filter(e=>e.branch===branch);
  const branchRFP=rfpPurchases.filter(e=>e.branch===branch);
  const salesAmount=sum(branchSales.map(p=>posTotal(p)));
  const cogsSources=branchSales.map(p=>posCostTotals(p,db));
  const cogsManual=sum(cogsSources.map(c=>c.manual));
  const cogsRFP=sum(cogsSources.map(c=>c.rfp));
  const cogsInventory=sum(cogsSources.map(c=>c.inventory));
  const cogs=sum([cogsManual,cogsRFP,cogsInventory]);
  const grossProfit=round(salesAmount-cogs);
  const rfCost=sum(branchRF.map(e=>expenseGross(e)));
  const paymentCharges=sum(branchRFP.map(e=>e.onlineCharge||0));
  const operatingExpenses=round(rfCost+paymentCharges);
  const branchPOS=db.pos.filter(p=>p.branch===branch);
  const recordedCollections=sum(branchPOS.flatMap(p=>p.payments.filter(payment=>inRange(payment.date,from,to)).map(payment=>payment.amount)));
  const openDepositCollections=sum(branchPOS.filter(p=>p.status==='Pending').flatMap(p=>p.payments.filter(payment=>inRange(payment.date,from,to)).map(payment=>payment.amount)));
  const terminalRefunds=sum((db.terminalEvents||[]).filter(e=>e.branch===branch&&e.kind==='Refund'&&inRange(e.date,from,to)).map(e=>e.amount));
  const unallocatedPartsPurchases=sum(branchRFP.filter(e=>!e.linkedPosId||!db.pos.some(p=>p.id===e.linkedPosId&&p.status==='Closed')).map(e=>e.amount));
  return {branch,company:companyOf(branch),sales:salesAmount,cogs,cogsManual,cogsRFP,cogsInventory,grossProfit,rfExpenses:rfCost,paymentCharges,operatingExpenses,
   estimatedEarnings:round(grossProfit-operatingExpenses),recordedCollections,openDepositCollections,posCount:branchSales.length,
   zeroCogsCount:branchSales.filter(p=>posCOGS(p,db)<=0).length,
   pendingExpenseCount:[...branchRF,...branchRFP].filter(e=>e.status!=='Approved').length,
   unallocatedPartsPurchases,terminalRefunds};
 });
 const sumBranches=(items:ProfitBranch[]):ProfitTotals=>({
  sales:sum(items.map(b=>b.sales)),cogs:sum(items.map(b=>b.cogs)),cogsManual:sum(items.map(b=>b.cogsManual)),cogsRFP:sum(items.map(b=>b.cogsRFP)),cogsInventory:sum(items.map(b=>b.cogsInventory)),grossProfit:sum(items.map(b=>b.grossProfit)),
  rfExpenses:sum(items.map(b=>b.rfExpenses)),paymentCharges:sum(items.map(b=>b.paymentCharges)),
  operatingExpenses:sum(items.map(b=>b.operatingExpenses)),estimatedEarnings:sum(items.map(b=>b.estimatedEarnings)),
  recordedCollections:sum(items.map(b=>b.recordedCollections)),openDepositCollections:sum(items.map(b=>b.openDepositCollections)),
  posCount:items.reduce((n,b)=>n+b.posCount,0),zeroCogsCount:items.reduce((n,b)=>n+b.zeroCogsCount,0),
  pendingExpenseCount:items.reduce((n,b)=>n+b.pendingExpenseCount,0),
  unallocatedPartsPurchases:sum(items.map(b=>b.unallocatedPartsPurchases)),terminalRefunds:sum(items.map(b=>b.terminalRefunds)),
 });
 const companies:(ProfitCompany)[]=['Underchargers','Mastermind Autoworks'];
 return {filter:normalized,branches,total:sumBranches(branches),companies:companies.map(company=>{
  const group=branches.filter(b=>b.company===company);return {company,total:sumBranches(group),branches:group};
 }).filter(group=>group.branches.length>0),sales,rfExpenses,rfpPurchases,
 pendingCount:branches.reduce((n,b)=>n+b.pendingExpenseCount,0),
 unallocatedPartsCount:rfpPurchases.filter(e=>!e.linkedPosId||!db.pos.some(p=>p.id===e.linkedPosId&&p.status==='Closed')).length};
}
export function isProfitScope(scope:string):scope is ProfitScope {
 return scope==='ALL'||scope==='UC'||scope==='MM'||BRANCHES.some(b=>b.id===scope);
}
export function summarizeExpenses(report:ProfitReport):{label:string;amount:number}[] {
 const summary=new Map<string,number>();
 for(const e of report.rfExpenses){const key=e.category||'Uncategorized RF';summary.set(key,round((summary.get(key)||0)+expenseGross(e)));}
 if(report.total.paymentCharges)summary.set('RFP online payment charges',report.total.paymentCharges);
 return [...summary].map(([label,amount])=>({label,amount})).sort((a,b)=>b.amount-a.amount);
}
export function reportRows(report:ProfitReport){return report.branches.map(row=>({label:BRANCH_NAME(row.branch),...row}));}
