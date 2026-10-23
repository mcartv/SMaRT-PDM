const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
function fixture() {
  const records = new Map(); const removed = []; let failWrite = false; let uploads = 0;
  const query = async (sql,args) => {
    if (sql.startsWith('SELECT image_url')) return {rows: records.has(args[0]) ? [records.get(args[0])] : []};
    if (sql.startsWith('SELECT storage_path')) return {rows: records.has(args[0]) ? [records.get(args[0])] : []};
    if (sql.startsWith('INSERT')) {
      if (failWrite) throw Error('Database write failed');
      records.set(args[0],{image_url:args[1],storage_path:args[2]});
    }
    return {rows:[]};
  };
  const db = {query,connect:async()=>({query,release(){}})};
  const storage = {from:()=>({upload:async()=>{uploads++;return {};},getPublicUrl:path=>({data:{publicUrl:'https://images.example/'+path}}),remove:async paths=>{removed.push(...paths);return {};}})};
  const filename = require.resolve('../services/portalLogoService');
  const mod = new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
  mod.require = id => id==='../config/db' ? db : id==='../config/supabase' ? {storage} : require(id);
  mod._compile(require('fs').readFileSync(filename,'utf8'),filename);
  return {service:mod.exports,records,removed,get uploads(){return uploads;},fail(){failWrite=true;}};
}
const file = {mimetype:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10,0])};
test('logos isolate accounts and public scope; replacing and resetting remove only old objects', async()=>{
  const f=fixture();
  const first=await f.service.save('account/a',file);
  await f.service.save('public',file);
  assert.equal((await f.service.read('account/b')).image_url,null);
  await f.service.save('account/a',file);
  assert.equal(f.removed.length,1);
  assert.equal(first.image_url,'https://images.example/'+f.removed[0]);
  await f.service.save('account/a',null);
  assert.equal((await f.service.read('account/a')).image_url,null);
  assert.ok((await f.service.read('public')).image_url);
});
test('failed database save cleans new upload and preserves previous logo',async()=>{
  const f=fixture(); const before=await f.service.save('public',file);f.fail();
  await assert.rejects(f.service.save('public',file));
  assert.deepEqual(await f.service.read('public'),before);
  assert.equal(f.removed.length,1);
  assert.notEqual(before.image_url,'https://images.example/'+f.removed[0]);
});
test('reject unsupported, spoofed, missing and oversized images before upload',async()=>{
  const f=fixture();
  for (const invalid of [{buffer:Buffer.from('<svg/>'),mimetype:'image/png'},{...file,mimetype:'image/jpeg'},{buffer:Buffer.alloc(3145729),mimetype:'image/png'},{}]) {
    await assert.rejects(f.service.save('public',invalid),{statusCode:400});
  }
  assert.equal(f.uploads,0);
});
test('self-service handler derives identity from session, ignoring submitted scope',async()=>{
  const f=fixture();let body;
  const res={set(){return this;},json(value){body=value;return this;},status(){return this;}};
  await f.service.handler(req=>'account/'+req.user.user_id,'upload')({user:{user_id:'a'},body:{scope_key:'public'},file},res);
  assert.ok(body.image_url.includes('/account/a/'));
  assert.equal((await f.service.read('public')).image_url,null);
});
