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
  /** v9.31: profile picture (public URL) or null. */
  avatarUrl: string | null;
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
    .select('user_id,display_name,role,branch_id,active,is_super_admin,avatar_url')
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
    avatarUrl: data.avatar_url || null,
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

/** v9.29.1: The signed-in Supabase staff member as the app's User shape (for Sheets, Docs, Suppliers). */
export async function getSignedInAppUser(): Promise<import('./data').User | null> {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  return {
    id: 'supabase:' + staff.id, username: staff.email, name: staff.displayName, password: '',
    role: staff.role, branch: staff.branch || 'UCM', active: true,
  };
}

/** v9.31: Shrinks a picture to a 256×256 square WebP before upload (keeps files small). */
async function squareWebp(file: File): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPG or WebP picture.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Picture is too large (max 8 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not read that picture.')); i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not process the picture.');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process the picture.')), 'image/webp', 0.86));
  } finally { URL.revokeObjectURL(url); }
}

/**
 * v9.31: Updates the signed-in user's own name and picture.
 * `picture`: a new File to upload, `null` to remove, or `undefined` to keep the current one.
 */
export async function updateMyProfile(displayName: string, picture: File | null | undefined): Promise<StaffIdentity> {
  const supabase = getSupabaseClient();
  const current = await getCurrentStaff();
  if (!current) throw new Error('Your session has expired. Sign in again.');
  let avatarUrl = current.avatarUrl;
  if (picture === null) avatarUrl = null;
  if (picture) {
    const blob = await squareWebp(picture);
    const path = `${current.id}/avatar-${Date.now()}.webp`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (upErr) throw new Error('Could not upload the picture. Please try again.');
    avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.rpc('cms_update_my_profile', { p_display_name: displayName, p_avatar_url: avatarUrl });
  if (error) throw new Error((error.message || 'Profile could not be saved.').replace(/^PRO_[A-Z_]+:\s*/, ''));
  // Remove older pictures in this user's folder (best effort).
  const { data: files } = await supabase.storage.from('avatars').list(current.id);
  const keep = avatarUrl ? avatarUrl.split('/').pop() : '';
  const stale = (files || []).map(f => `${current.id}/${f.name}`).filter(p => !p.endsWith('/' + keep));
  if (stale.length) await supabase.storage.from('avatars').remove(stale);
  const updated = await getCurrentStaff();
  if (!updated) throw new Error('Your session has expired. Sign in again.');
  return updated;
}
