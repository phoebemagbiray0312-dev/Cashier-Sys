'use client';
import {useEffect,useMemo,useState} from 'react';
import * as XLSX from 'xlsx';
import {getCurrentStaff} from '@/lib/supabase-auth';
import {listOnlineProducts,type OnlineProduct} from '@/lib/online-cashier';

type Row={name:string;qty:number|null;note:string;status:'Matched'|'New'|'Review';existing?:OnlineProduct};
const labels:Record<string,string>={UCM:'Underchargers Mandaluyong',UCQC:'Underchargers Quezon City',UCLP:'Underchargers Las Piñas',MMM:'Mastermind Mandaluyong'};
function clean(s:string){return s.replace(/<[^>]+>/g,'').replace(/&(?:#x20|nbsp);/gi,' ').replace(/\*\*/g,'').trim();}
function normalize(s:string){return clean(s).toUpperCase().replace(/[^A-Z0-9]/g,'');}
function number(s:string):number|null{const v=clean(s).replace(/,/g,'');if(!v)return null;if(/^\d+\s+1\/2$/.test(v))return Number(v.split(' ')[0])+.5;if(/^\d+(?:\.\d+)?$/.test(v))return Number(v);return null;}
function parse(text:string,branch:string,products:OnlineProduct[]):Row[]{
 const lines=text.split(/\r?\n/).filter(x=>x.trim().startsWith('|'));
 const matrix=lines.map(line=>line.split('|').slice(1,-1).map(clean));
 const header=matrix.findIndex(c=>branch==='MMM'?c.some(x=>x.toUpperCase().includes('STOCKS NAME')):c[0]?.toUpperCase()==='ITEM');
 if(header<0)throw new Error('Could not find the ITEM header. Upload the branch inventory Markdown table.');
 const cols=matrix[header].map(x=>x.toUpperCase());
 const matches=new Map<string,OnlineProduct[]>();
 for(const p of products){for(const key of [normalize(p.name),normalize(p.sku)]){if(!key)continue;matches.set(key,[...(matches.get(key)||[]),p]);}}
 const seen=new Set<string>();
 return matrix.slice(header+1).filter(c=>c[0]&&!/^[-: ]+$/.test(c[0])).map(c=>{
  const name=branch==='MMM'?[c[0],c[1]].filter(Boolean).join(' - '):c[0],key=normalize(name),found=[...new Map((matches.get(key)||[]).map(p=>[p.id,p])).values()];
  const beginning=number(c[branch==='MMM'?3:1]||'');
  const endings=cols.map((col,i)=>col.includes('ENDING')?number(c[i]||''):null).filter((n):n is number=>n!==null);
  let qty:number|null=beginning,note='Beginning stock (historical)';
  if(branch==='MMM'){const stockCols=cols.map((col,i)=>/ON HAND|TOTAL/.test(col)&&!/STOCK OUT/.test(col)?i:-1).filter(i=>i>=3);const vals=stockCols.map(i=>number((c[i]||'').replace(/\s*(PCS|PIECES|LITERS?|L)$/i,''))).filter((n):n is number=>n!==null);qty=vals.length?vals[vals.length-1]:beginning;note='Mastermind legacy stock format; quantity and units require verification';}
  else if(branch==='UCQC'){
   if(endings.length){qty=endings[endings.length-1];note='Last recorded ending balance; review later additions or incomplete dates';}
   else{note='No ending balance; beginning stock requires review';}
  }else if(branch==='UCLP'){
   if(endings.length){qty=endings[endings.length-1];note='Last recorded ending balance';}
   else{note='Beginning stock only; confirm no later movements';}
  }else note='Beginning stock only; confirm no later movements';
  const duplicate=seen.has(key);seen.add(key);
  const status:Row['status']=duplicate||qty===null||found.length>1||branch==='UCQC'||branch==='MMM'?'Review':found.length===1?'Matched':'New';
  return {name,qty,note:duplicate?'Duplicate item in uploaded file':found.length>1?'Multiple database matches; resolve manually':note,status,existing:found.length===1?found[0]:undefined};
 });
}
export default function InventoryImportPreview(){
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [branch,setBranch]=useState('UCM');
 const [products,setProducts]=useState<OnlineProduct[]>([]);
 const [fileName,setFileName]=useState('');
 const [raw,setRaw]=useState('');
 const [sheets,setSheets]=useState<Record<string,string>>({});
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [filter,setFilter]=useState('All');
 const [search,setSearch]=useState('');
 useEffect(()=>{getCurrentStaff().then(s=>setAuthorized(s?.role==='admin')).catch(()=>setAuthorized(false));},[]);
 useEffect(()=>{if(!authorized)return;let active=true;setLoading(true);listOnlineProducts(branch).then(p=>{if(active)setProducts(p);}).catch(()=>{if(active)setError('Could not load existing branch products.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[authorized,branch]);
 const parsed=useMemo(()=>{if(!raw||loading)return [];try{return parse(raw,branch,products);}catch{return [];}},[raw,branch,products,loading]);
 const visible=parsed.filter(r=>(filter==='All'||r.status===filter)&&(r.name.toLowerCase().includes(search.toLowerCase())));
 const totals={matched:parsed.filter(r=>r.status==='Matched').length,created:parsed.filter(r=>r.status==='New').length,review:parsed.filter(r=>r.status==='Review').length};
 async function upload(file?:File){if(!file)return;setError('');setRaw('');setSheets({});setFileName(file.name);try{if(file.size>5_000_000)throw new Error('File too large (5 MB maximum).');if(/\.xlsx?$/i.test(file.name)){const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});const map:Record<string,string>={};for(const [code,sheet] of Object.entries({UCQC:'QC',UCM:'MANDA',UCLP:'LP'})){const ws=workbook.Sheets[sheet];if(!ws)continue;const rows=XLSX.utils.sheet_to_json<(string|number|null)[]>(ws,{header:1,defval:''});map[code]=rows.map(row=>'| '+row.map(v=>String(v??'').replace(/\|/g,'/')).join(' | ')+' |').join('\n');}for(const sheet of ['STOCKS PRICE','MOBIL 1 ITEMS-STOCKS']){const ws=workbook.Sheets[sheet];if(!ws)continue;const rows=XLSX.utils.sheet_to_json<(string|number|null)[]>(ws,{header:1,defval:''});map.MMM=(map.MMM||'')+rows.map(row=>'| '+row.map(v=>String(v??'').replace(/\|/g,'/')).join(' | ')+' |').join('\n')+'\n';}if(!Object.keys(map).length)throw new Error('Expected UC branch sheets or Mastermind stock sheets.');setSheets(map);setRaw(map[branch]||'');}else{const text=await file.text();if(!text.includes('| ITEM ')&&!text.includes('**ITEM**'))throw new Error('Upload a valid inventory table.');setRaw(text);}}catch(e){setError(e instanceof Error?e.message:'Unable to read file.');}}
 return <main style={{maxWidth:1150,margin:'0 auto',padding:'22px 18px',color:'#27303f',fontFamily:'inherit'}}>
 <style>{` .import-card{background:#fff;border:1px solid #e7e8eb;border-radius:14px;padding:18px;margin-top:16px}.import-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.import-stat{background:#fff9e7;border:1px solid #f2e1a5;padding:14px;border-radius:10px}.import-stat strong{display:block;font-size:24px}.import-control{padding:10px;border:1px solid #d5d9e0;border-radius:8px;background:#fff;max-width:100%}.import-table{width:100%;border-collapse:collapse;font-size:13px}.import-table th,.import-table td{padding:11px;text-align:left;border-bottom:1px solid #e8eaef}.import-table th{background:#f8f9fb;color:#667085}.import-pill{border-radius:20px;background:#f2f3f5;padding:4px 9px;font-size:11px;font-weight:700}.import-muted{color:#667085;font-size:13px}.import-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.import-toolbar>*{flex:1;min-width:160px}@media(max-width:600px){.import-grid{gap:6px}.import-stat{padding:9px}.import-stat strong{font-size:19px}.import-card{padding:12px}.import-table{font-size:11px}.import-table th,.import-table td{padding:7px 5px}} `}</style>
 <a href="/?view=inventory" style={{color:'#987000',fontWeight:700}}>← Back to Inventory</a>
 <h1 style={{margin:'18px 0 5px',fontSize:24}}>Inventory Import Preview</h1>
 <p className="import-muted">Historical inventory baseline · Review only · No live stock changes</p>
 {authorized===null?<p>Checking Admin access...</p>:!authorized?<p role="alert">Admin access required. Please sign in as Admin.</p>:<>
 <div className="import-card"><div className="import-toolbar"><label>Branch<br/><select className="import-control" value={branch} onChange={e=>{setBranch(e.target.value);setRaw(sheets[e.target.value]||'');setError('');}}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Upload UC or Mastermind Excel (.xlsx)<br/><input className="import-control" type="file" accept=".xlsx,.xls,.md,.txt" onChange={e=>void upload(e.target.files?.[0])}/></label></div><p className="import-muted">{fileName?'Loaded: '+fileName:'UC: QC, MANDA, LP sheets. Mastermind: STOCKS PRICE and MOBIL 1 ITEMS-STOCKS.'}</p>{error&&<p role="alert" style={{color:'#a32626'}}>{error}</p>}{loading&&<p>Loading branch products...</p>}</div>
 <div className="import-grid"><div className="import-stat"><strong>{totals.matched}</strong><span>Matched</span></div><div className="import-stat"><strong>{totals.created}</strong><span>New</span></div><div className="import-stat"><strong>{totals.review}</strong><span>Needs review</span></div></div>
 <section className="import-card"><div className="import-toolbar"><input className="import-control" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product or SKU"/><select className="import-control" value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Matched','New','Review'].map(x=><option key={x}>{x}</option>)}</select></div><div style={{overflowX:'auto',marginTop:12}}><table className="import-table"><thead><tr><th>Product</th><th>File Qty</th><th>Current DB</th><th>Status</th></tr></thead><tbody>{visible.map((r,i)=><tr key={i}><td><strong>{r.name}</strong><div className="import-muted">{r.note}</div></td><td>{r.qty??'—'}</td><td>{r.existing?Number(r.existing.stock_qty):'—'}</td><td><span className="import-pill">{r.status}</span></td></tr>)}</tbody></table>{!visible.length&&<p className="import-muted">No rows to display. Upload a branch file to preview.</p>}</div></section>
 <div className="import-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><p className="import-muted" style={{margin:0}}>Import is locked until quantities and product matches are reviewed. No database writes occur on this page.</p><button disabled style={{background:'#f4c542',border:0,borderRadius:8,padding:'11px 16px',fontWeight:700,opacity:.55}}>Confirm Import (locked)</button></div>
 </>}
 </main>;
}
