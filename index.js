// init sqlite db
/*
const dbFile = "./hashstack.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  if (!exists) {
    // TODO: init db, use db.run();
    console.log("Database initialized!");
  } else {
    console.log('Database loaded!');
    // query with db.each(SQL, (err, row) => {});
  }
});
*/
const ooPatch = require("json8-patch");
const oo = require("json8");
let changes=[]
let db=new Proxy({},{get:(o,k)=>{
  return o[k]
},set:(o,k,v)=>{
  let old=oo.clone(o);
  o[k]=v
  changes.push(ooPatch.diff(old,o))
  return o[k]
}})
