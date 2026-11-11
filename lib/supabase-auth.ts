import { getSupabaseClient } from './supabase-client';

export type StaffRole = 'admin' | 'cashier' | 'pb';
export type StaffBranch = 'UCQC' | 'UCM' | 'UCLP' | 'MMM';
export interface StaffIdentity {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  branch: StaffBranch | null;
  /** v9.29: owner account — Settings, deleting records, audit log, Admin accounts. */
  superAdmin: boolean;
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
    .select('user_id,display_name,role,branch_id,active,is_super_admin')
    .eq('user_id', auth.user.id).maybeSingle();
  if (error || !data || !data.active || !validRole(data.role)) return null;
  if (data.role === 'cashier' && !validBranch(data.branch_id)) return null;
  if (data.branch_id !== null && !validBranch(data.branch_id)) return null;
  return {
    id: auth.user.id,
    email: auth.user.email ?? '',
    displayName: data.display_name || auth.user.email || 'Staff',
    role: data.role,
    branch: data.branch_id,
    superAdmin: data.role === 'admin' && data.is_super_admin === true,
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

/** v9.26: Changes the signed-in staff member's real Supabase password after re-checking the current one. */
export async function changeStaffPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 12 || newPassword.length > 128) throw new Error('New password must contain 12–128 characters.');
  if (newPassword === currentPassword) throw new Error('New password must be different from the current password.');
  const supabase = getSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.email) throw new Error('Your session has expired. Sign in again.');
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: auth.user.email, password: currentPassword });
  if (verifyError) throw new Error('Current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (/pwned|leaked|weak|compromised/i.test(error.message)) throw new Error('That password is too weak or has appeared in a data breach. Choose another.');
    throw new Error('Password could not be changed. Please try again.');
  }
}
