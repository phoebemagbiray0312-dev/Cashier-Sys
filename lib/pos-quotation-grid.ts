import {normalizePlate,type InventoryProduct,type POSLine} from './data';
import {MAX_POS_LINE_QTY,MAX_POS_UNIT_PRICE,normalizePOSLineName} from './pos-line-entry';
export type QuotationRow={id:string;name:string;type:'Service'|'Part';qty:string;sellingTotal:string};
export const emptyQuotationRow=(id:string):QuotationRow=>({id,name:'',type:'Part',qty:'1',sellingTotal:''});
export const quotedAmount=(r:QuotationRow)=>Math.round(Number(r.sellingTotal||0)*100)/100||0;
export function toQuotationRows(lines:POSLine[]):QuotationRow[]{return lines.map(l=>({id:l.id,name:l.name,type:l.type,qty:String(l.qty),sellingTotal:String(l.lineTotal??Math.round(l.qty*l.price*100)/100)}));}
export function quotationIssue(rows:QuotationRow[],inventory:InventoryProduct[],branch:string):string|null{
 if(!rows.length)return 'Add a quotation row first.';
 for(let i=0;i<rows.length;i++){
  const r=rows[i],label=`Row ${i+1}`;
  if(normalizePOSLineName(r.name).length<2)return `${label}: enter the service or product name.`;
  if(!/^[1-9]\d*$/.test(r.qty)||Number(r.qty)>MAX_POS_LINE_QTY)return `${label}: quantity must be between 1 and ${MAX_POS_LINE_QTY}.`;
  if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(r.sellingTotal)||Number(r.sellingTotal)<=0||Number(r.sellingTotal)>MAX_POS_UNIT_PRICE)return `${label}: selling total must be greater than zero, up to two decimal places.`;
  if(r.type==='Part'&&inventory.some(p=>!p.archivedAt&&p.branch===branch&&(p.name.trim().toLowerCase()===r.name.trim().toLowerCase()||p.barcode.trim().toLowerCase()===r.name.trim().toLowerCase())))return `${label}: registered inventory parts require Admin-approved Stock Release. Do not manually add the catalog item.`;
 }
 return null;
}
export function rowsToPOSLines(rows:QuotationRow[],old:POSLine[]):POSLine[]{
 return rows.map(r=>{
  const qty=Number(r.qty),lineTotal=quotedAmount(r),previous=old.find(l=>l.id===r.id);
  // A changed quotation row needs fresh COGS verification. Identical lines retain review.
  const same=previous&&previous.name===normalizePOSLineName(r.name)&&previous.qty===qty&&previous.type===r.type&&(previous.lineTotal??Math.round(previous.qty*previous.price*100)/100)===lineTotal;
  return {id:r.id,name:normalizePOSLineName(r.name),type:r.type,qty,lineTotal,price:Math.round(lineTotal/qty*1000000)/1000000,cost:same?previous.cost:0,supplier:same?previous.supplier:undefined,costSource:same?previous.costSource:undefined,receiptNo:same?previous.receiptNo:undefined,proof:same?previous.proof:undefined};
 });
}
