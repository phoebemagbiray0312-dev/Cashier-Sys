'use client';
import {StaffAvatar} from '@/components/ProfileDialog';
import {useEffect,useState,type FormEvent} from 'react';
import {getCurrentStaff,type StaffIdentity} from '@/lib/supabase-auth';
import {getSupabaseClient} from '@/lib/supabase-client';
type StaffRow={user_id:string;username:string|null;display_name:string;role:string;branch_id:string|null;active:boolean;email?:string;is_super_admin?:boolean;avatar_url?:string|null};
const roleLabel=(row:{role:string;is_super_admin?:boolean})=>row.is_super_admin?'Super Admin':row.role==='admin'?'Admin':row.role==='pb'?'Parts Buyer':'Cashier';
const actionButton={display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,border:'1px solid #e2e5eb',borderRadius:8,background:'#fff',color:'#475467',cursor:'pointer',verticalAlign:'middle'} as const;
function ActionIcon({kind}:{kind:'edit'|'key'|'trash'}){return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='edit'?<><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></>:kind==='key'?<><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9-9L22 5.4l-2 2 1.6 1.6-2.4 2.4-1.6-1.6-3.8 3.8"/></>:<><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6"/><path d="M10 10v7m4-7v7"/></>}</svg>}
const branches=[{id:'UCM',name:'Underchargers Mandaluyong'},{id:'UCQC',name:'Underchargers Quezon City'},{id:'UCLP',name:'Underchargers Las Piñas'},{id:'MMM',name:'Mastermind Mandaluyong'}];
export default function StaffManagement({embedded=false}:{embedded?:boolean}){
 const [identity,setIdentity]=useState<StaffIdentity|null>(null);
 const [loading,setLoading]=useState(true);
 const [superAdmin,setSuperAdmin]=useState(false);
 const [rows,setRows]=useState<StaffRow[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [creating,setCreating]=useState(false);
 const [deleting,setDeleting]=useState<StaffRow|null>(null);
 const [editing,setEditing]=useState<StaffRow|null>(null);
 const [resetting,setResetting]=useState<StaffRow|null>(null);
 const [editDraft,setEditDraft]=useState({displayName:'',username:'',email:'',role:'cashier',branch:'UCM'});
 const [newPassword,setNewPassword]=useState('');
 const [username,setUsername]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [role,setRole]=useState('cashier');
 const [branch,setBranch]=useState('UCM');
 async function api(method:'GET'|'POST'|'PATCH'|'DELETE',body?:object){
  const {data:{session}}=await getSupabaseClient().auth.getSession();
  if(!session)throw new Error('Session expired. Please sign in again.');
  const response=await fetch('/api/admin/staff',{method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Request failed.');
  return result;
 }
 async function refresh(){const result=await api('GET');setRows(result.staff||[]);setSuperAdmin(result.me?.superAdmin===true);}
 useEffect(()=>{let mounted=true;getCurrentStaff().then(async staff=>{if(!mounted)return;setIdentity(staff);if(staff?.role==='admin')await refresh();}).catch(e=>{if(mounted)setMessage(e.message||'Unable to load accounts.');}).finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false;};},[]);
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await api('POST',{username,displayName,email,password,role,branch});setMessage('Staff account created successfully.');setUsername('');setDisplayName('');setEmail('');setPassword('');setCreating(false);await refresh();}catch(e){setMessage(e instanceof Error?e.message:'Could not create account.');}finally{setBusy(false);}}
 async function editStaff(e:FormEvent){e.preventDefault();if(!editing)return;setBusy(true);setMessage('');try{await api('PATCH',{action:'edit',userId:editing.user_id,...editDraft});await refresh();setEditing(null);setMessage('Staff account updated.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to update account.');}finally{setBusy(false);}}
 async function resetPassword(e:FormEvent){e.preventDefault();if(!resetting)return;setBusy(true);setMessage('');try{await api('PATCH',{action:'reset-password',userId:resetting.user_id,password:newPassword});setResetting(null);setNewPassword('');setMessage('Password reset. Share the new password privately with the staff member.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to reset password.');}finally{setBusy(false);}}
 async function removeStaff(row:StaffRow){setBusy(true);setMessage('');try{await api('DELETE',{userId:row.user_id});await refresh();setDeleting(null);setMessage('Staff access removed. Historical records are preserved.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to remove account.');}finally{setBusy(false);}}
 useEffect(()=>{if(!creating&&!editing&&!resetting&&!deleting)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){setCreating(false);setEditing(null);setResetting(null);setDeleting(null);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[creating,editing,resetting,deleting,busy]);
 const modalBackdrop={position:'fixed',inset:0,zIndex:9999,background:'rgba(15,23,42,.52)',display:'flex',alignItems:'center',justifyContent:'center',padding:20} as const;
 const modalPanel={width:'100%',maxWidth:620,maxHeight:'min(90vh,850px)',overflowY:'auto',padding:26,background:'#fff',borderRadius:16,boxShadow:'0 24px 70px rgba(0,0,0,.22)'} as const;
 const primaryButton={padding:'11px 20px',background:'#e6ba38',color:'#1c2430',border:0,borderRadius:9,fontWeight:700,cursor:'pointer'} as const;
 const secondaryButton={padding:'11px 20px',background:'#fff',color:'#475467',border:'1px solid #d0d5dd',borderRadius:9,cursor:'pointer'} as const;
 const field={width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,background:'#fff',color:'#222'} as const;
 return <main style={{maxWidth:embedded?'100%':960,margin:embedded?'0':'30px auto',padding:embedded?0:24,fontFamily:'Arial,sans-serif',color:'#222'}}>
 {!embedded&&<a href="/" style={{color:'#85630b'}}>← Cashier System</a>}
 {!embedded&&<h1 style={{fontSize:26}}>Staff Account Management</h1>}
 {loading?<p>Verifying administrator access...</p>:identity?.role!=='admin'?<p>Admin access required. <a href="/staff-login-test">Sign in as Admin</a>.</p>:<>
 <p>{embedded?"Manage real staff accounts, roles and branch access.":"Create Supabase accounts for Cashiers and Parts Buyers. Staff are limited to their assigned branch. Keep passwords private and share them securely."}</p>
 <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,margin:'18px 0 14px'}}><h2 style={{margin:0,fontSize:19}}>Registered staff</h2><button type="button" style={primaryButton} onClick={()=>{setMessage('');setCreating(true);}}>+ Add User</button></div>
 {message&&<p role="status">{message}</p>}
 {creating&&<div style={modalBackdrop}><section role="dialog" aria-modal="true" aria-label="Create staff account" style={modalPanel}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{margin:0,fontSize:22}}>Add Staff Account</h2><button type="button" aria-label="Close" style={secondaryButton} onClick={()=>setCreating(false)}>✕</button></div> <form onSubmit={create} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>
 <label>Full name<input style={field} required minLength={2} maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
 <label>Username<input style={field} required pattern="[a-z][a-z0-9._-]{2,31}" placeholder="e.g. cashier_ucm" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
 <label>Email<input style={field} required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Temporary password (12+ characters)<input style={field} required minLength={12} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label>Role<select style={field} value={role} onChange={e=>{const r=e.target.value;setRole(r);if(r==='admin')setBranch('ALL');else if(r==='cashier'&&branch==='ALL')setBranch('UCM');}}><option value="cashier">Cashier</option><option value="pb">Parts Buyer</option>{superAdmin&&<option value="admin">Admin</option>}</select></label>
 <label>Assigned branch<select style={field} value={branch} disabled={role==='admin'} onChange={e=>setBranch(e.target.value)}>{role!=='cashier'&&<option value="ALL">All Branches</option>}{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:10,marginTop:10}}><button type="button" style={secondaryButton} disabled={busy} onClick={()=>setCreating(false)}>Cancel</button><button disabled={busy} type="submit" style={primaryButton}>{busy?'Creating...':'Create Staff Account'}</button></div>
 </form>
</section></div>}
 {deleting&&<div style={modalBackdrop}><section role="alertdialog" aria-modal="true" aria-label="Confirm account deletion" style={{...modalPanel,maxWidth:460}}><h2 style={{marginTop:0}}>Delete Staff Account?</h2><p>Remove login access for <strong>{deleting.display_name}</strong>? The account will be deactivated and blocked from signing in. Financial records and audit history will be preserved.</p><div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:22}}><button type="button" disabled={busy} style={secondaryButton} onClick={()=>setDeleting(null)}>Cancel</button><button type="button" disabled={busy} style={{...primaryButton,background:'#b42318',color:'#fff'}} onClick={()=>removeStaff(deleting)}>{busy?'Removing...':'Delete Account'}</button></div></section></div>}
 {editing&&<div style={modalBackdrop}><section role="dialog" aria-modal="true" aria-label="Edit staff account" style={modalPanel}><form onSubmit={editStaff} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
 <h3 style={{gridColumn:'1 / -1'}}>Edit Account — {editing.display_name}</h3>
 <label>Full name<input required style={field} value={editDraft.displayName} onChange={e=>setEditDraft(x=>({...x,displayName:e.target.value}))}/></label>
 <label>Username<input required pattern="[a-z][a-z0-9._-]{2,31}" style={field} value={editDraft.username} onChange={e=>setEditDraft(x=>({...x,username:e.target.value.toLowerCase()}))}/></label>
 <label>Email<input required type="email" style={field} value={editDraft.email} onChange={e=>setEditDraft(x=>({...x,email:e.target.value}))}/></label>
 <label>Role<select style={field} value={editDraft.role} onChange={e=>setEditDraft(x=>({...x,role:e.target.value,branch:e.target.value==='admin'?'ALL':e.target.value==='cashier'&&x.branch==='ALL'?'UCM':x.branch}))}><option value="cashier">Cashier</option><option value="pb">Parts Buyer</option>{superAdmin&&<option value="admin">Admin</option>}</select></label>
 <label>Assigned branch<select style={field} value={editDraft.branch} disabled={editDraft.role==='admin'} onChange={e=>setEditDraft(x=>({...x,branch:e.target.value}))}>{editDraft.role!=='cashier'&&<option value="ALL">All Branches</option>}{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:10,marginTop:10}}><button type="button" style={secondaryButton} disabled={busy} onClick={()=>setEditing(null)}>Cancel</button><button type="submit" style={primaryButton} disabled={busy}>Save Changes</button></div>
 </form></section></div>}
 {resetting&&<div style={modalBackdrop}><section role="dialog" aria-modal="true" aria-label="Reset staff password" style={modalPanel}><form onSubmit={resetPassword} style={{display:'grid',gap:12}}>
 <h3 style={{margin:0}}>Reset Password — {resetting.display_name}</h3><p>Set a new temporary password (12–128 characters). Share it privately with the user.</p>
 <label>New password<input style={field} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
 <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:12}}><button type="button" style={secondaryButton} disabled={busy} onClick={()=>{setResetting(null);setNewPassword('');}}>Cancel</button><button type="submit" style={primaryButton} disabled={busy}>Confirm Password Reset</button></div>
 </form></section></div>}
 <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Username','Role','Branch','Status','Actions'].map(t=><th key={t} style={{padding:10,textAlign:'left',borderBottom:'1px solid #ddd'}}>{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.user_id}><td style={{padding:10}}><span style={{display:'inline-flex',alignItems:'center',gap:10}}><StaffAvatar name={row.display_name} url={row.avatar_url} className="avatar"/>{row.display_name}</span></td><td>{row.username||'Not assigned'}</td><td>{roleLabel(row)}</td><td>{row.branch_id||'All branches'}</td><td>{row.active?'Active':'Inactive'}</td><td style={{whiteSpace:'nowrap'}}>{!row.is_super_admin&&row.user_id!==identity?.id&&(row.role!=='admin'||superAdmin)&&<><button type="button" title="Edit account" aria-label={'Edit '+row.display_name} disabled={busy||!row.active} style={actionButton} onClick={()=>{setEditing(row);setResetting(null);setEditDraft({displayName:row.display_name,username:row.username||'',email:row.email||'',role:row.role,branch:row.branch_id||'ALL'});setMessage('');}}><ActionIcon kind="edit"/></button> <button type="button" title="Reset password" aria-label={'Reset password for '+row.display_name} disabled={busy||!row.active} style={actionButton} onClick={()=>{setResetting(row);setEditing(null);setNewPassword('');setMessage('');}}><ActionIcon kind="key"/></button> <button type="button" title="Delete account" aria-label={'Delete '+row.display_name} disabled={busy||!row.active} onClick={()=>{setMessage('');setDeleting(row);}} style={{...actionButton,color:'#b42318',background:'#fff7f6'}}><ActionIcon kind="trash"/></button></>}</td></tr>)}</tbody></table></div>
 </>}
 </main>;
}
