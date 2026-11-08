import { getSupabaseClient } from './supabase-client';
import { getCurrentStaff } from './supabase-auth';

export type StockOperation = 'receive' | 'issue' | 'adjust' | 'transfer';
export interface StockMovement {
  id: string;
  product_id: string;
  branch_id: string;
  movement_type: 'receive' | 'issue' | 'adjust' | 'transfer_in' | 'transfer_out';
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  transfer_group: string | null;
  performed_by: string;
  created_at: string;
}

/** All inventory writes are validated and logged by a single database transaction. */
export async function recordStockMovement(input: {
  productId: string;
  kind: StockOperation;
  quantity: number;
  reason: string;
  destinationBranch?: string;
}): Promise<Record<string, unknown>> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error('Active staff login required.');
  if (!Number.isFinite(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 100000000) {
    throw new Error('Invalid stock quantity.');
  }
  if (input.reason.trim().length < 3) throw new Error('Provide a reason for the stock movement.');
  const { data, error } = await getSupabaseClient().rpc('cms_record_stock_movement', {
    p_product_id: input.productId,
    p_kind: input.kind,
    p_quantity: input.quantity,
    p_reason: input.reason.trim(),
    p_destination_branch: input.destinationBranch ?? null,
  });
  if (error) throw new Error('Stock operation failed. Check role, branch, SKU, and available stock.');
  return data as Record<string, unknown>;
}
export async function listStockMovements(branchId?: string): Promise<StockMovement[]> {
  if (!await getCurrentStaff()) throw new Error('Active staff login required.');
  let query = getSupabaseClient().from('cms_stock_movements')
    .select('id,product_id,branch_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,transfer_group,performed_by,created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (branchId) query = query.eq('branch_id', branchId);
  const {data,error} = await query;
  if (error) throw new Error('Could not load stock history.');
  return (data ?? []) as StockMovement[];
}
