/**
 * Interactive periodic table: category coloring, filters, trend heat-maps
 * (electronegativity / atomic mass / atomic radius), search, and a details
 * modal with electron configuration and properties.
 */
import { useMemo, useState } from 'react';
import { ELEMENTS, CATEGORY_META, electronConfiguration, type ChemElement, type ElementCategory } from '../../data/elements';
import { Badge, Card, cn, Input, Modal, Select } from '../../components/ui';
import { KaTeX } from './KaTeXText';

/** Map atomic number -> [row, col] in the 18-column standard IUPAC layout. */
function position(z: number): [number, number] {
  const isLanthanide = z >= 57 && z <= 71;
  const isActinide = z >= 89 && z <= 118;
  if (isLanthanide) return [9, 3 + (z - 57)];
  if (isActinide) return [10, 3 + (z - 89)];
  if (z === 1) return [1, 1];
  if (z === 2) return [1, 18];
  if (z <= 10) return [2, z <= 4 ? z - 2 : z + 8];   // period 2
  if (z <= 18) return [3, z - 10];                    // period 3
  if (z <= 36) return [4, z - 18];                    // period 4
  if (z <= 54) return [5, z - 36];                    // period 5
  if (z <= 56) return [6, z - 54];                    // Cs, Ba
  if (z <= 86) return [6, z - 68];                    // period 6 main block (Hf–Rn)
  if (z <= 88) return [7, z - 86];                    // Fr, Ra
  return [7, z - 100];                                // period 7 main block (Rf–Og)
}

type Trend = 'none' | 'en' | 'mass' | 'radius';

function interp(v: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
  // cool -> warm heat scale
  const r = Math.round(45 + t * 190);
  const g = Math.round(120 - t * 60);
  const b = Math.round(220 - t * 170);
  return `rgb(${r},${g},${b})`;
}

export function PeriodicTable({ onUseElement }: { onUseElement?: (symbol: string) => void }) {
  const [filter, setFilter] = useState<ElementCategory | 'all'>('all');
  const [trend, setTrend] = useState<Trend>('none');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ChemElement | null>(null);

  const trendRange = useMemo(() => {
    if (trend === 'en') { const vals = ELEMENTS.filter((e) => e.electronegativity > 0).map((e) => e.electronegativity); return [Math.min(...vals), Math.max(...vals)]; }
    if (trend === 'mass') { const vals = ELEMENTS.map((e) => e.mass); return [Math.min(...vals), Math.max(...vals)]; }
    if (trend === 'radius') { const vals = ELEMENTS.map((e) => e.radiusPm); return [Math.min(...vals), Math.max(...vals)]; }
    return [0, 1];
  }, [trend]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ELEMENTS.filter((e) => {
      if (filter !== 'all' && e.category !== filter) return false;
      if (!q) return true;
      return e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || String(e.z) === q;
    });
  }, [filter, query]);

  const cellColor = (e: ChemElement) => {
    if (trend !== 'none') {
      const v = trend === 'en' ? e.electronegativity : trend === 'mass' ? e.mass : e.radiusPm;
      return interp(v, trendRange[0], trendRange[1]);
    }
    return null;
  };

  const grid = useMemo(() => {
    const map = new Map<number, ChemElement>();
    ELEMENTS.forEach((e) => map.set(e.z, e));
    const rows: (ChemElement | null)[][] = Array.from({ length: 10 }, () => Array(18).fill(null));
    for (const e of ELEMENTS) {
      const [r, c] = position(e.z);
      rows[r - 1][c - 1] = e;
    }
    return rows;
  }, []);

  return (
    <Card title="Interactive Periodic Table" subtitle="Click an element for properties, electron configuration and trends."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search (name, symbol, Z)" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-48" />
          <Select value={trend} onChange={(e) => setTrend(e.target.value as Trend)} className="h-9 w-40">
            <option value="none">Color: category</option>
            <option value="en">Trend: electronegativity</option>
            <option value="mass">Trend: atomic mass</option>
            <option value="radius">Trend: atomic radius</option>
          </Select>
        </div>
      }
    >
      {trend !== 'none' && (
        <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
          <span>Low</span>
          <div className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${interp(trendRange[0], trendRange[0], trendRange[1])}, ${interp(trendRange[1], trendRange[0], trendRange[1])})` }} />
          <span>High</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse [&_td]:p-[2px] [&_th]:p-[2px]">
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                {ri === 7 && <td colSpan={2} className="text-center text-xs font-semibold text-slate-400">57–71</td>}
                {ri === 8 && <td colSpan={2} className="text-center text-xs font-semibold text-slate-400">89–118</td>}
                {row.map((el, ci) => (
                  <td key={ci} className="text-center">
                    {el && (visible.includes(el) ? (
                      <button
                        type="button" onClick={() => setSelected(el)}
                        aria-label={`${el.name}, atomic number ${el.z}`}
                        className="group flex h-8 w-8 min-w-8 flex-col items-center justify-center rounded-md text-[10px] font-bold text-slate-900 ring-1 ring-black/10 transition-transform hover:scale-110 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        style={{ background: cellColor(el) ?? CATEGORY_META[el.category].color.replace(/dark:\S+/g, '').trim() }}
                      >
                        <span className="leading-none">{el.symbol}</span>
                        <span className="leading-none text-[7px] font-normal opacity-80">{el.z}</span>
                      </button>
                    ) : (
                      <span className="flex h-8 w-8 min-w-8 items-center justify-center text-[7px] text-slate-300">·</span>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {(['all', 'alkali-metal', 'alkaline-earth', 'transition-metal', 'post-transition', 'metalloid', 'nonmetal', 'halogen', 'noble-gas', 'lanthanide', 'actinide'] as const).map((c) => (
          <button key={c} type="button" onClick={() => setFilter(c)}
            className={cn('rounded-full border px-3 py-1 text-xs transition-colors',
              filter === c ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                : 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800')}>
            {c === 'all' ? 'All elements' : CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.symbol} — ${selected.name}` : ''} wide>
        {selected && <ElementDetails el={selected} onUse={() => { onUseElement?.(selected.symbol); setSelected(null); }} />}
      </Modal>
    </Card>
  );
}

function ElementDetails({ el, onUse }: { el: ChemElement; onUse: () => void }) {
  const config = electronConfiguration(el.z);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white"
          style={{ background: CATEGORY_META[el.category].color.replace('dark:bg-', 'bg-') }}>
          {el.symbol}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{el.name}</p>
          <p className="text-sm text-slate-500">Atomic number {el.z} · {el.phase} at room temperature</p>
          <Badge tone="slate" className="mt-1">{CATEGORY_META[el.category].label}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ['Atomic mass', `${el.mass} u`],
          ['Block', el.block.toUpperCase()],
          ['Electronegativity', el.electronegativity > 0 ? String(el.electronegativity) : '—'],
          ['Covalent radius', `${el.radiusPm} pm`],
          ['Phase (STP)', el.phase],
          ['Group period', `${Math.abs(position(el.z)[1] - 1)}, ${position(el.z)[0]}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
            <p className="text-xs text-slate-400">{k}</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
        <p className="text-xs text-slate-400">Electron configuration</p>
        <p className="font-mono text-sm text-slate-800 dark:text-slate-100">{config}</p>
        <p className="mt-1 text-xs text-slate-400">As \ce{} notation:</p>
        <KaTeX tex={`\\ce{${el.symbol}}}`} />
      </div>
      {onUse && (
        <button type="button" onClick={onUse} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
          → Use {el.symbol} in the equation balancer
        </button>
      )}
    </div>
  );
}
