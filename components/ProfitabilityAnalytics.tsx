'use client';
import React,{useMemo,useState} from 'react';
import {AlertTriangle,ArrowRight,BarChart3,ChevronRight,Download,Info} from 'lucide-react';
import {BRANCHES,BRANCH_NAME,csvEscape,datePH,downloadFile,monthRange,pesos,posClosedDate,posCOGS,posTotal,todayPH,type BranchId,type Database} from '@/lib/data';
import {calculateProfitability,reportRows,summarizeExpenses,type ProfitScope} from '@/lib/profitability';
import {Modal} from '@/components/Ui';

type Period='month'|'last'|'year'|'custom';
type Drill='sales'|'expenses'|'branch'|null;
interface Props {db:Database;onViewPOS:(id:string)=>void;onViewExpense:(id:string)=>void;}
function percentage(a:number,b:number){return b>0?`${(a/b*100).toFixed(1)}%`:'—';}
function prevMonth(month:string){const [year,part]=month.split('-').map(Number);return new Date(Date.UTC(year,part-2,1)).toISOString().slice(0,7);}
function dateLimits(period:Period,customFrom:string,customTo:string){const today=todayPH();const month=today.slice(0,7);
 if(period==='month')return monthRange(month);
 if(period==='last')return monthRange(prevMonth(month));
 if(period==='year')return [`${today.slice(0,4)}-01-01`,`${today.slice(0,4)}-12-31`] as [string,string];
 return [customFrom,customTo] as [string,string];
}
function ProfitAmount({value}:{value:number}){return <span className={value<0?'profit-negative':''}>{pesos(value)}</span>;}
export default function ProfitabilityAnalytics({db,onViewPOS,onViewExpense}:Props){
 const [period,setPeriod]=useState<Period>('month');
 const [scope,setScope]=useState<ProfitScope>('ALL');
 const [customFrom,setCustomFrom]=useState(todayPH().slice(0,7)+'-01');
 const [customTo,setCustomTo]=useState(todayPH());
 const [drill,setDrill]=useState<Drill>(null);
 const [drillBranch,setDrillBranch]=useState<BranchId|null>(null);
 const [categoryFilter,setCategoryFilter]=useState('');
 const [from,to]=dateLimits(period,customFrom,customTo);
 const invalid=Boolean(from&&to&&from>to);
 const report=useMemo(()=>calculateProfitability(db,{scope,from,to}),[db,scope,from,to]);
 const expenseRows=useMemo(()=>summarizeExpenses(report),[report]);
 const margin=report.total.sales>0?report.total.estimatedEarnings/report.total.sales*100:null;
 const trend=useMemo(()=>{
  const anchor=(period==='year'?todayPH():to&&to<todayPH()?to:todayPH()).slice(0,7);
  return Array.from({length:6},(_,i)=>{
   const monthDate=new Date(Date.UTC(Number(anchor.slice(0,4)),Number(anchor.slice(5,7))-1-(5-i),1));
   const month=monthDate.toISOString().slice(0,7);
   const [monthFrom,monthTo]=monthRange(month);
   const data=calculateProfitability(db,{scope,from:monthFrom,to:monthTo});
   return {month,label:monthDate.toLocaleDateString('en-PH',{month:'short',year:'2-digit',timeZone:'UTC'}),sales:data.total.sales,earnings:data.total.estimatedEarnings};
  });
 },[db,scope,period,to]);
 const trendMax=Math.max(1,...trend.map(item=>item.sales),...trend.map(item=>Math.abs(item.earnings)));
 const activePOS=report.sales.filter(p=>!drillBranch||p.branch===drillBranch);
 const activeExpenses=report.rfExpenses.filter(e=>(!drillBranch||e.branch===drillBranch)&&(!categoryFilter||(categoryFilter!=='@RFP_CHARGES'&&e.category===categoryFilter)));
 const activeFees=report.rfpPurchases.filter(e=>(!drillBranch||e.branch===drillBranch)&&!!e.onlineCharge&&(!categoryFilter||categoryFilter==='@RFP_CHARGES'));
 function exportCsv(){
  const cells:string[][]=[['Cashier-MS · Management profitability · preliminary (not audited)',''],['From',from||'All'],['To',to||'All'],['Scope',scope],[],
   ['Company','Branch','Closed POS sales','POS COGS from existing matching rules','COGS manual','COGS PB/RFP','COGS inventory','Gross profit','RF expenses','RFP online charges','Recorded operating expenses','Estimated earnings before unrecorded costs/tax','Collections recorded (not revenue)','Open POS downpayments','Pending expense count','Unallocated RFP purchase principal']];
  for(const r of reportRows(report))cells.push([r.company,r.label,r.sales,r.cogs,r.cogsManual,r.cogsRFP,r.cogsInventory,r.grossProfit,r.rfExpenses,r.paymentCharges,r.operatingExpenses,r.estimatedEarnings,r.recordedCollections,r.openDepositCollections,r.pendingExpenseCount,r.unallocatedPartsPurchases].map(String));
  cells.push([],['Method','Closed POS sales - POS COGS - RF expenses - RFP online charges. Excludes unrecorded payroll, rent, tax, etc.']);
  downloadFile(`cms-management-profitability-${from||'all'}-${to||'all'}.csv`,cells.map(row=>row.map(csvEscape).join(',')).join('\r\n'));
 }
 function openDrill(kind:Drill,branch:BranchId|null=null,category=''){setDrill(kind);setDrillBranch(branch);setCategoryFilter(category);}
 return <section className="profit-workspace" aria-label="Admin profitability analytics">
  <div className="profit-filters">
   <div className="profit-filter-group"><label htmlFor="profit-period">Period</label><select id="profit-period" className="filter-select" value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="month">This month</option><option value="last">Last month</option><option value="year">This year</option><option value="custom">Custom range</option></select></div>
   {period==='custom'&&<><div className="profit-filter-group"><label htmlFor="profit-from">From</label><input id="profit-from" type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></div><div className="profit-filter-group"><label htmlFor="profit-to">To</label><input id="profit-to" type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></div></>}
   <div className="profit-filter-group"><label htmlFor="profit-scope">Business / branch</label><select id="profit-scope" className="filter-select" value={scope} onChange={e=>setScope(e.target.value as ProfitScope)}><option value="ALL">All businesses · comparison</option><option value="UC">Underchargers · combined</option><option value="MM">Mastermind Autoworks</option>{BRANCHES.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
   <button className="button button-secondary profit-export" type="button" disabled={invalid} onClick={exportCsv}><Download size={16}/> Export CSV</button>
  </div>
  {invalid?<div role="alert" className="profit-alert"><AlertTriangle size={18}/> Date range is invalid: “From” must be on or before “To”.</div>:<>
   <div className="profit-meta"><span><BarChart3 size={15}/> {from?datePH(from):'All dates'} – {to?datePH(to):'Latest'} · {report.total.posCount} completed sale(s)</span><span className="profit-tag">Management estimate · not audited net income</span></div>
   <div className="profit-kpis">
    <div className="profit-feature"><span>Estimated earnings · recorded costs only</span><strong><ProfitAmount value={report.total.estimatedEarnings}/></strong><div className="profit-feature-bottom"><span>{margin===null?'No completed sales':`${margin.toFixed(1)}% estimated margin`}</span><span>Before unrecorded overhead & tax</span></div></div>
    <button className="profit-kpi" onClick={()=>openDrill('sales')}><span>Completed sales <ChevronRight size={15}/></span><strong>{pesos(report.total.sales)}</strong><small>Closed POS transactions</small></button>
    <div className="profit-kpi"><span>Cost of goods sold</span><strong>{pesos(report.total.cogs)}</strong><small>POS + matched RFP + used stock</small></div>
    <div className="profit-kpi"><span>Gross profit</span><strong><ProfitAmount value={report.total.grossProfit}/></strong><small>{percentage(report.total.grossProfit,report.total.sales)} gross margin</small></div>
    <button className="profit-kpi" onClick={()=>openDrill('expenses')}><span>Recorded operating costs <ChevronRight size={15}/></span><strong>{pesos(report.total.operatingExpenses)}</strong><small>RF expenses + RFP processing charges</small></button>
   </div>
   <div className="profit-columns">
    <section className="panel profit-panel"><div className="profit-panel-head"><div><h3>Profit & loss breakdown</h3><p>POS recognised at closure; expenses at recorded transaction date.</p></div><span className="profit-small-tag">PHP</span></div>
     <div className="profit-statement"><div><span>Sales · closed POS</span><strong>{pesos(report.total.sales)}</strong></div><div className="profit-statement-less"><span>Less: cost of goods sold</span><strong>− {pesos(report.total.cogs)}</strong></div><div className="profit-cogs-detail" aria-label="Cost of goods sold source breakdown"><span>COGS source breakdown</span><div><span>Manual {pesos(report.total.cogsManual)}</span><span>Parts Buyer {pesos(report.total.cogsRFP)}</span><span>Inventory {pesos(report.total.cogsInventory)}</span></div></div><div className="profit-statement-sub"><span>Gross profit</span><strong><ProfitAmount value={report.total.grossProfit}/></strong></div><div className="profit-statement-less"><span>Less: RF operating expenses</span><strong>− {pesos(report.total.rfExpenses)}</strong></div><div className="profit-statement-less"><span>Less: RFP online payment charges</span><strong>− {pesos(report.total.paymentCharges)}</strong></div><div className="profit-statement-total"><span>Estimated earnings*</span><strong><ProfitAmount value={report.total.estimatedEarnings}/></strong></div></div>
     <p className="profit-note">*Excludes costs not yet recorded in CMS such as payroll, rent outside RF, depreciation, interest and taxes. This is not final accounting net profit.</p>
    </section>
    <section className="panel profit-panel"><div className="profit-panel-head"><div><h3>Recorded expense categories</h3><p>Expenses deducted in the estimate</p></div><button type="button" className="profit-text-action" onClick={()=>openDrill('expenses')}>View records <ArrowRight size={15}/></button></div>
      {expenseRows.length?<div className="profit-category-list">{expenseRows.slice(0,7).map(row=><button type="button" key={row.label} className="profit-category" onClick={()=>openDrill('expenses',null,row.label==='RFP online payment charges'?'@RFP_CHARGES':row.label)}><span className="profit-category-line"><span>{row.label}</span><strong>{pesos(row.amount)}</strong></span><span className="profit-track"><span style={{width:`${Math.min(100,row.amount/(report.total.operatingExpenses||1)*100)}%`}}/></span></button>)}</div>:<p className="profit-empty">No RF expenses or RFP processing fees recorded for this period.</p>}
      <div className="profit-collections"><div><span>Payments recorded</span><strong>{pesos(report.total.recordedCollections)}</strong></div><small>Cash and terminal payments across POS, including open-order downpayments. Not an additional sale; bank deposits not verified.</small></div>
    </section>
   </div>
   <section className="panel profit-panel"><div className="profit-panel-head"><div><h3>Branch performance</h3><p>Underchargers branches group together; Mastermind remains separate.</p></div></div>
    <div className="table-wrap"><table className="data-table profit-table"><thead><tr><th>Branch</th><th className="num">Sales</th><th className="num">COGS</th><th className="num">Operating costs</th><th className="num">Estimated earnings</th><th className="num">Margin</th><th aria-label="View detail"/></tr></thead><tbody>{report.branches.map(row=><tr key={row.branch} role="button" tabIndex={0} className="click-row" onClick={()=>openDrill('branch',row.branch)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDrill('branch',row.branch)}}}><td><strong>{BRANCH_NAME(row.branch)}</strong><small className="profit-company-caption">{row.company}</small></td><td className="num">{pesos(row.sales)}</td><td className="num">{pesos(row.cogs)}</td><td className="num">{pesos(row.operatingExpenses)}</td><td className="num profit-earnings"><ProfitAmount value={row.estimatedEarnings}/></td><td className="num">{percentage(row.estimatedEarnings,row.sales)}</td><td><ChevronRight size={16}/></td></tr>)}{report.branches.length>1&&<tr className="profit-table-grand"><td><strong>Comparison total</strong></td><td className="num">{pesos(report.total.sales)}</td><td className="num">{pesos(report.total.cogs)}</td><td className="num">{pesos(report.total.operatingExpenses)}</td><td className="num"><ProfitAmount value={report.total.estimatedEarnings}/></td><td className="num">{percentage(report.total.estimatedEarnings,report.total.sales)}</td><td/></tr>}</tbody></table></div>
    {scope==='ALL'&&<div className="profit-company-totals">{report.companies.map(group=><div key={group.company}><span>{group.company}</span><strong><ProfitAmount value={group.total.estimatedEarnings}/></strong><small>{pesos(group.total.sales)} closed sales</small></div>)}</div>}
   </section>
   <section className="panel profit-panel" aria-label="Six-month profitability trend"><div className="profit-panel-head"><div><h3>Six-month earnings trend</h3><p>Monthly comparison through {trend[5]?.label}. Uses the selected business/branch; independent of the summary period above.</p></div><div className="profit-trend-legend"><span><i className="profit-legend-sales"/> Sales</span><span><i className="profit-legend-net"/> Estimated earnings</span></div></div>
    <div className="profit-trend-chart">{trend.map(item=><div key={item.month} className="profit-trend-month" title={`${item.month} · Sales ${pesos(item.sales)} · Estimated earnings ${pesos(item.earnings)}`}><div className="profit-trend-bars"><span className="profit-bar-sales" style={{height:`${item.sales?Math.max(3,item.sales/trendMax*100):0}%`}}/><span className={item.earnings<0?'profit-bar-loss':'profit-bar-net'} style={{height:`${item.earnings?Math.max(3,Math.abs(item.earnings)/trendMax*100):0}%`}}/></div><span className="profit-trend-label">{item.label}</span><small>{pesos(item.earnings)}</small></div>)}</div>
   </section>
   <section className="profit-review-note" aria-label="Data quality and exclusions"><Info size={19}/><div><strong>Before using this as final net earnings</strong><p>{report.pendingCount} pending/unverified fund expense(s) included; {report.total.zeroCogsCount} closed POS record(s) with zero recorded COGS; {report.unallocatedPartsCount} RFP purchase(s) not allocated to a closed POS (principal {pesos(report.total.unallocatedPartsPurchases)} excluded from profit to avoid double counting). {report.total.terminalRefunds>0?`Terminal refunds logged: ${pesos(report.total.terminalRefunds)} — reconcile before finalizing. `:''}Payroll, additional rent/utilities, tax and bank reconciliation must be supplied by Accounting. Verify any PB/inventory overlap in the underlying POS COGS matching. Fund replenishments, stock-in, turnovers and transfers are intentionally excluded.</p></div></section>
  </>}
  {drill&&<Modal title={drill==='branch'?`${BRANCH_NAME(drillBranch!)} · Profit details`:drill==='sales'?'Completed POS sales & COGS':'Recorded operating expenses'} subtitle={`${from||'All dates'} – ${to||'Latest'} · Read-only source records`} onClose={()=>setDrill(null)} wide>
    {drill==='branch'&&<div className="profit-drill-stats">{report.branches.filter(b=>b.branch===drillBranch).map(b=><React.Fragment key={b.branch}><span>Sales <strong>{pesos(b.sales)}</strong></span><span>COGS <strong>{pesos(b.cogs)}</strong></span><span>Recorded costs <strong>{pesos(b.operatingExpenses)}</strong></span><span>Estimated earnings <strong><ProfitAmount value={b.estimatedEarnings}/></strong></span></React.Fragment>)}</div>}
    {(drill==='sales'||drill==='branch')&&<><h4 className="profit-drill-label">Closed POS / sales</h4><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>POS</th><th>Branch</th><th className="num">Sales</th><th className="num">COGS</th><th>Source</th></tr></thead><tbody>{activePOS.map(p=><tr key={p.id}><td>{posClosedDate(p)}</td><td className="mono">{p.no}</td><td>{BRANCH_NAME(p.branch)}</td><td className="num">{pesos(posTotal(p))}</td><td className="num">{pesos(posCOGS(p,db))}</td><td><button type="button" className="profit-text-action" onClick={()=>{setDrill(null);onViewPOS(p.id)}}>Details <ChevronRight size={14}/></button></td></tr>)}{!activePOS.length&&<tr><td colSpan={6}>No closed sales in this period.</td></tr>}</tbody></table></div></>}
    {(drill==='expenses'||drill==='branch')&&<><h4 className="profit-drill-label">RF expenses</h4><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Expense / category</th><th>Branch</th><th className="num">Amount</th><th>Status</th><th>Source</th></tr></thead><tbody>{activeExpenses.map(e=><tr key={e.id}><td>{e.date}</td><td><strong>{e.payee||e.description||e.no}</strong><small className="profit-company-caption">{e.category}</small></td><td>{BRANCH_NAME(e.branch)}</td><td className="num">{pesos(e.amount+(e.onlineCharge||0))}</td><td>{e.status}</td><td><button type="button" className="profit-text-action" onClick={()=>{setDrill(null);onViewExpense(e.id)}}>Details <ChevronRight size={14}/></button></td></tr>)}{!activeExpenses.length&&<tr><td colSpan={6}>No matching RF expenses.</td></tr>}</tbody></table></div><h4 className="profit-drill-label">RFP online payment charges</h4><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Parts purchase / source</th><th>Branch</th><th className="num">Charge only</th><th>Source</th></tr></thead><tbody>{activeFees.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.no}</td><td>{BRANCH_NAME(e.branch)}</td><td className="num">{pesos(e.onlineCharge||0)}</td><td><button type="button" className="profit-text-action" onClick={()=>{setDrill(null);onViewExpense(e.id)}}>Details <ChevronRight size={14}/></button></td></tr>)}{!activeFees.length&&<tr><td colSpan={5}>No RFP processing charges in this period.</td></tr>}</tbody></table></div></>}
    <div className="profit-modal-bottom"><button type="button" className="button button-secondary" onClick={()=>setDrill(null)}>Close</button></div>
   </Modal>}
 </section>;
}
