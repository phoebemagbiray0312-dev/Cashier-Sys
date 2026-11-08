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
 const staff=await Promise.all((data||[]).map(async row=>{const {data:authData}=await ctx.admin.auth.admin.getUserById(row.user_id);return {...row,email:authData.user?.email||''};}));
 return NextResponse.json({staff}, {headers:noStore});
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

async function staffTarget(request:NextRequest){
 const ctx=await context(request);
 if(!ctx)return {error:fail('Admin authentication required.',403)} as const;
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return {error:fail('Invalid request.',400)} as const;}
 const id=typeof body.userId==='string'?body.userId:'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return {error:fail('Invalid staff account.',400)} as const;
 if(id===ctx.user.id)return {error:fail('You cannot modify your own Admin account here.',403)} as const;
 const {data:target,error}=await ctx.admin.from('cms_profiles').select('user_id,role,active').eq('user_id',id).maybeSingle();
 if(error||!target)return {error:fail('Staff account not found.',404)} as const;
 if(target.role==='admin')return {error:fail('Other Admin accounts cannot be modified here.',403)} as const;
 return {ctx,body,id,target} as const;
}
export async function PATCH(request:NextRequest){
 const target=await staffTarget(request);
 if('error' in target)return target.error;
 const {ctx,body,id}=target;
 if(body.action==='reset-password'){
  const newPassword=typeof body.password==='string'?body.password:'';
  if(newPassword.length<12||newPassword.length>128)return fail('Password must contain 12–128 characters.',400);
  const {error}=await ctx.admin.auth.admin.updateUserById(id,{password:newPassword});
  if(error)return fail('Unable to reset password.',500);
  return NextResponse.json({ok:true},{headers:noStore});
 }
 if(body.action!=='edit')return fail('Invalid action.',400);
 const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
 const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 const role=String(body.role||'');
 const branch=String(body.branch||'');
 if(!/^[a-z][a-z0-9._-]{2,31}$/.test(username)||displayName.length<2||displayName.length>100||
 !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
 !['cashier','pb'].includes(role)||!(branches.includes(branch)||(role==='pb'&&branch==='ALL')))
 return fail('Invalid staff details.',400);
 const {data:other,error:lookupError}=await ctx.admin.from('cms_profiles').select('user_id').eq('username',username).neq('user_id',id).maybeSingle();
 if(lookupError)return fail('Unable to verify username.',500);
 if(other)return fail('Username is already taken.',409);
 const {data:authUser,error:authError}=await ctx.admin.auth.admin.getUserById(id);
 if(authError||!authUser.user)return fail('Unable to load staff identity.',500);
 const oldEmail=authUser.user.email||'';
 if(oldEmail.toLowerCase()!==email){
  const {error:emailError}=await ctx.admin.auth.admin.updateUserById(id,{email,email_confirm:true});
  if(emailError)return fail('Email is already in use or cannot be updated.',409);
 }
 const {error:profileError}=await ctx.admin.from('cms_profiles').update({username,display_name:displayName,role,branch_id:branch==='ALL'?null:branch}).eq('user_id',id);
 if(profileError){
  if(oldEmail.toLowerCase()!==email)await ctx.admin.auth.admin.updateUserById(id,{email:oldEmail,email_confirm:true});
  return fail(profileError.code==='23505'?'Username already exists.':'Unable to update staff profile.',409);
 }
 return NextResponse.json({ok:true},{headers:noStore});
}
export async function DELETE(request:NextRequest){
 const target=await staffTarget(request);
 if('error' in target)return target.error;
 const {ctx,id}=target;
 // Preserve financial/audit history and staff identity for historical attribution.
 // Revoke access rather than deleting referenced database records.
 const {error}=await ctx.admin.from('cms_profiles').update({active:false}).eq('user_id',id);
 if(error)return fail('Unable to deactivate staff account.',500);
 const {error:banError}=await ctx.admin.auth.admin.updateUserById(id,{ban_duration:'876000h'});
 if(banError)return fail('Account deactivated, but session ban could not be completed. Contact an administrator.',500);
 return NextResponse.json({ok:true,archived:true},{headers:noStore});
}
