#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||process.cwd());
const check=process.argv.includes('--check');
const file=path.join(root,'admin/frontend/src/pages/maintenance/RBACPanel.jsx');
const marker='SMARTPDM_RBAC_COMPACT_UI_20261013_V1';
try {
 if(!fs.existsSync(file))throw Error('RBACPanel.jsx missing at '+file);
 let s=fs.readFileSync(file,'utf8');
 if(s.includes(marker)){ console.log('ALREADY APPLIED: compact RBAC UI');process.exit(0); }
 const changes=[];
 function swap(label,find,repl){const next=s.replace(find,repl);if(next===s){console.log('SKIPPED (different or already updated): '+label);return;}s=next;changes.push(label);}
 // Keep all existing React state, handlers, role assignments and grant logic intact.
 swap('intro', /<h2 className=\{MAINTENANCE_CARD_TITLE_CLASS\}>RBAC &amp; Account Management<\/h2><p className=\{MAINTENANCE_CARD_SUBTITLE_CLASS\}>[^<]*<\/p>/,
  '<div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4e9dc] text-[#704b35]"><ShieldCheck size={20}/></div><div><h2 className="text-base font-bold tracking-tight text-stone-900">Access Management</h2><p className="text-xs text-stone-500">Manage users and permissions across the five operational roles.</p></div></div>');
 swap('outer layout','return <div className="space-y-4">','return <div className="space-y-3">');
 swap('intro card', /<div className="rounded-2xl border border-stone-200 bg-white p-4">(?=\s*<div className="flex flex-wrap)/, '<div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">');
 swap('inner card','{tab===\'accounts\'?<AccountsPanel/>:<div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">','{tab===\'accounts\'?<AccountsPanel/>:<div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4 shadow-sm">');
 swap('section header',/<div className="flex items-center justify-between gap-2"><div><h3 className=\{MAINTENANCE_CARD_TITLE_CLASS\}>\{tabs.find\(x=>x\[0\]===tab\)\?\.\[1\]\}<\/h3><p className=\{MAINTENANCE_CARD_SUBTITLE_CLASS\}>Review user roles and their access permissions<\/p><\/div><button onClick=\{reload\} className="rounded-lg border border-stone-200 p-2" title="Refresh"><RefreshCw size=\{16\}\/><\/button><\/div>/,
 '<div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3"><div><h3 className="text-base font-bold text-stone-900">{tabs.find(x=>x[0]===tab)?.[1]}</h3><p className="mt-0.5 text-xs text-stone-500">{tab===\'permissions\'?\'Select a role and fine-tune its access.\':\'Review configured system roles.\'}</p></div><button type="button" onClick={reload} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50" title="Refresh data"><RefreshCw size={15}/> Refresh</button></div>');
 // For phase 1 controls, keep compatibility with five-role lock patch: don't restore create button.
 swap('permission role selector', /<select value=\{selected\?\.role_id\|\|''\} onChange=\{e=>setRole\(e.target.value\)\} className="max-w-md rounded-lg border p-2 text-sm">/,
 '<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[#fbf9f6] px-4 py-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Editing permissions for</p><p className="mt-0.5 text-sm text-stone-600">Choose one of the configured roles</p></div><select aria-label="Select role to manage permissions" value={selected?.role_id||\'\'} onChange={e=>setRole(e.target.value)} className="min-w-[190px] max-w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 shadow-sm focus:border-[#947158] focus:outline-none focus:ring-2 focus:ring-[#947158]/15">');
 swap('close role selector', '</option>)}</select>\n    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2">','</option>)}</select></div>\n    <details className="group rounded-xl border border-stone-200 bg-white open:bg-stone-50/40"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-stone-800 [&::-webkit-details-marker]:hidden"><span>Role assignment <span className="ml-1 text-xs font-normal text-stone-500">Grant or revoke a role for an existing user</span></span><span className="text-xs text-stone-400 group-open:rotate-180">⌄</span></summary><div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">');
 swap('role assignment closure', "    <p className=\"text-xs text-stone-500\">Operational user roles have configurable permissions. System Administrator permissions stay protected against lockout.</p>", '    <p className="text-xs text-stone-500">Administrator grants are protected against lockout. Changes are confirmed before saving.</p>');
 // First immediately preceding div closes the assignment wrapper. Replace its line ending.
 swap('role assignment detail close', /\{selectedUser\?<p className="text-xs text-stone-600">Current assignment:.*?<\/p>:null\}\n    <\/div>/,
 m=>m.replace(/<\/div>$/,'</div></details>'));
 swap('advanced access opening','<div className="rounded-lg border border-stone-200 p-3 space-y-2"><h4 className="font-semibold text-sm">Portal access (database-configured)</h4>',
 '<details className="group rounded-xl border border-stone-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-stone-800 [&::-webkit-details-marker]:hidden"><span>Advanced access <span className="ml-1 text-xs font-normal text-stone-500">Portal and role-group settings</span></span><span className="text-xs text-stone-400 group-open:rotate-180">⌄</span></summary><div className="space-y-3 border-t border-stone-100 px-4 py-4"><h4 className="font-semibold text-xs uppercase tracking-wide text-stone-600">Portal access</h4>');
 swap('advanced access closure',"{g.group_code.replaceAll('_',' ')}</label>)}</div></div>","{g.group_code.replaceAll('_',' ')}</label>)}</div></div></details>");
 swap('permissions toolbar', /<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-\[#704b35\]">Granted permissions are listed first and highlighted in brown\.<\/p><div className="relative min-w-56 flex-1 sm:max-w-xs">/,
 '<div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3"><div><p className="text-sm font-bold text-stone-900">Permission checklist <span className="ml-2 rounded-full bg-[#eee2d7] px-2.5 py-1 text-xs font-semibold text-[#704b35]">{grants.size} granted</span></p><p className="mt-1 text-xs text-stone-500">Granted items are shown first. Select a permission to change access.</p></div><div className="relative min-w-56 flex-1 sm:max-w-xs">');
 swap('permission card appearance', "'border-[#cfb19c] bg-[#f7f0e9]' : 'border-stone-200 bg-white'", "'border-[#d5bba7] bg-[#fbf6f1] shadow-sm' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'");
 swap('permission grid appearance','className="grid gap-2 sm:grid-cols-2">{sortedRolePermissions.length', 'className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sortedRolePermissions.length');
 s='// '+marker+'\n'+s;
 for(const [a,b] of [['permission role selector','close role selector'],['role assignment detail close','close role selector'],['advanced access opening','advanced access closure']]){if(changes.includes(a)!==changes.includes(b))throw Error('STOPPED: incompatible local markup for '+a+' / '+b+'; no files changed.')}
 if(changes.length===0)throw Error('No compatible UI changes found; no files changed.');
 if(check){console.log('CHECK PASSED: '+changes.length+' UI transformations applicable; no files changed.');process.exit(0)}
 const backup=file+'.pre-rbac-ui-'+Date.now()+'.bak';fs.copyFileSync(file,backup);fs.writeFileSync(file,s,'utf8');console.log('APPLIED '+changes.length+' UI improvements. Backup: '+backup);
} catch(e){console.error(e.message);process.exitCode=1}
