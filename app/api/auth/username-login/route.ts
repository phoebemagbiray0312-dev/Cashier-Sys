import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const genericError = 'Invalid username/password or inactive account.';

/**
 * Server-only username resolver. Never expose service role credentials to client code.
 * Requires SUPABASE_SERVICE_ROLE_KEY in the Vercel server environment.
 * Authentication still happens through Supabase Auth, not profile data.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secret) {
    return NextResponse.json({ error: 'Online staff login is not configured yet.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: genericError }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: genericError }, { status: 400 });
  const input = body as Record<string, unknown>;
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username) || !password || password.length > 256) {
    return NextResponse.json({ error: genericError }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const clientIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const hash = (value: string) => createHash('sha256').update(secret + ':' + value).digest('hex');
  const { data: allowed, error: rateError } = await admin.rpc('cms_register_login_attempt', { p_ip_hash: hash(clientIp), p_username_hash: hash(username) });
  if (rateError || allowed !== true) return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } });
  const { data: profile, error: profileError } = await admin.from('cms_profiles')
    .select('user_id,active').eq('username', username).maybeSingle();
  if (profileError || !profile?.active) {
    return NextResponse.json({ error: genericError }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
  const email = userResult.user?.email;
  if (userError || !email) return NextResponse.json({ error: genericError }, { status: 401 });
  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session || data.user?.id !== profile.user_id) {
    return NextResponse.json({ error: genericError }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, { headers: { 'Cache-Control': 'no-store' } });
}
