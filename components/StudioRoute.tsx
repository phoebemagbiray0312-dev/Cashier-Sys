'use client';
import React,{useEffect,useState} from 'react';
import {ArrowLeft,FileSpreadsheet,FileText,House,Lock} from 'lucide-react';
import {loadDB,BRANCHES,BRANCH_NAME,type Database,type BranchId,type User} from '@/lib/data';
import {studioSources,studioHomeHref,type StudioKind} from '@/lib/report-studio';
import ReportStudio from '@/components/ReportStudio';

/** Separate Next.js page: same-origin browser storage and active Cashier System session. */
export default function StudioRoute({kind,fileId}:{kind:StudioKind;fileId?:string}){
 const [db,setDb]=useState<Database|null>(null);
 const [user,setUser]=useState<User|null>(null);
 const [ready,setReady]=useState(false);
 const [branch,setBranch]=useState<BranchId|'ALL'>('ALL');
 const [fromDate,setFromDate]=useState(''),[toDate,setToDate]=useState('');
 useEffect(()=>{
  const stored=loadDB();const session=sessionStorage.getItem('uc_fund_session');
  setDb(stored);setUser(stored.users.find(u=>u.id===session&&u.active)||null);setReady(true);
 },[]);
 const branchScope=user?.role==='admin'?branch:user?.branch||'UCM';
 const sourceList=db&&user?studioSources(db,user.role,user.branch,branchScope,fromDate,toDate):[];
 const label=kind==='sheet'?'Spreadsheets':'Documents';
 const target=fileId?`${studioHomeHref(kind)}/${encodeURIComponent(fileId)}`:studioHomeHref(kind);
 if(!ready)return <div className="office-route-loading">Loading {label}...</div>;
 if(!user||!db)return <div className="office-standalone"><div className="office-auth"><Lock size={38}/><h1>Sign in to Underchargers</h1><p>Your {label.toLowerCase()} belong to the Cashier System workspace. Sign in using the same browser tab to access these local files.</p><a href={`/?next=${encodeURIComponent(target)}`} className="office-primary"><ArrowLeft size={17}/> Sign in to Cashier System</a></div></div>;
 return <div className="office-standalone"><header className="office-global-head"><a href="/" className="office-brand"><span className="office-uc">UC</span><strong>UNDERCHARGERS</strong><small>Workspace</small></a><nav aria-label="Workspace navigation"><a href="/" className="office-global-link"><House size={17}/> Cashier System</a><a href={studioHomeHref('sheet')} className={`office-global-link ${kind==='sheet'?'selected':''}`}><FileSpreadsheet size={17}/> Spreadsheets</a><a href={studioHomeHref('document')} className={`office-global-link ${kind==='document'?'selected':''}`}><FileText size={17}/> Documents</a></nav><div className="office-head-user"><span>{user.name}</span><small>{user.role==='admin'?'Admin':user.role==='pb'?'Parts Buyer':'Cashier'}</small></div></header><div className="office-branch-scope">{user.role==='admin'?<label>Report source branch <select value={branch} onChange={e=>setBranch(e.target.value as BranchId|'ALL')}><option value="ALL">All branches</option>{BRANCHES.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>:<span>Branch: {BRANCH_NAME(user.branch)}</span>}</div><ReportStudio key={`${kind}:${fileId||'library'}`} mode={kind} fileId={fileId} userId={user.id} userName={user.name} role={user.role} branch={user.role==='admin'?(branch==='ALL'?'All Branches':BRANCH_NAME(branch)):BRANCH_NAME(user.branch)} sources={sourceList} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate}/></div>;
}
