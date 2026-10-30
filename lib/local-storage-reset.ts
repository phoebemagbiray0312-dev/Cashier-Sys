/** Clear only Cashier System browser-local records. Never erase unrelated same-origin keys. */
export const CASHIER_LOCAL_KEYS = [
 'underchargers-fund-management-demo-v1',
 'uc_report_studio_v1',
] as const;

export function clearCashierStorage(local: Pick<Storage,'removeItem'>, session: Pick<Storage,'length'|'key'|'removeItem'>):void {
 for(const key of CASHIER_LOCAL_KEYS)local.removeItem(key);
 const sessionKeys=Array.from({length:session.length},(_,i)=>session.key(i)).filter((key):key is string=>key!==null);
 for(const key of sessionKeys){
  if(key==='uc_fund_session'||key.startsWith('uc_report_prompt_'))session.removeItem(key);
 }
}
