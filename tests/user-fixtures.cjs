// Test-only users: never imported by application runtime.
module.exports=function attachTestUsers(db){
 db.users=[
  {id:'u-admin',username:'admin',password:'test-admin-only',name:'System Administrator',role:'admin',branch:'UCM',active:true},
  {id:'u-cashier',username:'cashier',password:'test-cashier-only',name:'Cashier — Mandaluyong',role:'cashier',branch:'UCM',active:true},
  {id:'u-pb',username:'pbacc',password:'test-pb-only',name:'Parts Buyer — Mandaluyong',role:'pb',branch:'UCM',active:true}
 ];
 return db;
};
