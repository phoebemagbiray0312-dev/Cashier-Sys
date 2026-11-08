'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {getCurrentStaff,type StaffIdentity} from '@/lib/supabase-auth';
import {getSupabaseClient} from '@/lib/supabase-client';
type StaffRow={user_id:string;username:string|null;display_name:string;role:string;branch_id:string|null;active:boolean;email?:string};
const branches=[{id:'UCM',name:'Underchargers Mandaluyong'},{id:'UCQC',name:'Underchargers Quezon City'},{id:'UCLP',name:'Underchargers Las Piñas'},{id:'MMM',name:'Mastermind Mandaluyong'}];
export default function StaffManagement({embedded=false}:{embedded?:boolean}){
 const [identity,setIdentity]=useState<StaffIdentity|null>(null);
 const [loading,setLoading]=useState(true);
 const [rows,setRows]=useState<StaffRow[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
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
 async function refresh(){const result=await api('GET');setRows(result.staff||[]);}
 useEffect(()=>{let mounted=true;getCurrentStaff().then(async staff=>{if(!mounted)return;setIdentity(staff);if(staff?.role==='admin')await refresh();}).catch(e=>{if(mounted)setMessage(e.message||'Unable to load accounts.');}).finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false;};},[]);
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await api('POST',{username,displayName,email,password,role,branch});setMessage('Staff account created successfully.');setUsername('');setDisplayName('');setEmail('');setPassword('');await refresh();}catch(e){setMessage(e instanceof Error?e.message:'Could not create account.');}finally{setBusy(false);}}
 async function editStaff(e:FormEvent){e.preventDefault();if(!editing)return;setBusy(true);setMessage('');try{await api('PATCH',{action:'edit',userId:editing.user_id,...editDraft});await refresh();setEditing(null);setMessage('Staff account updated.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to update account.');}finally{setBusy(false);}}
 async function resetPassword(e:FormEvent){e.preventDefault();if(!resetting)return;setBusy(true);setMessage('');try{await api('PATCH',{action:'reset-password',userId:resetting.user_id,password:newPassword});setResetting(null);setNewPassword('');setMessage('Password reset. Share the new password privately with the staff member.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to reset password.');}finally{setBusy(false);}}
 async function removeStaff(row:StaffRow){if(!window.confirm('Remove access for '+row.display_name+'? This disables login but preserves financial and audit records.'))return;setBusy(true);setMessage('');try{await api('DELETE',{userId:row.user_id});await refresh();setMessage('Staff access removed. Historical records are preserved.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to remove account.');}finally{setBusy(false);}}
 const field={width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,background:'#fff',color:'#222'} as const;
 return <main style={{maxWidth:embedded?'100%':960,margin:embedded?'0':'30px auto',padding:embedded?0:24,fontFamily:'Arial,sans-serif',color:'#222'}}>
 {!embedded&&<a href="/" style={{color:'#85630b'}}>← Cashier System</a>}
 {!embedded&&<h1 style={{fontSize:26}}>Staff Account Management</h1>}
 {loading?<p>Verifying administrator access...</p>:identity?.role!=='admin'?<p>Admin access required. <a href="/staff-login-test">Sign in as Admin</a>.</p>:<>
 <p>{embedded?"Manage real staff accounts, roles and branch access.":"Create Supabase accounts for Cashiers and Parts Buyers. Staff are limited to their assigned branch. Keep passwords private and share them securely."}</p>
 <form onSubmit={create} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14,padding:20,border:'1px solid #e5e7eb',borderRadius:12,background:'#fff'}}>
 <label>Full name<input style={field} required minLength={2} maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
 <label>Username<input style={field} required pattern="[a-z][a-z0-9._-]{2,31}" placeholder="e.g. cashier_ucm" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
 <label>Email<input style={field} required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Temporary password (12+ characters)<input style={field} required minLength={12} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label>Role<select style={field} value={role} onChange={e=>{setRole(e.target.value);if(e.target.value==='cashier'&&branch==='ALL')setBranch('UCM');}}><option value="cashier">Cashier</option><option value="pb">Parts Buyer</option></select></label>
 <label>Assigned branch<select style={field} value={branch} onChange={e=>setBranch(e.target.value)}>{role==='pb'&&<option value="ALL">All Branches</option>}{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 <div style={{gridColumn:'1 / -1'}}><button disabled={busy} type="submit" style={{padding:'12px 20px',background:'#e6ba38',border:0,borderRadius:8,fontWeight:700,cursor:'pointer'}}>{busy?'Creating...':'Create Staff Account'}</button></div>
 </form>
 {message&&<p role="status">{message}</p>}
 {editing&&<form onSubmit={editStaff} style={{padding:18,marginTop:18,background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
 <h3 style={{gridColumn:'1 / -1'}}>Edit Account — {editing.display_name}</h3>
 <label>Full name<input required style={field} value={editDraft.displayName} onChange={e=>setEditDraft(x=>({...x,displayName:e.target.value}))}/></label>
 <label>Username<input required pattern="[a-z][a-z0-9._-]{2,31}" style={field} value={editDraft.username} onChange={e=>setEditDraft(x=>({...x,username:e.target.value.toLowerCase()}))}/></label>
 <label>Email<input required type="email" style={field} value={editDraft.email} onChange={e=>setEditDraft(x=>({...x,email:e.target.value}))}/></label>
 <label>Role<select style={field} value={editDraft.role} onChange={e=>setEditDraft(x=>({...x,role:e.target.value,branch:e.target.value==='cashier'&&x.branch==='ALL'?'UCM':x.branch}))}><option value="cashier">Cashier</option><option value="pb">Parts Buyer</option></select></label>
 <label>Assigned branch<select style={field} value={editDraft.branch} onChange={e=>setEditDraft(x=>({...x,branch:e.target.value}))}>{editDraft.role==='pb'&&<option value="ALL">All Branches</option>}{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 <div style={{gridColumn:'1 / -1'}}><button type="submit" disabled={busy}>Save Changes</button> <button type="button" onClick={()=>setEditing(null)}>Cancel</button></div>
 </form>}
 {resetting&&<form onSubmit={resetPassword} style={{padding:18,marginTop:18,background:'#fff',border:'1px solid #e5e7eb',borderRadius:12}}>
 <h3>Reset Password — {resetting.display_name}</h3><p>Set a new temporary password (12–128 characters). Share it privately with the user.</p>
 <input style={{...field,maxWidth:400}} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
 <div style={{marginTop:12}}><button type="submit" disabled={busy}>Confirm Password Reset</button> <button type="button" onClick={()=>{setResetting(null);setNewPassword('');}}>Cancel</button></div>
 </form>}
 <h2 style={{marginTop:30}}>Registered staff</h2>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Username','Role','Branch','Status','Actions'].map(t=><th key={t} style={{padding:10,textAlign:'left',borderBottom:'1px solid #ddd'}}>{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.user_id}><td style={{padding:10}}>{row.display_name}</td><td>{row.username||'Not assigned'}</td><td>{row.role}</td><td>{row.branch_id||'All branches'}</td><td>{row.active?'Active':'Inactive'}</td><td style={{whiteSpace:'nowrap'}}>{row.role!=='admin'&&<><button type="button" disabled={busy||!row.active} onClick={()=>{setEditing(row);setResetting(null);setEditDraft({displayName:row.display_name,username:row.username||'',email:row.email||'',role:row.role,branch:row.branch_id||'ALL'});setMessage('');}}>Edit</button> <button type="button" disabled={busy||!row.active} onClick={()=>{setResetting(row);setEditing(null);setNewPassword('');setMessage('');}}>Reset Password</button> <button type="button" disabled={busy||!row.active} onClick={()=>removeStaff(row)} style={{color:'#b42318'}}>Delete</button></>}</td></tr>)}</tbody></table></div>
 </>}
 </main>;
}
