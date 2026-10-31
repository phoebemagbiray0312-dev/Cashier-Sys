import type {BranchId,Receipt} from './data';
export type SupplierPaymentStatus='Unpaid'|'Partial'|'Paid';
export interface SupplierPurchase {
 id:string; branch:BranchId; supplier:string; purchaseDate:string; plate:string; posId:string; jobOrder:string;
 parts:string; amount:number; receipt?:Receipt; paymentProof?:Receipt;
 payments:{id:string;amount:number;date:string;reference:string;by:string}[];
 createdBy:string; createdAt:string; audit:{at:string;by:string;action:string}[];
}
export const paidAmount=(p:SupplierPurchase)=>p.payments.reduce((n,x)=>n+x.amount,0);
export const remainingAmount=(p:SupplierPurchase)=>Math.max(0,Math.round((p.amount-paidAmount(p))*100)/100);
export const supplierPaymentStatus=(p:SupplierPurchase):SupplierPaymentStatus=>paidAmount(p)<=0?'Unpaid':remainingAmount(p)>0?'Partial':'Paid';
export function purchaseIssue(p:Pick<SupplierPurchase,'supplier'|'branch'|'plate'|'parts'|'amount'|'posId'|'jobOrder'>):string|null{
 if(!p.supplier.trim())return 'Supplier is required.';
 if(!p.plate.trim())return 'Vehicle plate is required.';
 if(!p.posId.trim()&&!p.jobOrder.trim())return 'Link a POS or Job Order.';
 if(!p.parts.trim())return 'Purchased parts are required.';
 if(!Number.isFinite(p.amount)||p.amount<=0)return 'Enter a valid purchase amount.';
 return null;
}
export function addSupplierPayment(p:SupplierPurchase,amount:number,by:string,reference:string,date:string):SupplierPurchase{
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)>Math.round(remainingAmount(p)*100))throw Error('Payment must be greater than zero and cannot exceed outstanding balance.');
 if(!reference.trim())throw Error('Payment reference is required.');
 const at=new Date().toISOString();
 return {...p,payments:[...p.payments,{id:crypto.randomUUID(),amount,date,reference:reference.trim(),by}],audit:[...p.audit,{at,by,action:'Payment recorded: '+amount.toFixed(2)+' / '+reference.trim()}]};
}
export const supplierLedgerKey='uc-supplier-ledger-v1';
