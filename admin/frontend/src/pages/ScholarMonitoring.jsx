import React, { useState, useMemo, useEffect } from 'react'; // Added useEffect
import { useNavigate } from 'react-router';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, Users, CheckCircle2, Clock, Loader2
} from 'lucide-react';

const C = {
  brownMid: '#7c4a2e',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  amber: '#d97706',
  yellow: '#fbbf24',
  yellowSoft: '#fef3c7',
  text: '#3b1f0a',
  bg: '#faf7f2',
};

const RO_COLOR = { complete: C.green, progress: C.orange, behind: C.red };
const PAGE_SIZE = 10;

export default function ScholarMonitoring() {
  const navigate = useNavigate();

  // ─── STATE MANAGEMENT ───
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('All Statuses');
  const [page, setPage] = useState(1);

  // ─── DATABASE COMMUNICATION ───
  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);
        // Ensure this matches your Node.js route
        const response = await fetch('http://localhost:5000/api/scholars', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to synchronize with database');

        const data = await response.json();
        setScholars(data);
      } catch (err) {
        console.error("Database Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScholars();
  }, []);

  // ─── FILTER LOGIC ───
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scholars.filter(s => {
      const matchSearch = !q ||
        s.student_name?.toLowerCase().includes(q) ||
        s.student_number?.toLowerCase().includes(q); // Searching by student number instead of UUID
      const matchProgram = program === 'All Programs' || s.program_name === program;
      const matchStatus = status === 'All Statuses' || s.status === status;
      return matchSearch && matchProgram && matchStatus;
    });
  }, [scholars, search, program, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── LOADING & ERROR STATES ───
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      <p className="text-sm font-medium text-stone-500 uppercase tracking-widest">Accessing Registry...</p>
    </div>
  );

  if (error) return (
    <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-800 font-bold">Database Connection Failed</p>
      <p className="text-red-600 text-sm mt-1">{error}</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 border-red-200 text-red-600">Retry Connection</Button>
    </div>
  );

  return (
    <div className="space-y-8 py-2 px-1 animate-in fade-in duration-500" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>Scholars</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">
            {filtered.length} active records in registry
          </p>
        </div>
        <Button className="rounded-xl shadow-md text-white border-none" style={{ background: C.brownMid }}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats Grid - Using Real DB Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Scholars', value: scholars.length, icon: Users, accent: '#5c2d0e', soft: C.amberSoft },
          { label: 'Active Status', value: scholars.filter(s => s.status === 'Active').length, icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
          { label: 'At Risk (GWA)', value: scholars.filter(s => s.gwa >= 2.0).length, icon: AlertTriangle, accent: C.red, soft: C.redSoft },
          { label: 'Avg GWA', value: (scholars.reduce((acc, curr) => acc + (curr.gwa || 0), 0) / (scholars.length || 1)).toFixed(2), icon: Clock, accent: C.amber, soft: C.yellowSoft },
        ].map(s => (
          <Card key={s.label} className="border-stone-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: s.soft }}>
                <s.icon className="w-5 h-5" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tighter" style={{ color: C.text }}>{s.value}</div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <Card className="border-stone-200 shadow-sm overflow-visible">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
            <Input
              placeholder="Search by name or Student Number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-stone-50/50 rounded-xl border-stone-200 font-medium"
            />
          </div>
          {/* Program Select can now be populated from your programs table if you wish */}
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-stone-50/50 font-bold text-xs uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Programs" className="text-xs font-bold">All Programs</SelectItem>
              {/* Add dynamic programs here later */}
              <SelectItem value="BSIT" className="text-xs font-bold">BSIT</SelectItem>
              <SelectItem value="BSCS" className="text-xs font-bold">BSCS</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Main Registry Table */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="border-stone-100 hover:bg-transparent">
              <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 pl-6 text-stone-400">Scholar Profile</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center text-stone-400">Batch Year</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center text-stone-400">GWA</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center text-stone-400">Status</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-right pr-6 text-stone-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map(s => (
              <TableRow key={s.scholar_id} className="border-stone-100 hover:bg-amber-50/20 transition-colors">
                <TableCell className="py-5 pl-6">
                  {/* Concatenated name from SQL */}
                  <div className="font-bold text-stone-800 text-sm leading-tight">{s.student_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Using pdm_id mapped as student_number */}
                    <span className="text-[10px] font-mono text-stone-400 font-bold">{s.student_number}</span>
                    <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter border-stone-200 text-stone-500 bg-white">
                      {s.program_name}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <span className="text-xs font-bold text-stone-600 uppercase">{s.batch_year}</span>
                </TableCell>
                <TableCell className="py-5 text-center">
                  {/* Ensure GWA is treated as a number for the color logic */}
                  <span className="font-bold text-sm tabular-nums" style={{ color: Number(s.gwa) >= 2.0 ? C.red : C.green }}>
                    {Number(s.gwa).toFixed(2)}
                  </span>
                </TableCell>
                {/* ... rest of your cells */}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">Secure Database Connection Active</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-[10px] font-bold px-3 py-1 bg-white border border-stone-200 rounded-lg">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      <footer className="pt-10 pb-6 border-t border-stone-100">
        <p className="text-center text-[10px] font-bold text-stone-300 uppercase tracking-widest">SMaRT PDM Secure Registry · Scholar Monitoring Layer</p>
      </footer>
    </div>
  );
}
