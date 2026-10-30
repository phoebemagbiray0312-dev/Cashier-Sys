import {BRANCH_NAME,log,uid,type BranchId,type Database,type Role,type User} from './data';

/** Frontend-only QA convenience. These role logins must NEVER be used for production authentication. */
export const DEMO_ROLE_LOGINS:ReadonlyArray<{label:string;username:string;password:string;role:Role;name:string}> = [
 {label:'Admin',username:'admin',password:'admin12345',role:'admin',name:'Demo Administrator'},
 {label:'Cashier',username:'cashier',password:'cashier12345',role:'cashier',name:'Demo Cashier'},
 {label:'Parts Buyer',username:'pbacc',password:'pb12345',role:'pb',name:'Demo Parts Buyer'},
];

/** Only offer a quick-fill button when its exact test account still exists and is active. */
export function availableDemoLogins(users:ReadonlyArray<User>){
 return DEMO_ROLE_LOGINS.filter(shortcut=>users.some(u=>u.active&&u.role===shortcut.role&&u.username.trim().toLowerCase()===shortcut.username&&u.password===shortcut.password));
}

/** Explicitly opted-in, only on an empty local workspace; never overwrite existing users/records. */
export function enableDemoRoleLogins(db:Database,branch:BranchId):Database {
 if(db.users.length)throw new Error('This workspace already has accounts. Sign in or restore a backup instead.');
 if(db.audit.length||Object.values(db.settings.rfBase).some(amount=>amount!==0)||Object.values(db.settings.rfpBase).some(amount=>amount!==0)||db.pos.length||db.fundEntries.length||db.inventory.length||db.stockMovements.length||db.stockRequests.length||db.stockReceipts.length||(db.stockIssues||[]).length||(db.terminalEvents||[]).length||(db.terminalSettlements||[]).length||db.counts.length||db.incidents.length||db.turnovers.length||db.requests.length||(db.disbursementRequests||[]).length||(db.deletedPOSDrafts||[]).length)throw new Error('Demo access is only available on an empty workspace. Restore the existing login instead.');
 const users:User[]=DEMO_ROLE_LOGINS.map(shortcut=>({id:uid(),username:shortcut.username,password:shortcut.password,name:shortcut.name,role:shortcut.role,branch,active:true}));
 return log({...db,users},users[0].id,'Demo role logins enabled',`Explicit local demo setup · ${BRANCH_NAME(branch)} · No business seed records`);
}
