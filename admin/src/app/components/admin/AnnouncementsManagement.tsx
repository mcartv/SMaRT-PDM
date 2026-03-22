import { useState } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Edit, Trash2, Send, Eye, Calendar, Users, X } from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellowSoft: '#fef3c7',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
};

// ─── Status config ────────────────────────────────────────────
const STATUS: Record<string, { bg: string; color: string; dot: string }> = {
  Published: { bg: C.greenSoft, color: C.green, dot: C.green },
  Draft: { bg: C.sand, color: C.muted, dot: C.muted },
  Scheduled: { bg: C.yellowSoft, color: C.amber, dot: C.amber },
};

// ─── Audience map ─────────────────────────────────────────────
const AUDIENCE_LABEL: Record<string, string> = {
  all: 'All Students',
  applicants: 'New Applicants',
  scholars: 'Current Scholars',
  tes: 'TES Recipients',
  tdp: 'TDP Recipients',
};

// ─── Data ────────────────────────────────────────────────────
const INIT_ANNOUNCEMENTS = [
  { id: 1, title: 'TES Deadline Extended', content: 'The deadline for TES applications has been extended to March 15, 2026. Please ensure all documents are submitted before the new deadline.', status: 'Published', date: 'Oct 25, 2025', audience: 'New Applicants', views: 342 },
  { id: 2, title: 'New Scholarship: BC Packaging', content: 'We are pleased to announce a new scholarship opportunity from BC Packaging Corporation for Engineering students.', status: 'Draft', date: null, audience: 'All Students', views: 0 },
  { id: 3, title: 'Return of Obligations Reminder', content: 'All scholars are reminded to complete their return of obligations before the end of the semester.', status: 'Published', date: 'Oct 20, 2025', audience: 'Current Scholars', views: 589 },
  { id: 4, title: 'Scholarship Disbursement', content: 'The scholarship allowances for this semester will be released on March 15, 2026. Please ensure your bank details are updated.', status: 'Scheduled', date: 'Mar 01, 2026', audience: 'Current Scholars', views: 0 },
];

const STATS = [
  { label: 'Total', value: '8', color: C.brown },
  { label: 'Published', value: '5', color: C.green },
  { label: 'Drafts', value: '2', color: C.muted },
  { label: 'Views', value: '1,234', color: C.brownLight },
];

// ─── Small helpers ────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { bg: C.sand, color: C.muted, dot: C.muted };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

function MetaItem({ icon: Icon, text }: { icon: React.FC<any>; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function AnnouncementsManagement() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [schedDate, setSchedDate] = useState('');
  const [items, setItems] = useState(INIT_ANNOUNCEMENTS);

  function handlePost() {
    setShowForm(false);
    setTitle(''); setContent(''); setAudience('all'); setSchedDate('');
  }

  function handleDelete(id: number) {
    setItems(prev => prev.filter(a => a.id !== id));
  }

  function handlePublish(id: number) {
    setItems(prev => prev.map(a => a.id === id ? { ...a, status: 'Published', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : a));
  }

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Announcements</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>Create and manage student announcements</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition-opacity"
          style={{ background: C.brown }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus className="w-3.5 h-3.5" />
          New Announcement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} style={CARD} className="p-5">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...CARD, border: BD }}>
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: BD, background: C.yellowSoft }}>
            <h2 className="text-sm font-bold" style={{ color: C.text }}>New Announcement</h2>
            <button onClick={() => setShowForm(false)} style={{ color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Editor */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
                    Title
                  </label>
                  <Input
                    placeholder="Announcement title…"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
                    Content
                  </label>
                  <Textarea
                    placeholder="Write your announcement…"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={8}
                    className="resize-none text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
                    Target Audience
                  </label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUDIENCE_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
                    Schedule Date <span className="normal-case font-normal">(optional — leave empty to post now)</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                    className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
                  Preview
                </label>
                <div className="rounded-xl p-4 min-h-[320px]" style={{ background: C.bg, border: BD }}>
                  <div style={CARD} className="p-5">
                    <h3 className="text-base font-bold mb-2" style={{ color: title ? C.text : C.muted }}>
                      {title || 'Announcement Title'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs mb-3" style={{ color: C.muted }}>
                      <MetaItem icon={Calendar} text={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                      <span>·</span>
                      <MetaItem icon={Users} text={AUDIENCE_LABEL[audience] ?? 'All Students'} />
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: content ? C.text : C.muted }}>
                      {content || 'Your announcement content will appear here…'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-5 pt-5" style={{ borderTop: BD }}>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 h-9 rounded-xl text-xs font-semibold border transition-colors"
                style={{ borderColor: C.border, color: C.muted, background: C.white }}
                onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
                onMouseLeave={e => (e.currentTarget.style.background = C.white)}
              >
                Cancel
              </button>
              <button
                className="px-4 h-9 rounded-xl text-xs font-semibold border transition-colors"
                style={{ borderColor: C.border, color: C.brownLight, background: C.white }}
                onMouseEnter={e => (e.currentTarget.style.background = C.amberSoft)}
                onMouseLeave={e => (e.currentTarget.style.background = C.white)}
              >
                Save as Draft
              </button>
              <button
                onClick={handlePost}
                className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition-opacity"
                style={{ background: C.brown }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Send className="w-3.5 h-3.5" />
                Post Announcement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements list */}
      <div style={CARD} className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: BD }}>
          <h2 className="text-sm font-bold" style={{ color: C.text }}>All Announcements</h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>{items.length} total</p>
        </div>

        <div className="divide-y" style={{ borderColor: C.border }}>
          {items.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-4 px-5 py-4 transition-colors"
              style={{ background: C.white }}
              onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}
            >
              {/* Status stripe */}
              <div
                className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                style={{ background: STATUS[a.status]?.dot ?? C.muted, minHeight: 40 }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-sm font-bold" style={{ color: C.text }}>{a.title}</p>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: C.muted }}>
                  {a.content}
                </p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: C.muted }}>
                  <MetaItem icon={Calendar} text={
                    a.status === 'Published' ? 'Published ' + (a.date ?? '') :
                      a.status === 'Scheduled' ? 'Scheduled for ' + (a.date ?? '') :
                        'Not published'
                  } />
                  <span>·</span>
                  <MetaItem icon={Users} text={a.audience} />
                  {a.status === 'Published' && (
                    <>
                      <span>·</span>
                      <MetaItem icon={Eye} text={a.views + ' views'} />
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                  style={{ borderColor: C.border, color: C.muted, background: C.white }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                {a.status === 'Draft' && (
                  <button
                    onClick={() => handlePublish(a.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    style={{ borderColor: '#bbf7d0', color: C.green, background: C.greenSoft }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.96)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    <Send className="w-3.5 h-3.5" /> Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(a.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                  style={{ borderColor: '#fecaca', color: C.red, background: C.redSoft }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.96)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}