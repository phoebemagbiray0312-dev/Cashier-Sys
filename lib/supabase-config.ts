/** Safe, opt-in Supabase connection settings. Existing localStorage app remains unchanged. */
export const cashierSupabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  enabled: process.env.NEXT_PUBLIC_CMS_BACKEND === 'supabase',
};
export function isCashierSupabaseConfigured(): boolean {
  const {url,publishableKey,enabled}=cashierSupabaseConfig;
  return enabled && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && publishableKey.length>0;
}
