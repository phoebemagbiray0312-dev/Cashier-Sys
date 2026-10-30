import type {POSLine} from './data';
/** Every quotation row must explicitly declare its costing source before payment. */
export type POSCostSource='Direct'|'PB / Inventory'|'No direct cost';
export function costReviewIssues(lines:POSLine[]):string[]{
 if(!lines.length)return ['Add at least one quotation item before reviewing COGS.'];
 const issues:string[]=[];
 for(const item of lines){
  const label=item.name||'Unnamed item';
  if(!item.costSource){issues.push(`${label}: choose a COGS source.`);continue;}
  if(item.type==='Part'&&item.costSource==='No direct cost')issues.push(`${label}: a part cannot be classified as a no-cost service.`);
  if(item.type==='Service'&&item.costSource==='PB / Inventory')issues.push(`${label}: service cannot use a part inventory cost source.`);
  if(item.costSource==='Direct'){
   if(!Number.isFinite(item.cost)||item.cost<=0)issues.push(`${label}: enter a positive cost per unit.`);
   if(!item.supplier?.trim())issues.push(`${label}: enter the cost supplier or payee.`);
  }else if(item.cost!==0)issues.push(`${label}: direct unit cost must be zero when cost is sourced elsewhere or not applicable.`);
 }
 return issues;
}

/** A declared PB/Inventory cost isn't evidence of consumption. Before closing a sale,
 * require the exact quotation part to have a verified linked source and enough quantity.
 * Pending PB purchases cannot certify final COGS. */
export function externalCostCoverageIssues(pos:import('./data').POS,db:import('./data').Database):string[]{
 const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const matchedPB=db.fundEntries.filter(x=>x.fund==='RFP'&&x.kind==='expense'&&x.status==='Approved'&&x.linkedPosId===pos.id);
 const posted=db.stockMovements.filter(x=>x.kind==='StockOut'&&x.posId===pos.id);
 const missing:string[]=[];
 const allocated=new Map<string,number>();
 for(const line of pos.items){
  if(line.type!=='Part'||line.costSource!=='PB / Inventory')continue;
  const key=norm(line.name);
  const pbQty=matchedPB.filter(x=>norm(x.description)===key).reduce((n,x)=>n+(x.quantity||1),0);
  const invQty=posted.filter(x=>norm(db.inventory.find(p=>p.id===x.productId)?.name||'')===key).reduce((n,x)=>{
   const returned=db.stockMovements.filter(r=>r.kind==='StockReturn'&&r.sourceStockOutId===x.id).reduce((m,r)=>m+r.qty,0);
   return n+Math.max(0,x.qty-returned);
  },0);
  const used=allocated.get(key)||0;
  if(pbQty+invQty-used<line.qty)missing.push(`${line.name}: ${line.qty-used} unit(s) need an approved PB purchase or posted Stock Release before POS closure.`);
  allocated.set(key,used+line.qty);
 }
 return missing;
}
