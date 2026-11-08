import { getSupabaseClient } from './supabase-client';
import { getCurrentStaff } from './supabase-auth';

export interface OnlineProduct {
  id: string;
  branch_id: string;
  sku: string;
  name: string;
  unit_price: number;
  stock_qty: number;
}
export interface OnlineSale {
  id: string;
  branch_id: string;
  reference: string;
  customer_name: string | null;
  status: 'draft' | 'completed' | 'void';
  total_amount: number;
  created_at: string;
}
export interface OnlineSaleLine {
  id: string;
  sale_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

/** Only read operations are enabled until the transactional checkout RPC is tested. */
export async function listOnlineProducts(branchId?: string): Promise<OnlineProduct[]> {
  if (!await getCurrentStaff()) throw new Error('Staff authentication required.');
  let query = getSupabaseClient().from('cms_products')
    .select('id,branch_id,sku,name,unit_price,stock_qty').order('name').limit(200);
  if (branchId) query = query.eq('branch_id',branchId);
  const {data,error} = await query;
  if (error) throw new Error('Unable to load online products.');
  return (data ?? []) as OnlineProduct[];
}
export async function listOnlineSales(branchId?: string): Promise<OnlineSale[]> {
  if (!await getCurrentStaff()) throw new Error('Staff authentication required.');
  let query = getSupabaseClient().from('cms_sales')
    .select('id,branch_id,reference,customer_name,status,total_amount,created_at')
    .order('created_at',{ascending:false}).limit(100);
  if (branchId) query = query.eq('branch_id',branchId);
  const {data,error} = await query;
  if (error) throw new Error('Unable to load online sales.');
  return (data ?? []) as OnlineSale[];
}
export async function listOnlineSaleLines(saleId: string): Promise<OnlineSaleLine[]> {
  if (!await getCurrentStaff()) throw new Error('Staff authentication required.');
  const {data,error} = await getSupabaseClient().from('cms_sale_lines')
    .select('id,sale_id,product_id,description,quantity,unit_price').eq('sale_id',saleId).limit(200);
  if (error) throw new Error('Unable to load sale lines.');
  return (data ?? []) as OnlineSaleLine[];
}
