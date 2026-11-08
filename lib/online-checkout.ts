import { getSupabaseClient } from './supabase-client';
import { getCurrentStaff } from './supabase-auth';

/** Finalizes an existing draft with lines and payments, atomically on the server.
 * This is not wired to the production POS UI. */
export async function finalizeOnlineSale(saleId: string): Promise<{sale_id:string;status:'completed';total:number}> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId)) {
    throw new Error('Invalid sale identifier.');
  }
  const staff = await getCurrentStaff();
  if (!staff || !['cashier','admin'].includes(staff.role)) throw new Error('Cashier or Admin access required.');
  const {data,error} = await getSupabaseClient().rpc('cms_finalize_sale',{p_sale_id:saleId});
  if (error) throw new Error('Checkout failed. Verify draft, stock, and payment totals.');
  return data as {sale_id:string;status:'completed';total:number};
}
