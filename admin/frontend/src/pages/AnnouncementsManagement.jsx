import React, { useState } from 'react';
// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// --- ICONS ---
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
};

// ─── Config ───────────────────────────────────────────────────
const STATUS = {
  Published: { bg: C.greenSoft, color: C.green },
  Draft: { bg: '#f4f4f5', color: '#71717a' },
  Scheduled: { bg: C.yellowSoft, color: C.amber },
};

const AUDIENCE_LABEL = {
  all: 'All Students',
  applicants: 'New Applicants',
  scholars: 'Current Scholars',
  tes: 'TES Recipients',
  tdp: 'TDP Recipients',
};

const INIT_ANNOUNCEMENTS = [
  { id: 1, title: 'TES Deadline Extended', content: 'The deadline for TES applications has been extended to March 15, 2026. Please ensure all documents are submitted before the new deadline.', status: 'Published', date: 'Oct 25, 2025', audience: 'New Applicants', views: 342 },
  { id: 2, title: 'New Scholarship: BC Packaging', content: 'We are pleased to announce a new scholarship opportunity from BC Packaging Corporation for Engineering students.', status: 'Draft', date: null, audience: 'All Students', views: 0 },
  { id: 3, title: 'Return of Obligations Reminder', content: 'All scholars are reminded to complete their return of obligations before the end of the semester.', status: 'Published', date: 'Oct 20, 2025', audience: 'Current Scholars', views: 589 },
  { id: 4, title: 'Scholarship Disbursement', content: 'The scholarship allowances for this semester will be released on March 15, 2026. Please ensure your bank details are updated.', status: 'Scheduled', date: 'Mar 01, 2026', audience: 'Current Scholars', views: 0 },
];

// ─── Sub-Components ───────────────────────────────────────────

function StatusPill({ status }) {
  const s = STATUS[status] || { bg: '#f4f4f5', color: '#71717a' };
  return (
    <Badge variant="outline" className="border-none px-2.5 py-1 font-bold text-[10px] uppercase tracking-wider"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: s.color }} />
      {status}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function AnnouncementsManagement() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [schedDate, setSchedDate] = useState('');
  const [items, setItems] = useState(INIT_ANNOUNCEMENTS);

  const handlePost = () => {
    setShowForm(false);
    setTitle(''); setContent(''); setAudience('all'); setSchedDate('');
  };

  const handleDelete = (id) => {
    setItems(prev => prev.filter(a => a.id !== id));
  };

  const handlePublish = (id) => {
    setItems(prev => prev.map(a => a.id === id ? {
      ...a,
      status: 'Published',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } : a));
  };

  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Announcements</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">Broadcast Portal · AY 2025–2026</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl shadow-lg text-white font-bold border-none"
          style={{ background: C.brownMid }}
        >
          <Plus className="w-4 h-4 mr-2" /> New Announcement
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: String(items.length), color: C.brownMid },
          { label: 'Published', value: String(items.filter(i => i.status === 'Published').length), color: C.green },
          { label: 'Drafts', value: String(items.filter(i => i.status === 'Draft').length), color: C.muted },
          { label: 'Total Views', value: '1,234', color: C.brownLight },
        ].map(s => (
          <Card key={s.label} className="border-stone-200 shadow-sm">
            <CardContent className="p-5">
              <p className="text-3xl font-bold tracking-tighter" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Composition Form */}
      {showForm && (
        <Card className="border-stone-200 shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 flex flex-row items-center justify-between py-4 px-6">
            <div>
              <CardTitle className="text-base font-bold text-stone-800">Compose Announcement</CardTitle>
            </div>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Heading Title</label>
                  <Input
                    placeholder="Enter subject line..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-11 rounded-xl bg-stone-50/50 border-stone-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Content Body</label>
                  <Textarea
                    placeholder="Write details here..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={6}
                    className="rounded-xl bg-stone-50/50 border-stone-200 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Target Audience</label>
                    <Select value={audience} onValueChange={setAudience}>
                      <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AUDIENCE_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Schedule (Optional)</label>
                    <Input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="h-11 rounded-xl bg-stone-50/50 border-stone-200" />
                  </div>
                </div>
              </div>

              {/* Real-time Preview Area */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 text-center block">Mobile Preview</label>
                <div className="bg-stone-100 rounded-3xl p-4 border-[6px] border-stone-800 shadow-2xl min-h-[350px] flex flex-col items-center">
                  <div className="w-16 h-1 bg-stone-800 rounded-full mb-4" />
                  <Card className="w-full border-none shadow-sm rounded-2xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      <h3 className="font-bold text-stone-900 leading-tight">{title || 'Subject Title'}</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase">
                        <Calendar size={12} /> Just now · <Users size={12} /> {AUDIENCE_LABEL[audience]}
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{content || 'Draft content will render here...'}</p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl font-bold px-6">Discard</Button>
              <Button onClick={handlePost} className="rounded-xl font-bold px-8 bg-stone-900 text-white hover:bg-stone-800 shadow-lg">
                <Send className="w-4 h-4 mr-2" /> Post Announcement
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Management List */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-sm font-bold text-stone-800">Archive & Active Posts</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {items.map((a) => (
            <div key={a.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-stone-50/50 transition-colors">
              <div className="flex gap-5 min-w-0">
                <div className="w-1 rounded-full shrink-0" style={{ background: STATUS[a.status]?.color || '#cbd5e1' }} />
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-stone-900 truncate">{a.title}</p>
                    <StatusPill status={a.status} />
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{a.content}</p>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {a.date || 'TBD'}</span>
                    <span className="flex items-center gap-1.5"><Users size={12} /> {a.audience}</span>
                    {a.status === 'Published' && <span className="flex items-center gap-1.5 text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded"><Eye size={12} /> {a.views}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold text-[10px] uppercase border-stone-200 text-stone-600"><Edit className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
                {a.status === 'Draft' && (
                  <Button onClick={() => handlePublish(a.id)} size="sm" className="h-9 rounded-lg font-bold text-[10px] uppercase bg-green-600 text-white hover:bg-green-700 border-none shadow-md">
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Publish
                  </Button>
                )}
                <Button onClick={() => handleDelete(a.id)} variant="outline" size="sm" className="h-9 rounded-lg border-red-100 text-red-500 hover:bg-red-50 p-2"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <footer className="pt-10 pb-6 border-t border-stone-100 text-center">
        <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">SMaRT PDM Broadcast Engine · Public Information Subsystem</p>
      </footer>
    </div>
  );
}