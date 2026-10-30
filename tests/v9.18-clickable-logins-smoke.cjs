const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'uc-role-links-'));
try{
 const build=spawnSync('tsc',['--strict','--target','es2020','--module','commonjs','--lib','es2020,dom','--skipLibCheck','lib/data.ts','lib/demo-access.ts','--outDir',folder],{cwd:root,encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+'\n'+build.stderr);
 const d=require(path.join(folder,'data.js'));
 const access=require(path.join(folder,'demo-access.js'));
 const original=d.createSeed();
 assert.equal(original.users.length,0,'New install must remain free of automatically seeded accounts');
 assert.deepEqual(access.availableDemoLogins(original.users),[]);
 const enabled=access.enableDemoRoleLogins(original,'UCQC');
 assert.deepEqual(enabled.users.map(u=>u.role),['admin','cashier','pb']);
 assert.equal(access.availableDemoLogins(enabled.users).length,3);
 assert.equal(enabled.audit.length,1,'Explicit setup should be auditable');
 assert.equal(original.users.length,0,'Do not mutate original database');
 for(const k of ['pos','fundEntries','inventory','stockMovements','counts','turnovers','incidents','requests','terminalEvents'])assert.equal(enabled[k].length,0,`No ${k} sample data`);
 for(const br of d.BRANCHES){assert.equal(enabled.settings.rfBase[br.id],0);assert.equal(enabled.settings.rfpBase[br.id],0)}
 assert.throws(()=>access.enableDemoRoleLogins(enabled,'UCM'),/already has accounts/);
 assert.throws(()=>access.enableDemoRoleLogins({...original,pos:[{id:'real'}]},'UCM'),/only available on an empty/);
 assert.throws(()=>access.enableDemoRoleLogins({...original,audit:[{id:'a'}]},'UCM'),/only available on an empty/);
 assert.throws(()=>access.enableDemoRoleLogins({...original,settings:{...original.settings,rfBase:{...original.settings.rfBase,UCM:15}}},'UCM'),/only available on an empty/);
 const edited=enabled.users.map(u=>u.role==='admin'?{...u,password:'changed'}:u);
 assert.deepEqual(access.availableDemoLogins(edited).map(a=>a.role),['cashier','pb'],'Do not autofill an overridden password');
 assert.deepEqual(access.availableDemoLogins(enabled.users.map(u=>u.role==='cashier'?{...u,active:false}:u)).map(a=>a.role),['admin','pb'],'Inactive demo users must not be listed');
 assert.deepEqual(access.availableDemoLogins([{...enabled.users[0],role:'cashier'}]).map(a=>a.role),[],'Require matching role not just username');
 const ui=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
 assert(ui.includes('onClick={restoreDemoRoleAccess}')&&ui.includes('onClick={()=>{setUsername(a.username);setPassword(a.password);setShowPass(false);}}'),'Restored shortcut buttons must be wired');
 assert(ui.includes('Restore existing backup (JSON)'),'Existing users must retain recovery option');
 assert(ui.includes('parseStudioFiles(localStorage.getItem(STUDIO_KEY)).length'),'Existing Docs/Sheets must prevent demo takeover');
 console.log('PASS v9.18: explicit demo restore, clickable role login shortcuts, no seed data, no overwrite of existing accounts/records.');
} finally {fs.rmSync(folder,{recursive:true,force:true})}
