import React from 'react';
import { Card } from '@/components/ui/card';
import { Activity, Globe2, UsersRound } from 'lucide-react';

const DEFAULT_ACTIVITY = {
    api_requests_24h: 0,
    active_sessions: 0,
    web_visitors_24h: 0,
    active_window_minutes: 10,
};

function formatMetric(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return new Intl.NumberFormat('en-US').format(Math.max(0, number));
}

export default function SystemActivityPanel({
    activity = DEFAULT_ACTIVITY,
    loading = false,
    available = true,
}) {
    const metrics = [
        {
            key: 'traffic',
            icon: Activity,
            iconWrap: 'bg-blue-50',
            iconColor: 'text-blue-600',
            label: 'Total System Traffic',
            value: loading ? 'Loading...' : formatMetric(activity.api_requests_24h),
            description: 'Authenticated API requests · last 24 hours',
        },
        {
            key: 'sessions',
            icon: UsersRound,
            iconWrap: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            label: 'Active Sessions',
            value: loading ? 'Loading...' : `${formatMetric(activity.active_sessions)} Online`,
            description: `Active within the last ${activity.active_window_minutes || 10} minutes`,
            statusDot: true,
        },
        {
            key: 'visitors',
            icon: Globe2,
            iconWrap: 'bg-violet-50',
            iconColor: 'text-violet-600',
            label: 'Web Visitors',
            value: loading ? 'Loading...' : formatMetric(activity.web_visitors_24h),
            description: 'Unique public-web browsers · last 24 hours',
        },
    ];

    return (
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-3">
            {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                    <Card
                        key={metric.key}
                        className="flex min-h-28 min-w-0 flex-row items-center gap-3 border-stone-200 px-5 py-4 text-left shadow-none"
                    >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.iconWrap}`}>
                            <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-stone-500">{metric.label}</p>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                                {metric.statusDot ? (
                                    <span
                                        className={`h-2 w-2 shrink-0 rounded-full ${available ? 'bg-emerald-500' : 'bg-stone-400'}`}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <p className="truncate text-base font-semibold leading-tight tabular-nums text-stone-900">
                                    {metric.value}
                                </p>
                            </div>
                            <p className="mt-1 break-words text-xs font-medium text-stone-500">
                                {metric.description}
                            </p>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
