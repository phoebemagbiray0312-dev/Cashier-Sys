const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'uc-v917-'));
try{
 const build=spawnSync('tsc',['--strict','--target','es2020','--module','commonjs','--lib','es2020,dom','--skipLibCheck','lib/parts-purchase.ts','lib/local-storage-reset.ts','--outDir',out],{cwd:root,encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+'\n'+build.stderr);
 const parts=require(path.join(out,'parts-purchase.js'));
 const clean={branch:'UCM',assignedBranch:'UCM',plate:'abc-1234',vehicleYear:''};
 assert.equal(parts.partsPurchaseHeaderIssue(clean,2026),null,'Brand/year optional');
 assert.equal(parts.partsPurchaseHeaderIssue({...clean,vehicleYear:'2021'},2026),null);
 assert.match(parts.partsPurchaseHeaderIssue({...clean,plate:''},2026),/Plate number/);
 assert.match(parts.partsPurchaseHeaderIssue({...clean,branch:'UCQC'},2026),/assigned branch/);
 for(const vehicleYear of ['1935','2030','abcd','202','2020.5'])assert.match(parts.partsPurchaseHeaderIssue({...clean,vehicleYear},2026),/valid year/);
 const reset=require(path.join(out,'local-storage-reset.js'));
 assert(reset.CASHIER_LOCAL_KEYS.includes('underchargers-fund-management-demo-v1'));
 assert(reset.CASHIER_LOCAL_KEYS.includes('uc_report_studio_v1'));
 const mock=(obj)=>({data:{...obj},removeItem(key){delete this.data[key]},get length(){return Object.keys(this.data).length},key(index){return Object.keys(this.data)[index]??null}});
 const local=mock({'underchargers-fund-management-demo-v1':'financial-data','uc_report_studio_v1':'sheets','unrelated':'keep'});
 const session=mock({'uc_fund_session':'u-admin','uc_report_prompt_u1_x':'shown','external_session':'keep'});
 reset.clearCashierStorage(local,session);
 assert.deepEqual(local.data,{unrelated:'keep'});
 assert.deepEqual(session.data,{external_session:'keep'});
 const ui=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
 assert.match(ui,/Brand &amp; Model \(optional\)/);
 assert.match(ui,/Year \(optional\)/);
 assert.match(ui,/Purchase Branch \(RFP charged to this branch\)/);
 assert(ui.includes('options={branchOptions} required/>')); // PB can select every configured branch (v9.20)
 assert(ui.includes('branch:purchaseBranch'));
 assert(ui.includes("matchingPOS(db,purchaseBranch,plate)"));
 assert(ui.includes('clearAllAppLocalStorage')&&ui.includes('CLEAR ALL')&&ui.includes('Clear App Local Storage'));
 assert(ui.includes('Export Complete Local Backup')&&ui.includes("backupType:'UC-CASHIER-LOCAL'"));
 assert(ui.includes('parsed.studioFiles')&&ui.includes('restoreJSON'));
 let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
 const parsed=ts.createSourceFile('app/page.tsx',ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(x=>x.messageText).join('\n'));
 console.log('PASS v9.17/v9.20: optional vehicle details, PB branch selection, plate/COGS linking, safe local storage backup/reset, TSX syntax');
} finally {fs.rmSync(out,{recursive:true,force:true});}
