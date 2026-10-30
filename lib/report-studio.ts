/** Browser-only report studio. Snapshots are detached from authoritative transactions. */
export type StudioKind = 'sheet' | 'document';
export type StudioStatus = 'Draft' | 'Submitted' | 'Approved' | 'Changes Requested';
export type StudioCell = string;
export interface StudioFile {
 id: string; title: string; kind: StudioKind; status: StudioStatus;
 ownerId: string; ownerName: string; branch: string;
 createdAt: string; updatedAt: string; sourceName: string;
 sourceDate: string; sourceCount: number;
 reviewedBy?: string; reviewedAt?: string; reviewNote?: string;
 rows: StudioCell[][]; html: string;
 /** Legacy rows always mirror the first worksheet for backwards compatibility. */
 sheets?: StudioWorksheet[]; activeSheetId?: string;
}
export interface StudioCellStyle {
 bold?: boolean; italic?: boolean; underline?: boolean;
 align?: 'left'|'center'|'right'; format?: 'plain'|'currency'|'percent';
 background?: string; color?: string;
}
export interface StudioWorksheet { id:string; name:string; rows:StudioCell[][]; styles?:Record<string,StudioCellStyle>; }
export function getWorksheets(file:StudioFile):StudioWorksheet[]{
 return file.sheets?.length?file.sheets:[{id:'sheet-1',name:'Sheet 1',rows:file.rows}];
}
export function activeWorksheet(file:StudioFile):StudioWorksheet {
 const sheets=getWorksheets(file);return sheets.find(s=>s.id===file.activeSheetId)||sheets[0];
}
export function changeWorksheet(file:StudioFile,updated:StudioWorksheet):StudioFile {
 const sheets=getWorksheets(file).map(s=>s.id===updated.id?updated:s);
 return {...file,sheets,rows:sheets[0].rows};
}
export function cellStyleKey(row:number,col:number){return `${row}:${col}`;}
/** RFC4180-ish CSV parsing, including quoted newlines and escaped quotes. */
export function parseCsv(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'&&source[i+1]==='"'){value+='"';i++;}else if(ch==='"')quoted=false;else value+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===','){row.push(value);value='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
  else value+=ch;
 }
 if(value||row.length||source&&!/[\n\r]$/.test(source)){row.push(value);rows.push(row);}
 return rows;
}
export interface StudioSource {id:string; label:string; headers:string[]; rows:(string|number)[][];}
export const STUDIO_KEY = 'uc_report_studio_v1';
/** Same-origin paths: these work on any Vercel preview, production or custom domain. */
export const studioHomeHref=(kind:StudioKind)=>kind==='sheet'?'/sheets':'/docs';
export const studioFileHref=(file:Pick<StudioFile,'kind'|'id'>)=>`${studioHomeHref(file.kind)}/${encodeURIComponent(file.id)}`;
/** Permit only internal standalone office routes as a post-login return target. */
export function safeStudioReturnPath(value:string|null):string|null {
 if(!value||!/^\/(?:docs|sheets|documents|spreadsheets)(?:\/[A-Za-z0-9_-]{1,140})?\/?$/.test(value))return null;
 // Normalize legacy login links to the new canonical workspaces, without open redirects.
 return value.replace(/^\/documents(?=\/|$)/,'/docs').replace(/^\/spreadsheets(?=\/|$)/,'/sheets');
}

export const SHEET_MAX_ROWS = 1000;
export const SHEET_MAX_COLS = 52;
export const DEFAULT_SHEET_ROWS = 80;
export const DEFAULT_SHEET_COLS = 16;
export function newGrid(rowCount=DEFAULT_SHEET_ROWS,colCount=DEFAULT_SHEET_COLS):string[][]{
 return Array.from({length:rowCount},()=>Array.from({length:colCount},()=>''));
}
export function cloneSourceRows(source:StudioSource):string[][]{
 const width=Math.max(DEFAULT_SHEET_COLS,Math.min(SHEET_MAX_COLS,source.headers.length));
 const rows=newGrid(Math.min(SHEET_MAX_ROWS,Math.max(DEFAULT_SHEET_ROWS,source.rows.length+1)),width);
 source.headers.slice(0,width).forEach((h,c)=>{rows[0][c]=String(h)});
 source.rows.slice(0,SHEET_MAX_ROWS-1).forEach((values,i)=>values.slice(0,width).forEach((v,c)=>{rows[i+1][c]=String(v??'')}));
 return rows;
}
export function colName(index:number):string {let s='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function cellPos(label:string):[number,number]|null {
 const m=/^([A-Z]{1,2})([1-9]\d*)$/i.exec(label);
 if(!m)return null;
 const letters=m[1].toUpperCase();let c=0;for(const l of letters)c=c*26+l.charCodeAt(0)-64;
 const r=Number(m[2])-1;c--;
 return r>=0&&r<SHEET_MAX_ROWS&&c>=0&&c<SHEET_MAX_COLS?[r,c]:null;
}
function numeric(value:string):number {const n=Number(value.replace(/,/g,''));return Number.isFinite(n)?n:0;}
/** Non-eval formula interpreter. Supports arithmetic, references and range aggregation. */
export function displayCell(grid:string[][],row:number,col:number):string {
 const evaluating=new Set<string>();
 function calculate(r:number,c:number,depth:number):number|string {
  if(depth>60)return '#CYCLE!';
  const raw=grid[r]?.[c]??'';
  if(!raw.startsWith('='))return raw;
  const id=`${r}:${c}`;
  if(evaluating.has(id))return '#CYCLE!';
  evaluating.add(id);
  try {
   const expression=raw.slice(1).toUpperCase().replace(/\s+/g,'');
   const tokens=expression.match(/[A-Z]+[1-9]\d*|[A-Z]+|\d+(?:\.\d+)?|[()+\-*/,:]/g)||[];
   if(!expression||tokens.join('')!==expression)throw Error('syntax');
   let index=0;
   const resolve=(label:string):number=>{
    const pos=cellPos(label);if(!pos)throw Error('ref');
    const result=calculate(pos[0],pos[1],depth+1);
    if(typeof result==='string'&&result.startsWith('#'))throw Error(result);
    return typeof result==='number'?result:numeric(result);
   };
   const range=():number[]=>{
    const start=tokens[index++];if(!start||!cellPos(start))throw Error('range');
    if(tokens[index++]!==':')throw Error('range');
    const end=tokens[index++];if(!end||!cellPos(end))throw Error('range');
    const a=cellPos(start)!,b=cellPos(end)!,values:number[]=[];
    for(let rr=Math.min(a[0],b[0]);rr<=Math.max(a[0],b[0]);rr++)for(let cc=Math.min(a[1],b[1]);cc<=Math.max(a[1],b[1]);cc++){
     const rawCell=grid[rr]?.[cc]??'';
     if(rawCell.trim()&&!rawCell.startsWith('=')&&!Number.isFinite(Number(rawCell.replace(/,/g,''))))continue;
     if(rawCell.trim())values.push(resolve(`${colName(cc)}${rr+1}`));
    }
    return values;
   };
   const primary=():number=>{
    const token=tokens[index++];if(!token)throw Error('syntax');
    if(token==='('){const v=additive();if(tokens[index++]!==')')throw Error('syntax');return v;}
    if(token==='-')return -primary();if(token==='+')return primary();
    if(/^\d/.test(token))return Number(token);
    if(/^[A-Z]+[1-9]\d*$/.test(token))return resolve(token);
    if(/^(SUM|AVERAGE|COUNT|MIN|MAX)$/.test(token)){
     if(tokens[index++]!=='(')throw Error('syntax');
     const values:number[]=[];
     while(tokens[index]!==')'){
      if(index>=tokens.length)throw Error('syntax');
      if(cellPos(tokens[index])&&tokens[index+1]===':')values.push(...range());
      else values.push(additive());
      if(tokens[index]===',')index++;
      else if(tokens[index]!==')')throw Error('syntax');
     }
     index++;
     if(token==='SUM')return values.reduce((a,b)=>a+b,0);
     if(token==='AVERAGE')return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
     if(token==='COUNT')return values.length;
     if(token==='MIN')return values.length?Math.min(...values):0;
     return values.length?Math.max(...values):0;
    }
    throw Error('syntax');
   };
   const multiply=():number=>{let v=primary();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],next=primary();if(op==='/'&&next===0)throw Error('#DIV/0!');v=op==='*'?v*next:v/next;}return v;};
   const additive=():number=>{let v=multiply();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],next=multiply();v=op==='+'?v+next:v-next;}return v;};
   const result=additive();if(index!==tokens.length||!Number.isFinite(result))throw Error('syntax');
   return Number(result.toFixed(8));
  }catch(err){const msg=err instanceof Error?err.message:'';return msg==='#CYCLE!'||msg==='#DIV/0!'?msg:'#ERROR!';}
  finally {evaluating.delete(id);}
 }
 const value=calculate(row,col,0);
 return String(value);
}
/** CSV values cannot be interpreted as formulas when opened by external spreadsheet apps. */
export function escapeStudioCsv(text:string):string {
 const numericLiteral=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim());
 const safe=!numericLiteral&&/^[\s]*[=+\-@]/.test(text)?`'${text}`:text;
 return `"${safe.replace(/"/g,'""')}"`;
}
export function sourceToHtmlTable(source:StudioSource):string{
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 return `<h2>${escape(source.label)}</h2><p>Imported source snapshot — for reporting only, not the official transaction ledger.</p><table><thead><tr>${source.headers.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${source.rows.slice(0,SHEET_MAX_ROWS-1).map(row=>`<tr>${row.map(v=>`<td>${escape(String(v??''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
export function canEditStudio(file:StudioFile,actorId:string,role:string):boolean {
 return file.ownerId===actorId&&file.status!=='Approved'&&file.status!=='Submitted';
}
/** Only the creator can delete unsubmitted or returned drafts. Official review records stay intact. */
export function canDeleteStudio(file:StudioFile,actorId:string):boolean {
 return file.ownerId===actorId&&(file.status==='Draft'||file.status==='Changes Requested');
}
export function canReviewStudio(file:StudioFile,actorId:string,role:string):boolean {
 return role==='admin'&&file.ownerId!==actorId&&file.status==='Submitted';
}
export function parseStudioFiles(raw:string|null):StudioFile[] {
 if(!raw)return [];
 try {
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data))return [];
  return data.filter((v):v is StudioFile=>!!v&&typeof v==='object'&&typeof v.id==='string'&&typeof v.ownerId==='string'&&typeof v.title==='string'&&(v.kind==='sheet'||v.kind==='document')&&Array.isArray(v.rows)&&typeof v.html==='string'&&['Draft','Submitted','Approved','Changes Requested'].includes(v.status)).slice(0,150);
 }catch {return [];}
}

import {BRANCH_NAME,posClosedDate,posTotal,paidTotal,posCOGS,stockAvailable,normalizePlate} from './data';
import type {Database,BranchId,Role} from './data';
export function studioSources(db:Database,role:Role,userBranch:BranchId,selectedBranch:BranchId|'ALL',fromDate='',toDate=''):StudioSource[]{
 const scope=(branch:BranchId)=>branch===userBranch&&role!=='admin'||role==='admin'&&(selectedBranch==='ALL'||branch===selectedBranch);
 const period=(date:string)=>(!fromDate||date>=fromDate)&&(!toDate||date<=toDate);
 const sources:StudioSource[]=[];
 sources.push({id:'funds',label:'Fund Transactions',headers:['Transaction No','Fund','Type','Date','Branch','Payee','Amount','Status','Category'],rows:db.fundEntries.filter(e=>scope(e.branch)&&period(e.date)&&(role==='admin'||e.fund===(role==='cashier'?'RF':'RFP'))).map(e=>[e.no,e.fund,e.kind,e.date,BRANCH_NAME(e.branch),e.payee,e.amount,e.status,e.category])});
 if(role!=='pb'){
  sources.push({id:'sales',label:'Closed POS & Sales',headers:['POS No','Date','Branch','Customer','Plate','Sale','Paid','COGS','Status'],rows:db.pos.filter(p=>scope(p.branch)&&p.status==='Closed'&&period(posClosedDate(p))).map(p=>[p.no,posClosedDate(p),BRANCH_NAME(p.branch),p.client,p.plate,posTotal(p),paidTotal(p),posCOGS(p,db),p.status])});
  sources.push({id:'terminal',label:'Terminal Transaction Ledger',headers:['Date','Branch','Method','Type','Provider','Device ID','Receipt Reference','Amount','POS Number','Matching','Cashier','Notes'],rows:(db.terminalEvents||[]).filter(e=>scope(e.branch)&&period(e.date)).map(e=>[e.date,BRANCH_NAME(e.branch),e.mode,e.kind,e.provider,e.terminalId,e.reference,e.amount,db.pos.find(p=>p.id===e.posId)?.no||'',e.paymentId?'POS Linked':e.kind==='Payment'?'Unmatched':'Terminal Only',db.users.find(u=>u.id===e.createdBy)?.name||e.createdBy,e.notes])});
  sources.push({id:'terminal-settlements',label:'Terminal Settlement Reconciliation',headers:['Date','Branch','Provider','Device ID','Batch Reference','Expected Net','Reported Net','Variance','Unmatched','Exceptions','Status','Admin Notes'],rows:(db.terminalSettlements||[]).filter(s=>scope(s.branch)&&period(s.date)).map(s=>[s.date,BRANCH_NAME(s.branch),s.provider,s.terminalId,s.batchRef,s.expected,s.reportedTotal,s.variance,s.unmatchedAtSubmission,s.exceptionCountAtSubmission,s.status,s.reviewNotes||''])});
  sources.push({id:'cash',label:'Cash Counts',headers:['Date','Branch','Count','Actual','Expected','Variance'],rows:db.counts.filter(c=>scope(c.branch)&&period(c.date)).map(c=>[c.date,BRANCH_NAME(c.branch),c.kind,c.actual,c.expected,c.difference])});
  sources.push({id:'inventory',label:'Inventory Balance',headers:['Barcode','Product','Category','Branch','Units Available','Unit Cost','Reorder Level'],rows:db.inventory.filter(p=>scope(p.branch)&&!p.archivedAt).map(p=>[p.barcode,p.name,p.category,BRANCH_NAME(p.branch),stockAvailable(db,p),p.unitCost,p.reorderAt])});
  sources.push({id:'stock',label:'Stock Movement Ledger',headers:['Date','Branch','Barcode','Product','Movement','Qty','Reference','Notes'],rows:db.stockMovements.filter(m=>scope(m.branch)&&period(m.at.slice(0,10))).map(m=>{const p=db.inventory.find(i=>i.id===m.productId);const pos=db.pos.find(i=>i.id===m.posId);return [m.at.slice(0,10),BRANCH_NAME(m.branch),p?.barcode||'',p?.name||'Unknown product',m.kind,m.qty,pos?.no||m.receiptId||m.issueId||'',m.notes||'']})});
 }
 if(role!=='cashier'){
  sources.push({id:'parts',label:'Parts Purchases',headers:['Date','Part','Supplier','Plate','Vehicle','Branch','Qty','Unit Cost','Amount','Linked POS','Status'],rows:db.fundEntries.filter(e=>e.fund==='RFP'&&e.kind==='expense'&&scope(e.branch)&&period(e.date)).map(e=>{const linked=db.pos.find(p=>p.id===e.linkedPosId);const vehicle=linked?.vehicle||db.pos.find(p=>p.branch===e.branch&&normalizePlate(p.plate)===normalizePlate(e.plate||''))?.vehicle||e.car||'';return [e.date,e.description,e.payee,e.plate||'',vehicle,BRANCH_NAME(e.branch),e.quantity||1,e.unitCost||0,e.amount,linked?.no||'',e.status]})});
 }
 if(role==='admin')sources.push({id:'audit',label:'Audit Trail',headers:['Timestamp','Actor','Action','Details'],rows:db.audit.filter(a=>period(a.at.slice(0,10))).map(a=>[a.at,a.by,a.action,a.detail])});
 return sources;
}
