const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-v9171-'));
try {
  const run = spawnSync('tsc', ['--strict','--target','es2020','--module','commonjs','--lib','es2020,dom','--skipLibCheck','lib/data.ts','--outDir',out], {cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
  const d = require(path.join(out,'data.js'));
  const fresh = d.createSeed();
  assert.equal(fresh.users.length,0, 'Fresh installs must not contain default accounts');
  const sampleAdmin = {id:'u-admin',username:'admin',password:'admin12345',name:'System Administrator',role:'admin',branch:'UCM',active:true};
  const existing = {...fresh,users:[sampleAdmin]};
  const before = JSON.stringify(existing);
  assert.equal(d.removeEmptyDemoAccounts(existing).users.length,1,'Upgrades must not remove users');
  assert.equal(JSON.stringify(existing),before,'Migration must not mutate user data');
  const local = {value:JSON.stringify(existing),getItem(key){return key===d.STORAGE_KEY?this.value:null},setItem(key,value){this.value=value}};
  global.window = {};
  global.localStorage = local;
  assert.equal(d.loadDB().users[0].username,'admin', 'loadDB must preserve existing logins');
  assert.equal(d.loadDB().users[0].password,'admin12345');
  assert.equal(d.setupFirstAdmin(d.createSeed(),{name:'Owner Admin',username:'owner',password:'minimum-twelve',branch:'UCM'}).users.length,1);
  const ui = fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  assert(ui.includes('restoreBackupBeforeSetup')&&ui.includes('Restore existing backup (JSON)'));
  assert(ui.includes('if(!restored.users.some(u=>u.role===\'admin\'&&u.active))'));
  assert(ui.includes('STORAGE_KEY')&&ui.includes('previousOffice'));
  console.log('PASS v9.17.1: legacy logins retained, clean install empty, no mutation, browser migration retains accounts, initial-setup backup recovery.');
} finally {
  delete global.window;delete global.localStorage;
  fs.rmSync(out,{recursive:true,force:true});
}
