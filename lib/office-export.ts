/** Dependency-free OpenXML export for browser-only Office files. No eval or network calls. */
import {colName,cellStyleKey,type StudioWorksheet,type StudioCellStyle,displayCell} from './report-studio';
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const enc=new TextEncoder();
const u16=(v:number)=>[v&255,(v>>8)&255];
const u32=(v:number)=>[v&255,(v>>8)&255,(v>>16)&255,(v>>24)&255];
function crc32(data:Uint8Array){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** A ZIP stored archive; Word and Excel open this without external packages. */
export function zipOffice(parts:{path:string;text:string}[]):Blob{
 const local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const part of parts){
  const name=enc.encode(part.path),data=enc.encode(part.text),crc=crc32(data);
  const header=Uint8Array.from([0x50,0x4b,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
  local.push(header,name,data);
  const entry=Uint8Array.from([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
  central.push(entry,name);offset+=header.length+name.length+data.length;
 }
 const centralSize=central.reduce((a,b)=>a+b.length,0);
 const end=Uint8Array.from([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(parts.length),...u16(parts.length),...u32(centralSize),...u32(offset),...u16(0)]);
 return new Blob([...local,...central,end] as BlobPart[],{type:'application/zip'});
}
export function exportXlsx(sheets:StudioWorksheet[]):Blob {
 const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 const workbook=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name.slice(0,31).replace(/[\\/*?:\[\]]/g,'-')||`Sheet${i+1}`)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const fonts=['<font><sz val="11"/><name val="Aptos"/></font>'];
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'];
 const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
 const styleMap=new Map<string,number>();
 function styleId(style?:StudioCellStyle){
  if(!style||Object.keys(style).length===0)return 0;
  const key=JSON.stringify(style),cached=styleMap.get(key);if(cached!==undefined)return cached;
  let fontId=0,fillId=0;
  const hex=(v?:string)=>v&&/^#[0-9a-f]{6}$/i.test(v)?'FF'+v.slice(1).toUpperCase():null;
  if(style.bold||style.italic||style.underline||style.color){fontId=fonts.length;fonts.push(`<font><sz val="11"/><name val="Aptos"/>${style.bold?'<b/>':''}${style.italic?'<i/>':''}${style.underline?'<u/>':''}${hex(style.color)?`<color rgb="${hex(style.color)}"/>`:''}</font>`);}
  if(hex(style.background)){fillId=fills.length;fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${hex(style.background)}"/><bgColor indexed="64"/></patternFill></fill>`);}
  const id=xfs.length,numFmtId=style.format==='currency'?164:style.format==='percent'?10:0;
  xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="${fontId?1:0}" applyFill="${fillId?1:0}" applyNumberFormat="${numFmtId?1:0}"${style.align?' applyAlignment="1"':''}>${style.align?`<alignment horizontal="${style.align}"/>`:''}</xf>`);
  styleMap.set(key,id);return id;
 }
 const parts=[{path:'[Content_Types].xml',text:types},{path:'_rels/.rels',text:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{path:'xl/workbook.xml',text:workbook},{path:'xl/_rels/workbook.xml.rels',text:rels}];
 for(const [index,sheet] of sheets.entries()){
  const rows=sheet.rows.map((row,r)=>{
   const cells=row.map((v,c)=>{
    if(v==='')return '';
    const ref=`${colName(c)}${r+1}`,sty=styleId(sheet.styles?.[cellStyleKey(r,c)]),styleTag=sty?` s="${sty}"`:'';
    if(v.startsWith('=')){const expr=v.slice(1).toUpperCase().replace(/\s+/g,'');const rest=expr.replace(/AVERAGE|COUNT|SUM|MIN|MAX|[A-Z]{1,2}[1-9]\d*|\d+(?:\.\d+)?|[()+\-*/,:]/g,'');if(expr&&rest==='')return `<c r="${ref}"${styleTag}><f>${xml(expr)}</f></c>`;}
    const n=Number(v.replace(/,/g,''));if(v.trim()!==''&&Number.isFinite(n)&&!/^0\d/.test(v.trim()))return `<c r="${ref}"${styleTag}><v>${n}</v></c>`;
    return `<c r="${ref}"${styleTag} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
   }).join('');return cells?`<row r="${r+1}">${cells}</row>`:'';
  }).join('');
  parts.push({path:`xl/worksheets/sheet${index+1}.xml`,text:`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`});
 }
 parts.push({path:'xl/styles.xml',text:`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`});
 return zipOffice(parts);
}
/** Convert a sanitized HTML document to a true editable .docx, preserving basic paragraph and table formatting. */
export function exportDocx(html:string):Blob {
 const body=new DOMParser().parseFromString(html,'text/html').body;
 function runs(node:Node,style:{b?:boolean;i?:boolean;u?:boolean}={}):string {
  if(node.nodeType===3){const value=node.textContent||'';return value?`<w:r><w:rPr>${style.b?'<w:b/>':''}${style.i?'<w:i/>':''}${style.u?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r>`:'';}
  if(node.nodeType!==1)return '';
  const el=node as HTMLElement;const tag=el.tagName;
  if(tag==='BR')return '<w:r><w:br/></w:r>';
  const next={b:style.b||['B','STRONG'].includes(tag),i:style.i||['I','EM'].includes(tag),u:style.u||tag==='U'};
  return Array.from(el.childNodes).map(n=>runs(n,next)).join('');
 }
 function paragraphs(el:Element):string {
  const tag=el.tagName;
  if(tag==='TABLE'){
   const trs=Array.from(el.querySelectorAll('tr'));
   return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${trs.map(tr=>`<w:tr>${Array.from(tr.children).map(td=>`<w:tc><w:p>${runs(td)}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
  }
  if(tag==='UL'||tag==='OL')return Array.from(el.children).map((li,i)=>`<w:p>${runs(document.createTextNode(tag==='OL'?`${i+1}. `:'• '))}${runs(li)}</w:p>`).join('');
  const heading=/^H[1-6]$/.test(tag)?tag:'';
  const style=heading?`<w:pPr><w:pStyle w:val="Heading${heading.slice(1)}"/></w:pPr>`:'';
  return `<w:p>${style}${runs(el)}</w:p>`;
 }
 const content=Array.from(body.children).map(paragraphs).join('');
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`;
 return zipOffice([{path:'[Content_Types].xml',text:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},{path:'_rels/.rels',text:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{path:'word/document.xml',text:doc},{path:'word/_rels/document.xml.rels',text:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},{path:'word/styles.xml',text:`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1,2,3,4].map(n=>`<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${Math.max(22,42-n*6)}"/></w:rPr></w:style>`).join('')}</w:styles>`}]);
}
export function downloadBlob(name:string,blob:Blob){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
/** CSV export uses safe displayed results for compatibility with Excel. */
export function visibleSheetValues(sheet:StudioWorksheet):string[][]{
 return sheet.rows.map((row,r)=>row.map((_,c)=>displayCell(sheet.rows,r,c)));
}
