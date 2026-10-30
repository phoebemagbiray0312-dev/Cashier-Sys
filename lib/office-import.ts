/** Read local .xlsx/.docx ZIP files in-browser. Never upload, execute formulas, or fetch external relationships. */
import {DEFAULT_SHEET_COLS,DEFAULT_SHEET_ROWS,newGrid,SHEET_MAX_COLS,SHEET_MAX_ROWS,type StudioWorksheet} from './report-studio';
import {sanitizeOfficeHtml} from './office-html';
const decoder=new TextDecoder('utf-8');
export async function openOfficeZip(file:File):Promise<Map<string,string>>{
 if(file.size>5_000_000)throw Error('Office file is too large (maximum 5 MB).');
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);const contents=new Map<string,string>();
 const u16=(n:number)=>view.getUint16(n,true),u32=(n:number)=>view.getUint32(n,true);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('The selected file is not a supported Office ZIP.');
 const count=u16(end+10);let p=u32(end+16),sum=0;
 if(count>500)throw Error('Office file contains too many entries.');
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||u32(p)!==0x02014b50)throw Error('Invalid Office ZIP directory.');
  const method=u16(p+10),compressed=u32(p+20),uncompressed=u32(p+24),nameLen=u16(p+28),extra=u16(p+30),comment=u16(p+32),loc=u32(p+42),path=decoder.decode(bytes.slice(p+46,p+46+nameLen));
  sum+=uncompressed;if(sum>24_000_000)throw Error('Office file has too much uncompressed data.');
  if(loc+30>bytes.length||u32(loc)!==0x04034b50)throw Error('Invalid Office ZIP entry.');
  const dataStart=loc+30+u16(loc+26)+u16(loc+28);
  if(dataStart+compressed>bytes.length)throw Error('Incomplete Office ZIP entry.');
  if(/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)|word\/document\.xml)$/.test(path)){
   const data=bytes.slice(dataStart,dataStart+compressed);let output:Uint8Array;
   if(method===0)output=data;
   else if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Your browser cannot decompress Office files.');const stream=new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));output=new Uint8Array(await new Response(stream).arrayBuffer());}
   else throw Error('Unsupported ZIP compression.');
   contents.set(path,decoder.decode(output));
  }
  p+=46+nameLen+extra+comment;
 }
 return contents;
}
const parseXml=(s:string)=>{const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid Office document XML.');return doc;};
const nodes=(el:Document|Element,local:string)=>Array.from(el.getElementsByTagNameNS('*',local));
export async function importXlsx(file:File):Promise<StudioWorksheet[]>{
 const contents=await openOfficeZip(file),work=contents.get('xl/workbook.xml');if(!work)throw Error('This is not an .xlsx workbook.');
 const book=parseXml(work),strings=contents.get('xl/sharedStrings.xml'),shared=strings?nodes(parseXml(strings),'si').map(el=>nodes(el,'t').map(t=>t.textContent||'').join('')):[];
 const rels=contents.get('xl/_rels/workbook.xml.rels'),relMap=new Map<string,string>();
 if(rels)for(const rel of nodes(parseXml(rels),'Relationship')){const target=rel.getAttribute('Target')||'';const id=rel.getAttribute('Id')||'';if(target&&!rel.getAttribute('TargetMode')&&!target.includes('://')){let part=target.startsWith('/')?target.slice(1):'xl/'+target;const path:string[]=[];for(const piece of part.split('/')){if(piece==='..')path.pop();else if(piece!=='.')path.push(piece);}relMap.set(id,path.join('/'));}}
 const imported:StudioWorksheet[]=[];
 for(const [i,tab] of nodes(book,'sheet').slice(0,12).entries()){
  const path=relMap.get(tab.getAttribute('r:id')||'')||`xl/worksheets/sheet${i+1}.xml`,raw=contents.get(path);if(!raw)continue;
  const xml=parseXml(raw),cells=nodes(xml,'c');let maxR=0,maxC=0;
  const parsed:{r:number;c:number;value:string}[]=[];
  for(const cell of cells){const ref=cell.getAttribute('r')||'';const m=/^([A-Z]+)(\d+)$/i.exec(ref);if(!m)continue;let c=0;for(const letter of m[1].toUpperCase())c=c*26+letter.charCodeAt(0)-64;c--;const r=Number(m[2])-1;if(r>=SHEET_MAX_ROWS||c>=SHEET_MAX_COLS||r<0||c<0)continue;
   const formula=nodes(cell,'f')[0]?.textContent||'';let value=formula?`=${formula}`:nodes(cell,'v')[0]?.textContent||'';
   if(!formula&&cell.getAttribute('t')==='s')value=shared[Number(value)]||'';
   else if(!formula&&cell.getAttribute('t')==='inlineStr')value=nodes(cell,'t').map(t=>t.textContent||'').join('');
   parsed.push({r,c,value});maxR=Math.max(r,maxR);maxC=Math.max(c,maxC);
  }
  const rows=newGrid(Math.max(DEFAULT_SHEET_ROWS,maxR+1),Math.max(DEFAULT_SHEET_COLS,maxC+1));for(const c of parsed)rows[c.r][c.c]=c.value;
  imported.push({id:`import-${i}-${Date.now()}`,name:(tab.getAttribute('name')||`Sheet ${i+1}`).slice(0,31),rows});
 }
 if(!imported.length)throw Error('No readable worksheets found in this workbook.');
 return imported;
}
const escapeHtml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function importDocx(file:File):Promise<string>{
 const raw=(await openOfficeZip(file)).get('word/document.xml');if(!raw)throw Error('This is not a supported .docx document.');
 const doc=parseXml(raw),body=nodes(doc,'body')[0];if(!body)return '<p></p>';
 function text(el:Element){return nodes(el,'t').map(n=>n.textContent||'').join('');}
 const parts:string[]=[];
 for(const child of Array.from(body.children)){
  if(child.localName==='p'){
   const pStyle=nodes(child,'pStyle')[0]?.getAttribute('w:val')||'';const tag=/^Heading[1-4]$/.test(pStyle)?`h${pStyle.slice(-1)}`:'p';
   const runs=Array.from(child.children).filter(c=>['r','hyperlink'].includes(c.localName)).map(r=>{
    const bold=nodes(r,'b').length>0,italic=nodes(r,'i').length>0,under=nodes(r,'u').length>0;
    let v=escapeHtml(text(r));if(bold)v=`<strong>${v}</strong>`;if(italic)v=`<em>${v}</em>`;if(under)v=`<u>${v}</u>`;return v;
   }).join('');parts.push(`<${tag}>${runs}</${tag}>`);
  }else if(child.localName==='tbl'){
   const trs=Array.from(child.children).filter(c=>c.localName==='tr');parts.push('<table><tbody>'+trs.map(tr=>'<tr>'+Array.from(tr.children).filter(c=>c.localName==='tc').map(tc=>`<td>${escapeHtml(text(tc))}</td>`).join('')+'</tr>').join('')+'</tbody></table>');
  }
 }
 return sanitizeOfficeHtml(parts.join(''));
}
