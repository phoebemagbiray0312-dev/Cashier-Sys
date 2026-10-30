/** Validation shared by the new POS wizard and the add-item panel on saved drafts.
 * Money is normalized to centavos; this module never posts stock, sales or COGS. */
export type POSLineDraft={
 type:'Service'|'Part';name:string;qty:string;price:string;cost:string;
 supplier:string;receiptNo:string;proof?:{name:string;data:string};
};
export const MAX_POS_LINE_QTY=9999;
export const MAX_POS_UNIT_PRICE=99999999.99;
export const normalizePOSLineName=(name:string)=>name.trim().replace(/\s+/g,' ');
export function posLineError(line:POSLineDraft):string|null{
 if(normalizePOSLineName(line.name).length<2)return 'Enter the service or part name (at least 2 characters).';
 if(!/^[1-9]\d*$/.test(line.qty)||Number(line.qty)>MAX_POS_LINE_QTY)return `Quantity must be a whole number from 1 to ${MAX_POS_LINE_QTY.toLocaleString('en-PH')}.`;
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(line.price)||Number(line.price)<=0||Number(line.price)>MAX_POS_UNIT_PRICE)return 'Selling price must be greater than ₱0, with up to 2 decimal places.';
 const cost=line.cost.trim()===''?'0':line.cost;
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(cost)||Number(cost)>MAX_POS_UNIT_PRICE)return 'Internal unit cost must be zero or more, with up to 2 decimal places.';
 return null;
}
export function posLineAmount(qty:string|number,price:string|number):number{
 const q=Number(qty),p=Number(price);
 if(!Number.isFinite(q)||!Number.isFinite(p)||q<=0||p<0)return 0;
 return Math.round(q*Math.round(p*100))/100;
}
export function posLineNumbers(line:POSLineDraft){
 const message=posLineError(line);if(message)throw new Error(message);
 return {name:normalizePOSLineName(line.name),qty:Number(line.qty),price:Math.round(Number(line.price)*100)/100,cost:Math.round(Number(line.cost||0)*100)/100};
}
