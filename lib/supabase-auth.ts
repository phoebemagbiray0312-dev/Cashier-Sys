import { getSupabaseClient } from './supabase-client';

export type StaffRole = 'admin' | 'cashier' | 'pb';
export type StaffBranch = 'UCQC' | 'UCM' | 'UCLP' | 'MMM';
export interface StaffIdentity {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  branch: StaffBranch | null;
}

function validRole(value: unknown): value is StaffRole {
  return value === 'admin' || value === 'cashier' || value === 'pb';
}
function validBranch(value: unknown): value is StaffBranch {
  return value === 'UCQC' || value === 'UCM' || value === 'UCLP' || value === 'MMM';
}

/** Fetches authorization identity from the database, never from user-editable metadata. */
export async function getCurrentStaff(): Promise<StaffIdentity | null> {
  const supabase = getSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await supabase.from('cms_profiles')
    .select('user_id,display_name,role,branch_id,active')
    .eq('user_id', auth.user.id).maybeSingle();
  if (error || !data || !data.active || !validRole(data.role)) return null;
  if (data.role !== 'admin' && !validBranch(data.branch_id)) return null;
  if (data.branch_id !== null && !validBranch(data.branch_id)) return null;
  return {
    id: auth.user.id,
    email: auth.user.email ?? '',
    displayName: data.display_name || auth.user.email || 'Staff',
    role: data.role,
    branch: data.branch_id,
  };
}

/** Sign in is not authorization: a matching active staff profile is required. */
export async function signInStaff(email: string, password: string): Promise<StaffIdentity> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('Invalid credentials or sign-in unavailable.');
  const staff = await getCurrentStaff();
  if (!staff) {
    await supabase.auth.signOut();
    throw new Error('No active staff profile is assigned to this account.');
  }
  return staff;
}

export async function signOutStaff(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw new Error('Could not sign out. Please try again.');
}

/** Username/password staff sign-in through the server-only resolver. */
export async function signInStaffByUsername(username: string, password: string): Promise<StaffIdentity> {
  const response = await fetch('/api/auth/username-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }), cache: 'no-store',
  });
  const payload = await response.json() as { access_token?: string; refresh_token?: string; error?: string };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error || 'Invalid username/password or inactive account.');
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token, refresh_token: payload.refresh_token,
  });
  if (error) throw new Error('Could not establish your staff session.');
  const staff = await getCurrentStaff();
  if (!staff) {
    await supabase.auth.signOut();
    throw new Error('No active staff profile is assigned to this account.');
  }
  return staff;
}
