/**
 * Supabase Auth adapter for the staged migration.
 * NOT wired into the legacy local login until RLS, profile and session tests pass.
 * Never send service-role keys to this module.
 */
export type StaffRole = 'admin' | 'cashier' | 'pb';
export type BranchCode = 'UCM' | 'UCQC' | 'UCLP' | 'MMM';
export type StaffProfile = {
  user_id: string;
  display_name: string;
  role: StaffRole;
  branch_id: BranchCode | null;
  active: boolean;
};

type AuthResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !key) {
    throw new Error('Supabase is not configured. Set the URL and publishable key.');
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Do not leak raw server error payloads or credentials into UI.
    throw new Error(response.status === 401 || response.status === 400
      ? 'Authentication failed or session expired.'
      : 'Unable to reach the authentication service.');
  }
  return response.json() as Promise<T>;
}

export async function signInStaff(email: string, password: string): Promise<AuthResult> {
  const { url, key } = config();
  if (!email.trim() || !password) throw new Error('Email and password are required.');
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
    cache: 'no-store',
  });
  return parseResponse<AuthResult>(response);
}

/** The access token must come from Supabase Auth, never from a local role selector. */
export async function getAuthorizedStaff(accessToken: string): Promise<StaffProfile> {
  const { url, key } = config();
  if (!accessToken) throw new Error('Sign in required.');
  const user = await parseResponse<{ id: string }>(await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }));
  const query = new URLSearchParams({ select: 'user_id,display_name,role,branch_id,active', user_id: `eq.${user.id}`, limit: '1' });
  const profiles = await parseResponse<StaffProfile[]>(await fetch(`${url}/rest/v1/cms_profiles?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }));
  const profile = profiles[0];
  if (!profile?.active || !['admin', 'cashier', 'pb'].includes(profile.role)) {
    throw new Error('No active authorized staff profile was found.');
  }
  if (profile.role !== 'admin' && !profile.branch_id) {
    throw new Error('This staff account has no assigned branch.');
  }
  return profile;
}

export async function signOutStaff(accessToken: string): Promise<void> {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 204) throw new Error('Unable to sign out remotely.');
}
