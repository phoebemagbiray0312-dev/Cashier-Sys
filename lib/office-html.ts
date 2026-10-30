/** Allow formatted report markup but never executable HTML or unsafe URLs/styles. */
export function sanitizeOfficeHtml(input:string):string {
 if(typeof DOMParser==='undefined')return '';
 const dom=new DOMParser().parseFromString(input,'text/html');
 const allowed=new Set(['H1','H2','H3','H4','P','DIV','BR','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD','SPAN','A','FONT','HR','SUB','SUP']);
 const dangerous=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','FORM','INPUT','BUTTON','LINK','META','VIDEO','MATH','NOSCRIPT','TEMPLATE','FRAME','FRAMESET']);
 function clean(root:Node):void{
  for(const child of Array.from(root.childNodes)){
   if(child.nodeType===8){child.parentNode?.removeChild(child);continue;}
   if(child.nodeType!==1)continue;
   const el=child as HTMLElement,tag=el.tagName;
   if(!allowed.has(tag)){
    if(dangerous.has(tag)){el.remove();continue;}
    clean(el);while(el.firstChild)el.parentNode?.insertBefore(el.firstChild,el);el.remove();continue;
   }
   let safeHref='';if(tag==='A'){
    const href=el.getAttribute('href')||'';
    if(/^(https?:\/\/|mailto:)/i.test(href))safeHref=href.slice(0,2000);
   }
   let safeStyle='';
   if(tag==='FONT'){
    const color=el.getAttribute('color')||'';if(/^#[0-9a-f]{3,8}$/i.test(color))safeStyle+=`color:${color.toLowerCase()};`;
    const size=Number(el.getAttribute('size'));if(size>=1&&size<=7)safeStyle+=`font-size:${[0,10,13,16,18,24,32,40][size]}px;`;
   }
   const styles=(el.getAttribute('style')||'').split(';').map(x=>x.trim()).filter(Boolean);
   for(const entry of styles){const idx=entry.indexOf(':');if(idx<0)continue;
    const prop=entry.slice(0,idx).trim().toLowerCase(),value=entry.slice(idx+1).trim().toLowerCase();
    if((prop==='text-align'&&/^(left|right|center|justify)$/.test(value))||(prop==='font-weight'&&/^(bold|normal|[1-9]00)$/.test(value))||(prop==='font-style'&&/^(italic|normal)$/.test(value))||(prop==='text-decoration'&&/^(underline|line-through|none)$/.test(value))||(prop==='font-size'&&/^(?:[8-9]|[1-6]\d|7[0-2])px$/.test(value))||(prop==='color'||prop==='background-color')&&(/^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/.test(value)))safeStyle+=`${prop}:${value};`;
   }
   for(const attr of Array.from(el.attributes))el.removeAttribute(attr.name);
   if(safeHref){el.setAttribute('href',safeHref);el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
   if(safeStyle)el.setAttribute('style',safeStyle);
   clean(el);
  }
 }
 clean(dom.body);
 return dom.body.innerHTML;
}
