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
  po_id: string | null;
}

/** All inventory writes are validated and logged by a single database transaction. */
export async function recordStockMovement(input: {
  productId: string;
  kind: StockOperation;
  quantity: number;
  reason: string;
  destinationBranch?: string;
  poId?: string;
}): Promise<Record<string, unknown>> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error('Active staff login required.');
  if (!Number.isFinite(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 100000000) {
    throw new Error('Invalid stock quantity.');
  }
  if (input.reason.trim().length < 3) throw new Error('Provide a reason for the stock movement.');
  const { data, error } = input.kind==='issue' && input.poId ? await getSupabaseClient().rpc('cms_issue_stock_for_po',{p_product_id:input.productId,p_quantity:input.quantity,p_reason:input.reason.trim(),p_po_id:input.poId}) : await getSupabaseClient().rpc('cms_record_stock_movement', {
    p_product_id: input.productId,
    p_kind: input.kind,
    p_quantity: input.quantity,
    p_reason: input.reason.trim(),
    p_destination_branch: input.destinationBranch ?? null,
  });
  if (error) throw new Error('Stock operation failed. Check role, branch, SKU, and available stock.');
  return data as Record<string, unknown>;
}
export async function listStockMovements(branchId?: string, startDate?: string, endDate?: string, type?: 'all'|'issue'): Promise<StockMovement[]> {
  if (!await getCurrentStaff()) throw new Error('Active staff login required.');
  let query = getSupabaseClient().from('cms_stock_movements')
    .select('id,product_id,branch_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,transfer_group,performed_by,created_at,po_id')
    .order('created_at', { ascending: false }).limit(1000);
  if (branchId) query = query.eq('branch_id', branchId);
  if (startDate) query = query.gte('created_at',new Date(startDate+'T00:00:00+08:00').toISOString());
  if (endDate) query = query.lt('created_at',new Date(new Date(endDate+'T00:00:00+08:00').getTime()+86400000).toISOString());
  if (type==='issue') query = query.eq('movement_type','issue');
  const {data,error} = await query;
  if (error) throw new Error('Could not load stock history.');
  return (data ?? []) as StockMovement[];
}

/** v9.56: parts the cashier took from the live branch inventory for a POS (unit). */
export interface POSStockUse {
  id: string; posId: string; productId: string; sku: string; name: string;
  qty: number; returned: number; unitCost: number | null; currentPrice: number;
  at: string; reason: string;
}
export async function listPOSStockUses(branchId?: string): Promise<POSStockUse[]> {
  if (!await getCurrentStaff()) return [];
  let q = getSupabaseClient().from('cms_stock_movements')
    .select('id,product_id,branch_id,movement_type,quantity_delta,reason,created_at,sale_pos_id,unit_cost,transfer_group,cms_products(sku,name,unit_price)')
    .not('sale_pos_id', 'is', null).order('created_at', { ascending: true }).limit(5000);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw new Error('Could not load parts used from inventory.');
  type Row = { id: string; product_id: string; movement_type: string; quantity_delta: number; reason: string; created_at: string; sale_pos_id: string; unit_cost: number | null; transfer_group: string | null; cms_products: { sku: string; name: string; unit_price: number } | { sku: string; name: string; unit_price: number }[] | null };
  const rows = (data ?? []) as unknown as Row[];
  const prod = (r: Row) => Array.isArray(r.cms_products) ? r.cms_products[0] : r.cms_products;
  const uses = rows.filter(r => r.movement_type === 'issue').map(r => ({
    id: r.id, posId: r.sale_pos_id, productId: r.product_id, sku: prod(r)?.sku || '', name: prod(r)?.name || 'Product',
    qty: -Number(r.quantity_delta), returned: 0, unitCost: r.unit_cost === null ? null : Number(r.unit_cost),
    currentPrice: Number(prod(r)?.unit_price || 0), at: r.created_at, reason: r.reason,
  }));
  for (const r of rows.filter(r => r.movement_type === 'receive' && r.transfer_group)) {
    const u = uses.find(x => x.id === r.transfer_group); if (u) u.returned += Number(r.quantity_delta);
  }
  return uses;
}
export function posStockUseCost(u: POSStockUse): number | null {
  const price = u.unitCost ?? (u.currentPrice > 0 ? u.currentPrice : null);
  return price === null ? null : Math.round((u.qty - u.returned) * price * 100) / 100;
}
export async function takeStockForPOS(productId: string, quantity: number, posId: string, note?: string) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Enter how many were used.');
  const { data, error } = await getSupabaseClient().rpc('cms_use_stock_for_pos', { p_product_id: productId, p_quantity: quantity, p_pos_id: posId, p_note: note?.trim() || null });
  if (error) throw new Error(/closed/i.test(error.message) ? 'This POS is closed. Use a linked transaction.' : /Insufficient/i.test(error.message) ? 'Not enough stock for that quantity.' : /not found/i.test(error.message) ? 'Save the POS first, then try again.' : 'Could not take the item from inventory.');
  return data as Record<string, unknown>;
}
export async function returnStockFromPOS(movementId: string, quantity: number) {
  const { data, error } = await getSupabaseClient().rpc('cms_return_stock_from_pos', { p_movement_id: movementId, p_quantity: quantity });
  if (error) throw new Error(/closed/i.test(error.message) ? 'This POS is closed. Ask Admin to correct it.' : /more than/i.test(error.message) ? 'You can only return what was used.' : 'Could not return the item to inventory.');
  return data as Record<string, unknown>;
}
