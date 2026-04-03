// 🔥 CLEAN VERSION — CONSISTENT WITH YOUR SYSTEM

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Plus } from 'lucide-react';

const C = {
  brownMid: '#7c4a2e',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  text: '#111827',
  muted: '#6B7280',
  bg: '#F9FAFB',
};

const PAGE_SIZE = 5;

export default function PayoutManagement() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 🔌 FETCH FROM BACKEND
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/payouts', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch payouts');

        const data = await res.json();
        setPayouts(data);
      } catch (err) {
        console.error('PAYOUT FETCH ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const pageData = useMemo(() => {
    return payouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [payouts, page]);

  const totalDisbursed = useMemo(() => {
    return payouts.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  }, [payouts]);

  const renderCard = (p) => {
    const received = p.scholars?.filter(s => s.received).length || 0;
    const total = p.scholars?.length || 0;

    return (
      <div
        key={p.id}
        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              {p.benefactor}
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              {p.id}
            </p>
          </div>

          <Badge
            className="text-[10px]"
            style={{
              background: p.pay_mode === 'cash' ? C.greenSoft : C.blueSoft,
              color: p.pay_mode === 'cash' ? C.green : C.blue,
            }}
          >
            {p.pay_mode}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-stone-500">{p.pay_date}</span>

          <span className={`font-semibold ${received === total ? 'text-green-600' : 'text-orange-600'
            }`}>
            {received}/{total} received
          </span>
        </div>

        <div className="mt-3 text-sm font-semibold">
          ₱{(p.total_amount || 0).toLocaleString()}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            View
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Payout Management</h1>
          <p className="text-sm text-stone-400">
            {payouts.length} records
          </p>
        </div>

        <Button
          size="sm"
          style={{ background: C.brownMid }}
          className="text-white rounded-lg"
        >
          <Plus className="w-3 h-3 mr-1" />
          Log Payout
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total Disbursed" value={`₱${(totalDisbursed / 1000).toFixed(0)}K`} />
        <Stat label="Payout Events" value={payouts.length} />
        <Stat label="Pending" value={payouts.filter(p => !p.acknowledged).length} />
        <Stat label="Benefactors" value="—" />
      </div>

      {/* LIST */}
      <Card className="border-stone-200">
        <CardContent className="p-4 space-y-3">
          {pageData.length === 0 ? (
            <p className="text-center text-sm text-stone-400">
              No payouts yet.
            </p>
          ) : (
            pageData.map(renderCard)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <Card className="border-stone-200 shadow-none">
      <CardContent className="p-4">
        <div className="text-xl font-semibold">{value}</div>
        <p className="text-xs text-stone-400 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}