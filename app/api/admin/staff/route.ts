import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const branches = ['UCQC','UCM','UCLP','MMM'];
const noStore = { 'Cache-Control': 'no-store' };
function fail(error: string, status: number) { return NextResponse.json({error}, {status,headers:noStore}); }
async function context(request: NextRequest) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!publicKey) return null;
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token) return null;
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await admin.auth.getUser(token);
 if(error||!user) return null;
 const {data:profile,error:profileError}=await admin.from('cms_profiles').select('role,active').eq('user_id',user.id).maybeSingle();
 if(profileError||!profile?.active||profile.role!=='admin') return null;
 return {admin,user};
}
export async function GET(request: NextRequest) {
 const ctx=await context(request);
 if(!ctx)return fail('Admin authentication required.',403);
 const {data,error}=await ctx.admin.from('cms_profiles').select('user_id,username,display_name,role,branch_id,active,created_at').order('created_at',{ascending:false});
 if(error)return fail('Unable to load staff accounts.',500);
 return NextResponse.json({staff:data}, {headers:noStore});
}
export async function POST(request: NextRequest) {
 const ctx=await context(request);
 if(!ctx)return fail('Admin authentication required.',403);
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return fail('Invalid request.',400);}
 const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
 const password=typeof body.password==='string'?body.password:'';
 const role=body.role;
 const branch=body.branch;
 if(!/^[a-z][a-z0-9._-]{2,31}$/.test(username)||displayName.length<2||displayName.length>100||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
    password.length<12||password.length>128||!['cashier','pb'].includes(String(role))||!(branches.includes(String(branch))||(role==='pb'&&branch==='ALL')))
   return fail('Enter a valid username, email, name, role, branch and a password of at least 12 characters.',400);
 const {data:existing,error:lookupError}=await ctx.admin.from('cms_profiles').select('user_id').eq('username',username).maybeSingle();
 if(lookupError)return fail('Unable to verify username.',500);
 if(existing)return fail('Username is already taken.',409);
 const {data:created,error:createError}=await ctx.admin.auth.admin.createUser({
  email,password,email_confirm:true,user_metadata:{display_name:displayName}
 });
 if(createError||!created.user)return fail('Could not create account. Check whether the email is already in use.',409);
 const {error:profileError}=await ctx.admin.from('cms_profiles').insert({
  user_id:created.user.id,username,display_name:displayName,role,branch_id:branch==='ALL'?null:branch,active:true
 });
 if(profileError){
  await ctx.admin.auth.admin.deleteUser(created.user.id);
  return fail(profileError.code==='23505'?'Username is already taken.':'Could not assign staff profile.',409);
 }
 return NextResponse.json({ok:true},{status:201,headers:noStore});
}
