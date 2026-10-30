/** A4 portrait paper shared by CMS review and the future external approvers.
 * All figures are frozen at request generation, never guessed from external stages. */
import {BRANCHES,BRANCH_NAME,type Receipt} from './data';
import type {DisbursementRequest} from './disbursement-requests';
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const money=(n:number)=>'PHP '+(Math.round(n*100)/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const branchRows=(r:DisbursementRequest)=>r.sourceFund==='RFP'?BRANCHES:BRANCHES.filter(b=>b.id===r.branch);
const total=(r:DisbursementRequest,field:'amount'|'onlineCharge'|'total')=>(r.sourceLines||[]).reduce((v,l)=>v+l[field],0);
export function renderDisbursementPaper(r:DisbursementRequest):string {
 const lines=r.sourceLines||[];
 const funds=Object.values(r.sourceBalances||{}),opening=funds.reduce((s,x)=>s+(x?.fundBalance||0),0),remaining=funds.reduce((s,x)=>s+(x?.remaining||0),0);
 return `<section class="paper"><header><div class="muted">UNDERCHARGERS · FINANCE OPERATIONS</div><h1>${esc(r.sourceFund==='RFP'?'RFP':'REVOLVING FUND')} DISBURSEMENT REQUEST</h1><div>CONSOLIDATED APPROVAL PAPER · ${r.sourceFund==='RFP'?'ALL BRANCHES':esc(BRANCH_NAME(r.branch))}</div><p><b>Request:</b> ${esc(r.requestNo)} &nbsp; <b>Prepared:</b> ${esc(r.requestDate)} &nbsp; <b>Status:</b> ${esc(r.status)}</p><p><b>Prepared by:</b> ${esc(r.requestorName)} (${esc(r.employeeId)}) · ${r.requestorRole==='pb'?'Parts Buyer':'Cashier'}</p>${r.coverageUntil?`<p><b>Cycle snapshot:</b> ${esc(r.coverageUntil)} · Unclaimed earlier-period expenses remain eligible.</p>`:''}</header>
 <h2>1. Disbursement Transaction Summary</h2><table><colgroup><col width="16%"><col width="26%"><col width="17%"><col width="18%"><col width="23%"></colgroup><thead><tr><th>Date</th><th>Amount &amp; Branch</th><th>Online Payment Charge</th><th>Total Expenses</th><th>Remarks</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.date)}</td><td><b>${money(l.amount)}</b><div class="muted">${esc(BRANCH_NAME(l.branch))}</div></td><td class="num">${money(l.onlineCharge)}</td><td class="num"><b>${money(l.total)}</b></td><td>${esc(l.remarks)}<div class="muted">${esc(l.reference)}</div></td></tr>`).join('')||'<tr><td colspan="5">Legacy request — no source expense rows stored.</td></tr>'}<tr class="total"><th>TOTAL</th><th class="num">${money(total(r,'amount'))}</th><th class="num">${money(total(r,'onlineCharge'))}</th><th class="num">${money(r.amount)}</th><th></th></tr></tbody></table>
 <div class="summary"><h2>2. Fund Summary — Total per Branch</h2><table><tbody>${branchRows(r).map(b=>`<tr><td>${esc(b.name)}</td><td class="num">${money(lines.filter(l=>l.branch===b.id).reduce((s,l)=>s+l.total,0))}</td></tr>`).join('')}<tr class="total"><td>GRAND TOTAL</td><td class="num">${money(r.amount)}</td></tr></tbody></table>
 <h2>3. Fund Balance &amp; Amount Requested</h2><table><tbody><tr><td>Fund Balance (snapshot)</td><td class="num">${money(opening)}</td></tr><tr><td>Less: Expenses in this request</td><td class="num">${money(r.amount)}</td></tr><tr><td>Remaining Fund (snapshot)</td><td class="num">${money(remaining)}</td></tr><tr class="total"><td>AMOUNT REQUESTED</td><td class="num">${money(r.amount)}</td></tr></tbody></table></div>
 <h2>4. Approval &amp; Verification</h2><div class="approvals"><div><div class="line">${esc(r.requestorName)}</div>Prepared by · ${r.requestorRole==='pb'?'PB':'Cashier'}</div><div><div class="line">${r.accounting?.actorName?esc(r.accounting.actorName):'Pending'}</div>Checked by · Accounting</div><div><div class="line">${r.msKate?.actorName?esc(r.msKate.actorName):'Pending'}</div>Verified by · Auditor / Ms Kate</div><div><div class="line">Not signed / configured</div>Approved by · President (paper field)</div></div>
 <div class="foot">${esc(r.remarks||'')}<p>Review copy only. CMS frontend cannot verify external approvals or post payments. Paper signatures are not approval events. ${r.attachments.length} receipt file(s) referenced / included with generated PDF.</p></div></section>`;
}
export function printDisbursementPaper(r:DisbursementRequest){
 const w=window.open('','_blank');if(!w){window.alert('Allow pop-ups to print the request.');return;}
 w.document.open();w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.requestNo)}</title><style>@page{size:A4 portrait;margin:11mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#17253a;margin:0}.paper{max-width:188mm;margin:auto}header{text-align:center;padding-bottom:10px;border-bottom:2px solid #273647}header h1{font-size:16px;margin:6px 0}h2{font-size:11px;margin:14px 0 6px}.muted{font-size:9px;color:#677488}table{border-collapse:collapse;width:100%;font-size:9px;table-layout:fixed}th,td{border:1px solid #a7b1be;padding:6px 5px;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}th{text-align:left;background:#ebf0f5}.num{text-align:right;white-space:normal}.total td,.total th{background:#eef2f6;font-weight:bold}.summary{break-inside:avoid}.approvals{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:32px}.approvals>div{font-size:9px}.line{border-top:1px solid #566;min-height:18px;padding-top:4px}.foot{margin-top:15px;color:#637083;font-size:9px}button{display:none}.paper-toolbar{display:none}@media screen{body{background:#edf1f5;padding:18px}.paper-toolbar{display:block;margin:0 auto 12px;max-width:188mm}.paper-toolbar button{display:inline-block;border:0;border-radius:6px;padding:10px 14px;color:white;background:#245c88;cursor:pointer}.paper{background:white;padding:12mm;box-shadow:0 2px 15px #bbb}}</style></head><body><div class="paper-toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>${renderDisbursementPaper(r)}</body></html>`);w.document.close();w.focus();
}

/** Generates one real PDF: A4 approval paper followed by original PDF pages / image receipts.
 * Receipt content is from existing source transactions; no re-upload and no fake PDF. */
export async function downloadDisbursementPDF(r:DisbursementRequest):Promise<void>{
 const {PDFDocument,StandardFonts,rgb}=await import('pdf-lib');
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const W=595.28,H=841.89,margin=34,tableW=W-margin*2;
 let page=doc.addPage([W,H]),y=H-42;
 const safe=(value:unknown)=>String(value??'').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
 const php=(v:number)=>'PHP '+(Math.round(v*100)/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const navy=rgb(.10,.17,.26),muted=rgb(.39,.45,.52),rule=rgb(.76,.80,.84),pale=rgb(.93,.95,.97);
 function txt(value:unknown,x:number,top:number,size=8,heavy=false,color=navy){
  page.drawText(safe(value),{x,y:top,size,font:heavy?bold:font,color});
 }
 function wrap(value:unknown,width:number,size=7.4):string[]{
  const words=safe(value).split(' ').filter(Boolean),lines:string[]=[];
  let line='';
  for(const word of words){
   if((font.widthOfTextAtSize(word,size)>width)){
    if(line){lines.push(line);line='';}
    let part='';for(const char of word){const next=part+char;if(font.widthOfTextAtSize(next,size)>width&&part){lines.push(part);part=char;}else part=next;}
    line=part;continue;
   }
   const next=line?line+' '+word:word;
   if(font.widthOfTextAtSize(next,size)>width&&line){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
 }
 function newPage(){page=doc.addPage([W,H]);y=H-39;}
 function ensure(height:number){if(y-height<48)newPage();}
 function divider(){page.drawLine({start:{x:margin,y:y-5},end:{x:W-margin,y:y-5},thickness:.6,color:rule});y-=14;}
 function heading(label:string){ensure(30);txt(label,margin,y,10.5,true);y-=19;}
 function pair(label:string,value:string,strong=false){ensure(17);txt(label,margin+4,y,8.3,strong);txt(value,margin+345,y,8.2,strong);y-=17;}
 txt('UNDERCHARGERS  |  FINANCE OPERATIONS',margin,y,9,true);y-=19;
 txt((r.sourceFund==='RFP'?'RFP':r.sourceFund==='RF'?'REVOLVING FUND':'LEGACY')+' DISBURSEMENT REQUEST',margin,y,14,true);y-=23;
 txt('Request: '+r.requestNo,margin,y,8.4,true);y-=15;
 txt('Date: '+r.requestDate+'   Status: '+r.status,margin,y,8);y-=14;
 txt('Prepared by: '+r.requestorName+' ('+(r.requestorRole==='pb'?'Parts Buyer':'Cashier')+')',margin,y,8);y-=14;
 if(r.coverageUntil){txt('Cycle snapshot: '+r.coverageUntil,margin,y,7.6);y-=12;}
 divider();heading('1. DISBURSEMENT TRANSACTION SUMMARY');
 const widths=[75,118,100,98,tableW-75-118-100-98];
 const starts=[margin];for(let i=1;i<widths.length;i++)starts.push(starts[i-1]+widths[i-1]);
 const labels=['DATE','AMOUNT & BRANCH','ONLINE CHARGE','TOTAL EXPENSES','REMARKS'];
 function gridRow(values:string[][],rowHeight:number,header=false){
  ensure(rowHeight);
  const bottom=y-rowHeight+2;
  if(header){page.drawRectangle({x:margin,y:bottom,width:tableW,height:rowHeight, color:pale});}
  for(let c=0;c<5;c++){
   const x=starts[c];
   page.drawLine({start:{x,y:y+2},end:{x,y:bottom},thickness:.4,color:rule});
   values[c].forEach((t,k)=>txt(t,x+4,y-11-(k*10),header?7:7.3,header));
  }
  page.drawLine({start:{x:margin+tableW,y:y+2},end:{x:margin+tableW,y:bottom},thickness:.4,color:rule});
  page.drawLine({start:{x:margin,y:bottom},end:{x:margin+tableW,y:bottom},thickness:.4,color:rule});
  page.drawLine({start:{x:margin,y:y+2},end:{x:margin+tableW,y:y+2},thickness:.4,color:rule});
  y=bottom-4;
 }
 function columnHeader(){gridRow(labels.map((v,c)=>wrap(v,widths[c]-8,7)),29,true);}
 columnHeader();
 const entries=r.sourceLines||[];
 if(!entries.length){gridRow([['Legacy request'],['No source rows'],['-'],[php(r.amount)],['Preserved historical request']],37);}
 for(const entry of entries){
  const columns=[wrap(entry.date,widths[0]-8),[...wrap(php(entry.amount),widths[1]-8),...wrap(BRANCH_NAME(entry.branch),widths[1]-8,6.8)],wrap(php(entry.onlineCharge),widths[2]-8),wrap(php(entry.total),widths[3]-8),wrap(entry.remarks+' '+entry.reference,widths[4]-8)];
  const h=Math.max(35,...columns.map(x=>x.length*10+11));
  if(y-h<48){newPage();columnHeader();}
  gridRow(columns,h);
 }
 const totalAmount=entries.reduce((s,e)=>s+e.amount,0),totalCharge=entries.reduce((s,e)=>s+e.onlineCharge,0);
 if(y-33<48){newPage();columnHeader();}
 gridRow([['TOTAL'],[php(totalAmount)],[php(totalCharge)],[php(r.amount)],['']],30,true);
 y-=9;heading('2. FUND SUMMARY - TOTAL PER BRANCH');
 for(const b of branchRows(r)){
  const amount=entries.filter(e=>e.branch===b.id).reduce((sum,e)=>sum+e.total,0);
  pair(b.name,php(amount));
 }
 divider();pair('GRAND TOTAL',php(r.amount),true);y-=8;
 heading('3. FUND BALANCE & AMOUNT REQUESTED');
 const figures=Object.values(r.sourceBalances||{});
 const balanceBefore=figures.reduce((sum,x)=>sum+(x?.fundBalance||0),0),remaining=figures.reduce((sum,x)=>sum+(x?.remaining||0),0);
 pair('Fund Balance (snapshot)',php(balanceBefore));
 pair('Less: Expenses in this request',php(r.amount));
 pair('Remaining Fund (snapshot)',php(remaining));
 divider();pair('AMOUNT REQUESTED',php(r.amount),true);y-=6;
 ensure(145);heading('4. APPROVAL / VERIFICATION');
 // Paper signatories are only display fields: Accounting / HRMS have no live CMS approval endpoints.
 const signatories:[string,string,string][]=[
  ['Prepared by',r.requestorName,r.submittedAt?'Submitted from CMS':'Draft'],
  ['Checked by - Accounting',r.accounting?.actorName||'Not signed',r.accounting?.state||'Pending external approval'],
  ['Verified by - Auditor / Ms Kate',r.msKate?.actorName||'Not signed',r.msKate?.state||'Awaiting Accounting approval'],
  ['Approved by - President','Not signed','Paper field; authority not configured']
 ];
 for(let i=0;i<signatories.length;i++){
  const col=i%2,row=Math.floor(i/2),x=margin+col*(tableW/2+6),yy=y-row*59;
  page.drawLine({start:{x,y:yy-29},end:{x:x+tableW/2-17,y:yy-29},thickness:.5,color:rule});
  txt(signatories[i][1],x+2,yy-20,8.2,true);
  txt(signatories[i][0],x+2,yy-40,8);
  txt(signatories[i][2],x+2,yy-51,7,false,muted);
 }
 y-=127;ensure(32);
 txt('CMS frontend only. Printed signatures are not approval records or proof of payment.',margin,y,7,false,muted);y-=13;
 txt('Original PDF/image source receipts follow where they can be embedded.',margin,y,7,false,muted);
 // Unique source receipts, preserving PDFs and original photos in a single downloadable PDF.
 const seen=new Set<string>();let idx=0;
 for(const receipt of r.attachments){if(!receipt?.data||seen.has(receipt.data))continue;seen.add(receipt.data);idx++;
  const match=/^data:([^;,]+);base64,(.+)$/i.exec(receipt.data);if(!match)continue;
  const mimetype=match[1].toLowerCase();const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
  try{
   if(mimetype==='application/pdf'){const original=await PDFDocument.load(bytes);const copied=await doc.copyPages(original,original.getPageIndices());copied.forEach(pg=>doc.addPage(pg));}
   else if(mimetype==='image/png'||mimetype==='image/jpeg'||mimetype==='image/jpg'){
    const im=mimetype==='image/png'?await doc.embedPng(bytes):await doc.embedJpg(bytes);
    const pg=doc.addPage([W,H]);pg.drawText(safe(`Receipt ${idx}: ${receipt.name}`).slice(0,85),{x:margin,y:H-28,font:bold,size:10});
    const scale=Math.min((W-2*margin)/im.width,(H-95)/im.height);pg.drawImage(im,{x:(W-im.width*scale)/2,y:35,width:im.width*scale,height:im.height*scale});
   }else if(mimetype==='image/webp'){
    const dataURL=await new Promise<string>((resolve,reject)=>{const source=new Image();source.onload=()=>{const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Canvas unavailable'));ctx.drawImage(source,0,0);resolve(canvas.toDataURL('image/png'));};source.onerror=()=>reject(new Error('Receipt image unavailable'));source.src=receipt.data;});
    const png=Uint8Array.from(atob(dataURL.split(',')[1]),c=>c.charCodeAt(0));const im=await doc.embedPng(png);const pg=doc.addPage([W,H]);pg.drawText(safe(`Receipt ${idx}: ${receipt.name}`).slice(0,85),{x:margin,y:H-28,font:bold,size:10});const scale=Math.min((W-2*margin)/im.width,(H-95)/im.height);pg.drawImage(im,{x:(W-im.width*scale)/2,y:35,width:im.width*scale,height:im.height*scale});
   }else{
    const pg=doc.addPage([W,H]);pg.drawText(safe(`Receipt ${idx}: ${receipt.name} (unsupported type; download original separately)`),{x:margin,y:H-35,font,size:9});
   }
  }catch{const pg=doc.addPage([W,H]);pg.drawText(safe(`Receipt ${idx}: ${receipt.name} could not be embedded. Download original from CMS.`),{x:margin,y:H-35,font,size:9});}
 }
 const blob=new Blob([new Uint8Array(await doc.save())],{type:'application/pdf'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=`${r.requestNo.replace(/[^a-zA-Z0-9_-]/g,'_')}-with-receipts.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
