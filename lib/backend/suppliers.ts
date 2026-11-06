import { getAuthorizedStaff } from './supabase-auth';
import type { BranchCode } from './supabase-auth';

export type SupplierRecord = { id: string; branch_id: BranchCode; name: string; contact: string | null; created_at: string };

function credentials(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) throw new Error('Authenticated Supabase connection required.');
  return { url: url.replace(/\/$/, ''), headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

/** RLS must independently enforce the branch and role; UI filters are not authorization. */
export async function listSuppliers(token: string, branch: BranchCode): Promise<SupplierRecord[]> {
  const { url, headers } = credentials(token);
  const q = new URLSearchParams({ select: 'id,branch_id,name,contact,created_at', branch_id: `eq.${branch}`, order: 'name.asc' });
  const res = await fetch(`${url}/rest/v1/cms_suppliers?${q}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to load authorized supplier records.');
  return res.json() as Promise<SupplierRecord[]>;
}

async function getSupabaseUserId(token: string): Promise<string> {
  const { url, headers } = credentials(token);
  const response = await fetch(`${url}/auth/v1/user`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error('Your session is no longer valid.');
  const user = await response.json() as { id: string };
  return user.id;
}

export async function createSupplier(token: string, branch: BranchCode, name: string, contact?: string): Promise<SupplierRecord> {
  const staff = await getAuthorizedStaff(token);
  if (!['admin','pb'].includes(staff.role) || (staff.role !== 'admin' && staff.branch_id !== branch)) throw new Error('Not authorized to create suppliers in this branch.');
  if (!name.trim()) throw new Error('Supplier name is required.');
  const { url, headers } = credentials(token);
  const res = await fetch(`${url}/rest/v1/cms_suppliers?select=id,branch_id,name,contact,created_at`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ branch_id: branch, name: name.trim(), contact: contact?.trim() || null, created_by: await getSupabaseUserId(token) }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Supplier save was rejected. Verify branch access and RLS policies.');
  const data = await res.json() as SupplierRecord[];
  if (!data[0]) throw new Error('Supplier save returned no record.');
  return data[0];
}
