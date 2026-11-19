/**
 * Lightweight dependency-free SVG charts (bar, line/trend, ring) so the app
 * renders fully offline in the preview sandbox.
 */
import { cn } from './ui';

export function BarChart({ data, height = 160, color = '#6366f1' }: {
  data: { label: string; value: number }[]; height?: number; color?: string;
}) {
  const max = Math.max(100, ...data.map((d) => d.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex w-full flex-1 flex-col items-center justify-end gap-2">
            <div className="relative w-full flex-1 flex items-end">
              <div title={`${d.value}`} className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, minHeight: 3 }} />
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ values, height = 140, color = '#10b981' }: { values: number[]; height?: number; color?: string }) {
  const w = 320;
  const h = height;
  const max = 100;
  const min = Math.max(0, Math.min(...values) - 5);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 40) + 20;
    const y = h - 10 - ((v - min) / (max - min)) * (h - 30);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},${h - 10} L${pts[0][0]},${h - 10} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Trend chart">
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color} />
      ))}
    </svg>
  );
}

export function Ring({ value, size = 120, label, color = '#6366f1' }: {
  value: number; size?: number; label?: string; color?: string;
}) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={10}
          className="text-slate-200 dark:text-slate-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <span className="absolute text-center text-lg font-bold text-slate-800 dark:text-slate-100">{label ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

/** Horizontal heat bars for LO mastery. */
export function MasteryBar({ value, label }: { value: number; label: string }) {
  const tone = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#f43f5e';
  return (
    <div className={cn('flex items-center gap-3')}>
      <span className="w-60 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" title={label}>{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: tone }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">{value}%</span>
    </div>
  );
}
