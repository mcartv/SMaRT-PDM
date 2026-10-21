'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || process.cwd());
const check = process.argv.includes('--check') || !process.argv.includes('--apply');
const report = process.argv.includes('--report');
const rel='admin/frontend/src/pages/maintenance/RBACPanel.jsx';
const file=path.join(root,rel);
const marker='SMARTPDM_CONSOLIDATED_ROLE_ACCESS_V4';
function fail(message){console.error('STOPPED: '+message+'; no files changed.');process.exit(1);}
if(!fs.existsSync(file))fail('RBACPanel.jsx was not found');
const original=fs.readFileSync(file,'utf8');
if(original.includes(marker)){
 console.log('ALREADY APPLIED: consolidated Roles and advanced access panel detected. No files changed.');
 process.exit(0);
}
let src=original;
// This is the precise old branch from the project; never silently patch an unknown layout.
const oldTabs="const tabs=[['accounts','User Accounts'],['roles','Roles'],['permissions','Role Permissions']];";
if(!src.includes(oldTabs)){
 if(src.includes("['accounts','User Accounts']") && !src.includes("['permissions','Role Permissions']")) {
  console.log('ALREADY REMOVED: separate permissions tab is not present. No files changed.');
  process.exit(0);
 }
 fail('Unknown Access Management tab declaration; provide the current RBACPanel.jsx');
}
const begin="</>:tab==='permissions'?<>";
const end="</>:null}";
const start=src.indexOf(begin);
const stop=src.lastIndexOf(end);
if(start<0 || stop<=start || src.indexOf(begin,start+begin.length)!==-1)fail('Cannot safely isolate the old permissions tab (layout changed)');
const legacy=src.slice(start+begin.length,stop);
const checklist=legacy.indexOf('<div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">');
if(checklist<0 || !legacy.includes('Assign role to a user') || !legacy.includes('Portal access'))fail('Legacy access controls not recognized; refusing to drop capabilities');
// Preserve the role assignment/portal/group controls. Permission checkboxes now live in Add/Edit Role.
const advanced=legacy.slice(0,checklist).trim();
const widget=`\n{/* ${marker}: permissions are edited in Add/Edit Role; supplemental access remains reachable. */}\n<details className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4"><summary className="cursor-pointer text-sm font-semibold text-stone-800">Advanced access — user role assignments and portal access</summary><div className="mt-4 space-y-3">${advanced}</div></details>\n`;
src=src.replace(oldTabs,"const tabs=[['accounts','User Accounts'],['roles','Roles']];");
src=src.replace("return ['roles','permissions'].includes(section) ? section : 'accounts';", "return section === 'roles' ? 'roles' : 'accounts';");
// If previous V3 generated a dedicated component, add advanced controls alongside that component.
const v3="tab==='roles'?<RoleCrudPanel/>:";
if(src.includes(v3)){
 src=src.replace(v3,"tab==='roles'?<div className=\"space-y-4\"><RoleCrudPanel/>"+widget+"</div>:");
 // Remove now-unreachable duplicated legacy roles + permissions tabs while keeping the other state intact.
 const newStart=src.indexOf(begin),newStop=src.lastIndexOf(end);
 if(newStart<0||newStop<=newStart)fail('Cannot re-identify legacy permissions view');
 src=src.slice(0,newStart)+end+src.slice(newStop+end.length);
}else{
 // Existing inline Roles view: append advanced controls at its closing fragment.
 const newStart=src.indexOf(begin),newStop=src.lastIndexOf(end);
 if(newStart<0||newStop<=newStart)fail('Cannot re-identify legacy permissions view');
 src=src.slice(0,newStart)+widget+end+src.slice(newStop+end.length);
}
// Do not leave an obsolete permission tab navigation route.
src=src.replace("tab==='permissions'?'Select a role and fine-tune its access.':'Review configured system roles.'", "'Review roles and configure their permissions through Add or Edit.'");
// Verify syntax with typescript parser installed under project or global Node runtime, if available.
let ts;
for(const probe of [path.join(root,'admin/frontend/node_modules/typescript'),'/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript']){
 try{ts=require(probe);break;}catch(_e){}
}
if(ts){
 const syntax=ts.createSourceFile('RBACPanel.jsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
 if(syntax.parseDiagnostics.length){
  const d=syntax.parseDiagnostics[0];const line=syntax.getLineAndCharacterOfPosition(d.start||0);
  fail('Generated JSX did not pass parser at '+(line.line+1)+':'+(line.character+1)+' '+ts.flattenDiagnosticMessageText(d.messageText,' '));
 }
}else if(report)console.log('Note: TypeScript parser not found; run npm run build after applying.');
if(report){console.log('FILE: '+rel);console.log('CHANGE: remove Role Permissions navigation tab');console.log('CHANGE: expose supplemental assignments and portal/group settings under Roles > Advanced access');console.log('CHANGE: keep permission selection in Role Add/Edit modal');}
if(check){console.log('CHECK COMPLETE: 1 file would change; no files written.');process.exit(0);}
const backup=file+'.backup-access-tabs-v4';
if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
fs.writeFileSync(file,src,'utf8');
console.log('APPLY COMPLETE: 1 file updated; backup: '+path.basename(backup));
console.log('NEXT: cd admin/frontend && npm run build');
