// PHASE6C_WORKSPACE_REGISTRY_V1
// Single source of truth for custom-role workspace presentation.
// This registry NEVER authorizes API access. The backend remains authoritative.
import {
  Activity, Bell, BookOpen, BriefcaseBusiness, ClipboardList, FileCheck2,
  FileText, GraduationCap, Settings, ShieldCheck, Users, Wallet,
} from 'lucide-react';

export const WORKSPACE_MODULES = Object.freeze({
  accounts: {label:'User Accounts', detail:'Manage authorized account records and assignments', icon:Users, availability:'office_scope_required', viewPermission:'accounts.view'},
  applications: {label:'Applications', detail:'Review scholarship applications within granted access', icon:ClipboardList, availability:'office_scope_required', viewPermission:'applications.view'},
  reports: {label:'Reports', detail:'Review the reports permitted for your role', icon:FileText, availability:'read_only_preview', viewPermission:'reports.view'},
  endorsements: {label:'Endorsements', detail:'Review authorized endorsement workflows', icon:FileCheck2, availability:'pending_integration'},
  students: {label:'Students', detail:'Access permitted student records', icon:GraduationCap, availability:'pending_integration'},
  programs: {label:'Scholarship Programs', detail:'Work with authorized scholarship programs', icon:BookOpen, availability:'pending_integration'},
  documents: {label:'Documents', detail:'Review permitted supporting documents', icon:FileCheck2, availability:'pending_integration'},
  payouts: {label:'Payouts', detail:'Review permitted payout actions and records', icon:Wallet, availability:'office_scope_required', viewPermission:'payouts.view'},
  ro: {label:'Community Service', detail:'Access authorized community-service operations', icon:BriefcaseBusiness, availability:'pending_integration'},
  announcements: {label:'Announcements', detail:'Access permitted announcements', icon:Bell, availability:'pending_integration'},
  settings: {label:'Settings', detail:'View authorized settings', icon:Settings, availability:'pending_integration'},
  courses: {label:'Courses', detail:'Access permitted courses and departments', icon:BookOpen, availability:'pending_integration'},
  discipline: {label:'Discipline Records', detail:'Review disciplinary information within your scope', icon:ShieldCheck, availability:'pending_integration'},
  audit: {label:'System Logs', detail:'View authorized audit information', icon:Activity, availability:'pending_integration'},
});

// Preserve existing behavior: a granted module action creates a navigation card.
// A view grant alone does not enable blocked data endpoints or new actions.
export function getWorkspaceModules(permissions = []) {
  const grouped = new Map();
  if (!Array.isArray(permissions)) return [];
  for (const value of permissions) {
    const permission = String(value || '');
    const dot = permission.indexOf('.');
    if (dot <= 0 || dot === permission.length - 1) continue;
    const key=permission.slice(0,dot), action=permission.slice(dot+1);
    if (!Object.prototype.hasOwnProperty.call(WORKSPACE_MODULES,key)) continue;
    if (!grouped.has(key)) grouped.set(key,{key,...WORKSPACE_MODULES[key],actions:[]});
    grouped.get(key).actions.push(action);
  }
  return [...grouped.values()].map(module=>({...module,actions:[...new Set(module.actions)]}));
}
