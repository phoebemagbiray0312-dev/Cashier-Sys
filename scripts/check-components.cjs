/** Check imports in the source tree before the Next.js compiler runs. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const dirExtensions=['.tsx','.ts','.jsx','.js','.json'];
const excludes=new Set(['node_modules','.next','.git','tests']);
let missing=[];let checked=0;
function walk(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(excludes.has(item.name))continue;
  const target=path.join(dir,item.name);
  if(item.isDirectory()){walk(target);continue;}
  if(!/\.(tsx|ts|jsx|js)$/.test(item.name))continue;
  const body=fs.readFileSync(target,'utf8');
  const expression=/(?:from\s*|import\s*\(|require\s*\()\s*['"](@\/[^'"\s]+|\.{1,2}\/[^'"\s]+)['"]/g;
  let m;
  while((m=expression.exec(body))){
   const name=m[1];const dest=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(target),name);
   checked++;
   if(!dirExtensions.some(ext=>fs.existsSync(dest+ext))&&!dirExtensions.some(ext=>fs.existsSync(path.join(dest,'index'+ext))))missing.push(`${path.relative(root,target)} → ${name}`);
  }
 }
}
walk(path.join(root,'app'));walk(path.join(root,'components'));walk(path.join(root,'lib'));
if(missing.length){console.error('Missing local imports:\n'+missing.join('\n'));process.exit(1);}
console.log(`PASS: ${checked} local imports resolved; required components available`);
