#!/usr/bin/env node
'use strict';
// Read-only static inventory. Not a substitute for runtime authorization tests.
const fs=require('fs'),path=require('path');
const root=process.cwd(),routesDir=path.join(root,'admin/backend/routes');
if(!fs.existsSync(routesDir)){console.error('Run from SMaRT-PDM repository root.');process.exit(1);}
const files=fs.readdirSync(routesDir).filter(f=>f.endsWith('.js')).sort();
const entries=[];
const routesRx=/\brouter\.(get|post|put|patch|delete|all)\s*\(\s*(['"`])([^'"`]+)\2/g;
for(const file of files){
 const content=fs.readFileSync(path.join(routesDir,file),'utf8');
 const lines=content.split(/\r?\n/);
 const matches=[...content.matchAll(routesRx)];
 for(let i=0;i<matches.length;i++){
  const m=matches[i];
  const before=content.slice(0,m.index),line=before.split('\n').length;
  // best-effort route argument window: stop before next router call or module export.
  const end=i+1<matches.length?matches[i+1].index:content.length;
  const block=content.slice(m.index,end);
  const guard=content.slice(Math.max(0,m.index-1200),m.index);
  const routeIsPublic=/\/public\b|\/verify\b|\/mobile\b|\/login\b|\/forgot-password\b/i.test(m[3]);
  const direct=[...block.matchAll(/requirePermission\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(x=>x[1]);
  const auth= /\bprotect\b|adminOnly|reportStaff|authorizeRoles\s*\(|authorizeRoleGroup\s*\(/.test(block);
  const routerUse= /router\.use\s*\(\s*protect/.test(content.slice(0,m.index));
  const likelyAuth=auth||routerUse;
  const category=direct.length?'DIRECT_PERMISSION':routeIsPublic?'PUBLIC_CANDIDATE':likelyAuth?'GUARDED_NO_DIRECT_PERMISSION':'REVIEW_AUTH_SCOPE';
  entries.push({file,method:m[1].toUpperCase(),endpoint:m[3],line,category,permissions:direct.join(';'),localGuard:auth?'yes':'no',upstreamRouterGuard:routerUse?'maybe':'no'});
 }
}
const counts=Object.fromEntries([...new Set(entries.map(e=>e.category))].map(k=>[k,entries.filter(e=>e.category===k).length]));
const escape=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const cols=['file','line','method','endpoint','category','permissions','localGuard','upstreamRouterGuard'];
const csv=[cols.join(','),...entries.map(row=>cols.map(k=>escape(row[k])).join(','))].join('\n')+'\n';
const report={generatedAt:new Date().toISOString(),scannedFiles:files.length,routeCandidates:entries.length,counts,limitations:[
 'Heuristic scanning only; router.use, mounted middleware arrays, and inherited guards may require manual review.',
 'Regex may miss dynamic route paths and router.route() chains.',
 'A DIRECT_PERMISSION match may be from another expression in the route window.',
 'This tool cannot prove permission order, record scope, RLS behavior, or runtime responses.',
 'Do not treat PUBLIC_CANDIDATE as verified public or GUARDED_NO_DIRECT_PERMISSION as a vulnerability.'
]};
if(process.argv.includes('--write-report')){
 const target=path.join(root,'phase6-1-rbac-audit-results');
 fs.mkdirSync(target,{recursive:true});
 fs.writeFileSync(path.join(target,'route-inventory.csv'),csv);
 fs.writeFileSync(path.join(target,'summary.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Reports written to phase6-1-rbac-audit-results/');
}
console.log(JSON.stringify(report,null,2));
console.log('\nReview candidates:');
for(const r of entries.filter(x=>x.category!=='DIRECT_PERMISSION'))
 console.log(`${r.category.padEnd(28)} ${r.file}:${r.line} ${r.method} ${r.endpoint}`);
