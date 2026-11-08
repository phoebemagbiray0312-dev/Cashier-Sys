import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Configuration readiness only; never claims database connectivity or auth is working. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const validUrl = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url));
  const configured = Boolean(validUrl && key && key.trim().length > 0);
  return NextResponse.json(
    { backend: configured ? 'supabase-configured' : 'not-configured', readyForAuthTesting: configured },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
