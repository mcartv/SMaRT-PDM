'use strict';
const fs=require('node:fs');
const path=require('node:path');

const projectRoot=path.resolve(process.argv[2]||process.cwd());
const srcMiddleware=path.join(__dirname,'admin','backend','middleware','systemAuditCoverageMiddleware.js');
const dstMiddleware=path.join(projectRoot,'admin','backend','middleware','systemAuditCoverageMiddleware.js');
const auditService=path.join(projectRoot,'admin','backend','services','auditLogService.js');
const serverFile=path.join(projectRoot,'admin','backend','server','server.js');
const srcTest=path.join(__dirname,'admin','backend','test','system-log-complete-coverage-regression.test.js');
const dstTest=path.join(projectRoot,'admin','backend','test','system-log-complete-coverage-regression.test.js');

for(const file of [srcMiddleware,auditService,serverFile,srcTest]){
  if(!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}
function backup(file){
  const b=`${file}.before-system-log-complete-coverage`;
  if(fs.existsSync(file)&&!fs.existsSync(b)) fs.copyFileSync(file,b);
}
backup(auditService); backup(serverFile); backup(dstMiddleware);
fs.mkdirSync(path.dirname(dstMiddleware),{recursive:true});
fs.copyFileSync(srcMiddleware,dstMiddleware);
fs.mkdirSync(path.dirname(dstTest),{recursive:true});
fs.copyFileSync(srcTest,dstTest);

let audit=fs.readFileSync(auditService,'utf8');
if(!audit.includes('__systemAuditLogged')){
  const patterns=[
    /async function logAudit\s*\(\s*\{[\s\S]*?\}\s*\)\s*\{/m,
    /const logAudit\s*=\s*async\s*\(\s*\{[\s\S]*?\}\s*\)\s*=>\s*\{/m,
  ];
  let done=false;
  for(const rx of patterns){
    const m=audit.match(rx);
    if(!m) continue;
    audit=audit.replace(m[0],m[0]+'\n  if (req) req.__systemAuditLogged = true;');
    done=true; break;
  }
  if(!done) throw new Error('Could not patch logAudit() request marker.');
  fs.writeFileSync(auditService,audit,'utf8');
}

let server=fs.readFileSync(serverFile,'utf8');
const reqLine="const systemAuditCoverageMiddleware = require('../middleware/systemAuditCoverageMiddleware');";
if(!server.includes(reqLine)){
  server=server.replace(/const express\s*=\s*require\(['"]express['"]\);/,
    m=>m+'\n'+reqLine);
}
if(!server.includes('app.use(systemAuditCoverageMiddleware);')){
  server=server.replace(/const app\s*=\s*express\(\);/,
    m=>m+"\n\n// Fallback System Log coverage for successful mutations without a purpose-built audit entry.\napp.use(systemAuditCoverageMiddleware);");
}
fs.writeFileSync(serverFile,server,'utf8');
console.log('System Log coverage fix applied. No database migration required.');
