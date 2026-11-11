import { getSupabaseClient } from './supabase-client';

/** v9.30 — Supplier master list and supplier catalog stored in Supabase. */
export type OnlineSupplier = {
  id: string; name: string; phone: string; branch: string;
  status: 'For Review' | 'Verified' | 'Flagged'; by: string; at: string; reviewedAt: string | null;
};
export type OnlineSupplierItem = { id: string; supplierId: string; name: string; price: number | null; by: string; at: string };
export type SupplierActivity = { id: string; at: string; by: string; detail: string };

type SupRow = { id: string; name: string; contact: string | null; branch_id: string; status: OnlineSupplier['status']; created_by_name: string | null; created_at: string; reviewed_at: string | null };
type ItemRow = { id: string; supplier_id: string; name: string; price: number | string | null; created_by_name: string | null; created_at: string };

function clean(message?: string) {
  return (message || 'Request failed.').replace(/^SUP_[A-Z_]+:\s*/, '');
}

export async function loadSuppliers(): Promise<{ suppliers: OnlineSupplier[]; items: OnlineSupplierItem[]; activity: SupplierActivity[] }> {
  const supabase = getSupabaseClient();
  const [s, i] = await Promise.all([
    supabase.from('cms_suppliers').select('id,name,contact,branch_id,status,created_by_name,created_at,reviewed_at').order('name'),
    supabase.from('cms_supplier_items').select('id,supplier_id,name,price,created_by_name,created_at').order('created_at'),
  ]);
  if (s.error || i.error) throw new Error('Unable to load suppliers from the server.');
  const suppliers: OnlineSupplier[] = ((s.data || []) as SupRow[]).map(r => ({
    id: r.id, name: r.name, phone: r.contact || '', branch: r.branch_id, status: r.status,
    by: r.created_by_name || 'Staff', at: r.created_at, reviewedAt: r.reviewed_at,
  }));
  const items: OnlineSupplierItem[] = ((i.data || []) as ItemRow[]).map(r => ({
    id: r.id, supplierId: r.supplier_id, name: r.name, price: r.price === null ? null : Number(r.price),
    by: r.created_by_name || 'Staff', at: r.created_at,
  }));
  const names = new Map(suppliers.map(x => [x.id, x.name]));
  const activity: SupplierActivity[] = [
    ...suppliers.map(x => ({ id: 'c-' + x.id, at: x.at, by: x.by, detail: `Supplier submitted: ${x.name} (${x.branch})` })),
    ...suppliers.filter(x => x.reviewedAt && x.status !== 'For Review').map(x => ({ id: 'r-' + x.id, at: x.reviewedAt!, by: 'Admin', detail: `Supplier ${x.status === 'Verified' ? 'approved' : 'flagged'}: ${x.name} (${x.branch})` })),
    ...items.map(x => ({ id: 'i-' + x.id, at: x.at, by: x.by, detail: `Supplier catalog item added: ${names.get(x.supplierId) || ''} · ${x.name}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { suppliers, items, activity };
}

export async function addSupplier(name: string, contact: string, branch: string) {
  const { error } = await getSupabaseClient().rpc('cms_add_supplier', { p_name: name, p_contact: contact, p_branch: branch });
  if (error) throw new Error(clean(error.message));
}
export async function reviewSupplier(id: string, approve: boolean) {
  const { error } = await getSupabaseClient().rpc('cms_review_supplier', { p_id: id, p_approve: approve });
  if (error) throw new Error(clean(error.message));
}
export async function addSupplierItem(supplierId: string, name: string, price: number | null) {
  const { error } = await getSupabaseClient().rpc('cms_add_supplier_item', { p_supplier_id: supplierId, p_name: name, p_price: price });
  if (error) throw new Error(clean(error.message));
}
