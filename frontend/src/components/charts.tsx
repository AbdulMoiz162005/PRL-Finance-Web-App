import React, { useEffect, useState } from 'react';

export interface ChartTheme {
  dark: boolean;
  grid: string;
  tick: string;
  axisLine: string;
  cursor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
}

export const useChartTheme = (): ChartTheme => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return {
    dark,
    grid: dark ? '#1e293b' : '#e2e8f0',
    tick: dark ? '#94a3b8' : '#64748b',
    axisLine: dark ? '#334155' : '#cbd5e1',
    cursor: dark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    tooltipText: dark ? '#e2e8f0' : '#0f172a',
    tooltipMuted: dark ? '#94a3b8' : '#64748b',
  };
};

export const ChartTip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: any;
  fmt?: (v: any) => string;
  labelFmt?: (l: any) => string;
}> = ({ active, payload, label, fmt, labelFmt }) => {
  const t = useChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg ring-1"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder, color: t.tooltipText }}
    >
      {label !== undefined && label !== '' && (
        <p className="mb-1.5 font-bold">{labelFmt ? labelFmt(label) : String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((p: any) => (
          <p key={`${p.dataKey}-${p.name}`} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span style={{ color: t.tooltipMuted }}>{p.name}:</span>
            <span className="font-bold tabular-nums">{fmt ? fmt(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

export const BarGradient: React.FC<{ id: string; from: string; to: string }> = ({ id, from, to }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={from} stopOpacity={0.95} />
    <stop offset="100%" stopColor={to} stopOpacity={0.45} />
  </linearGradient>
);

export const AreaGradient: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
  </linearGradient>
);

export const PIE_COLORS = ['#0b74b8', '#0b6b2d', '#c9a227', '#d71920', '#6d28d9', '#0e7490', '#be123c', '#1d4ed8'];
