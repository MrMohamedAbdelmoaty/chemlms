/**
 * Virtual lab simulations: acid–base titration with a live pH curve,
 * an interactive pH scale, and a reaction-rate explorer. Each simulation
 * emits a data table of its results.
 */
import { useMemo, useState } from 'react';
import { Badge, Card, Input } from '../../components/ui';

/* --------------------------------- titration -------------------------------- */
interface TitrationState { acid: 'HCl' | 'CH3COOH'; cA: number; vA: number; cB: number }

function titrationPoints(s: TitrationState, maxV: number, steps = 40) {
  const nA = s.cA * (s.vA / 1000);
  const Ka = 1.8e-5; // acetic acid
  const pKa = -Math.log10(Ka);
  const points: { v: number; pH: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = (maxV * i) / steps;
    const nB = s.cB * (v / 1000);
    const vTot = (s.vA + v) / 1000;
    let pH: number;
    if (s.acid === 'HCl') {
      if (nB < nA) pH = -Math.log10((nA - nB) / vTot);
      else if (nB > nA) pH = 14 + Math.log10((nB - nA) / vTot);
      else pH = 7;
    } else if (nB < nA) {
      const ratio = nB / Math.max(nA - nB, 1e-12);
      pH = pKa + Math.log10(ratio); // Henderson–Hasselbalch
    } else if (nB > nA) {
      pH = 14 + Math.log10((nB - nA) / vTot);
    } else {
      pH = 7 + 0.5 * pKa + 0.5 * Math.log10(nA / vTot); // salt of weak acid
    }
    points.push({ v, pH: Math.max(0, Math.min(14, pH)) });
  }
  return points;
}

function TitrationSim() {
  const [acid, setAcid] = useState<TitrationState['acid']>('HCl');
  const [cA, setCA] = useState('0.100');
  const [vA, setVA] = useState('25.0');
  const [cB, setCB] = useState('0.100');
  const [added, setAdded] = useState(0);

  const s: TitrationState = { acid, cA: parseFloat(cA) || 0.1, vA: parseFloat(vA) || 25, cB: parseFloat(cB) || 0.1 };
  const maxV = (s.cA * s.vA) / s.cB * 1.3; // ~130% of equivalence volume
  const curve = useMemo(() => titrationPoints(s, maxV, 60), [s, maxV]);
  const eqV = (s.cA * s.vA) / s.cB;
  const cur = curve.reduce((best, p) => (Math.abs(p.v - added) < Math.abs(best.v - added) ? p : best), curve[0]);
  const x = (v: number) => (v / maxV) * 100;
  const y = (pH: number) => 14 - pH; // invert

  const table = curve.filter((_, i) => i % 6 === 0 || Math.abs(cur.v - curve[i].v) < maxV / 120);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Acid
            <select value={acid} onChange={(e) => setAcid(e.target.value as TitrationState['acid'])}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
              <option value="HCl">HCl — strong acid</option>
              <option value="CH3COOH">CH₃COOH — weak acid</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Acid c (M)</span>
              <Input value={cA} onChange={(e) => setCA(e.target.value)} className="mt-1 font-mono" />
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Acid V (mL)</span>
              <Input value={vA} onChange={(e) => setVA(e.target.value)} className="mt-1 font-mono" />
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Base c (M)</span>
              <Input value={cB} onChange={(e) => setCB(e.target.value)} className="mt-1 font-mono" />
            </div>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Titrant added — NaOH: {added.toFixed(1)} mL
          </span>
          <input type="range" min={0} max={maxV} step={0.5} value={added} onChange={(e) => setAdded(parseFloat(e.target.value))}
            className="mt-2 w-full accent-brand-600" aria-label="Titrant volume" />
        </label>
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
          <div className="flex justify-between"><span className="text-slate-500">Equivalence volume</span><b>{eqV.toFixed(2)} mL</b></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">Current pH</span><b className="text-brand-600 dark:text-brand-300">{cur.pH.toFixed(2)}</b></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">Indicator</span>
            <Badge tone={acid === 'HCl' ? 'blue' : 'violet'}>{acid === 'HCl' ? 'Bromothymol blue (pH 6–7.6)' : 'Phenolphthalein (pH 8.2–10)'}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <svg viewBox="0 0 100 100" className="w-full" role="img" aria-label="Titration pH curve">
          {[0, 3.5, 7, 10.5, 14].map((v) => (
            <g key={v}>
              <line x1="6" y1={y(v)} x2="94" y2={y(v)} stroke="currentColor" strokeWidth="0.2" className="text-slate-200 dark:text-slate-700" />
              <text x="2" y={y(v) + 1.2} fontSize="2.6" fill="currentColor" className="text-slate-400">{v}</text>
            </g>
          ))}
          <line x1="6" y1="94" x2="6" y2="6" stroke="currentColor" strokeWidth="0.4" className="text-slate-300 dark:text-slate-600" />
          <line x1="6" y1="94" x2="94" y2="94" stroke="currentColor" strokeWidth="0.4" className="text-slate-300 dark:text-slate-600" />
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${6 + x(p.v) * 0.91} ${y(p.pH) * 0.88 + 6}`).join(' ')}
            fill="none" stroke="currentColor" strokeWidth="1.4" className="text-brand-500" />
          <line x1={6 + x(eqV) * 0.91} y1="6" x2={6 + x(eqV) * 0.91} y2="94" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1.5 1.5" className="text-emerald-500" />
          <circle cx={6 + x(cur.v) * 0.91} cy={y(cur.pH) * 0.88 + 6} r="1.4" fill="currentColor" className="text-rose-500" />
        </svg>
        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr><th className="px-2 py-1 text-left text-slate-500">V (mL)</th><th className="px-2 py-1 text-left text-slate-500">pH</th></tr></thead>
            <tbody>
              {table.map((p) => (
                <tr key={p.v.toFixed(1)} className="border-t border-slate-100 dark:border-slate-700/50">
                  <td className="px-2 py-1 font-mono text-slate-600 dark:text-slate-300">{p.v.toFixed(1)}</td>
                  <td className="px-2 py-1 font-mono text-slate-600 dark:text-slate-300">{p.pH.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- pH scale ------------------------------- */
function PhScale() {
  const [pH, setPH] = useState(7);
  const color = pH < 7 ? `rgb(${Math.round(248 - (7 - pH) * 8)}, ${Math.round(100 + (7 - pH) * 10)}, ${Math.round(120 - (7 - pH) * 6)})` :
    pH > 7 ? `rgb(${Math.round(80 - (pH - 7) * 8)}, ${Math.round(140 - (pH - 7) * 6)}, ${Math.round(220 - (pH - 7) * 5)})` : '#64748b';
  const examples = [
    { label: 'Gastric acid', pH: 1.5 }, { label: 'Lemon juice', pH: 2.2 }, { label: 'Vinegar', pH: 2.9 },
    { label: 'Tomato juice', pH: 4.4 }, { label: 'Black coffee', pH: 5.0 }, { label: 'Pure water', pH: 7 },
    { label: 'Sea water', pH: 8.1 }, { label: 'Baking soda', pH: 9 }, { label: 'Soap', pH: 10 },
    { label: 'Bleach', pH: 12.5 },
  ];
  return (
    <div className="space-y-4">
      <div>
        <input type="range" min={0} max={14} step={0.1} value={pH} onChange={(e) => setPH(parseFloat(e.target.value))}
          className="w-full accent-brand-600" aria-label="pH value" />
        <div className="mt-1 h-4 rounded-full" style={{ background: color }} />
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>0 (strong acid)</span><span>14 (strong base)</span>
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-900/40">
        <p className="text-xs text-slate-400">Current value</p>
        <p className="text-3xl font-bold" style={{ color }}>pH {pH.toFixed(1)}</p>
        <p className="text-sm capitalize">{pH < 7 ? 'acidic' : pH > 7 ? 'basic (alkaline)' : 'neutral'}</p>
        <p className="mt-1 font-mono text-xs text-slate-500">[H⁺] = {Math.pow(10, -pH).toExponential(2)} mol/L</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {examples.map((ex) => (
          <button key={ex.label} type="button" onClick={() => setPH(ex.pH)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
              Math.abs(ex.pH - pH) < 0.05 ? 'border-brand-500 bg-brand-50 font-semibold dark:bg-brand-900/40'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
            <span className="text-slate-600 dark:text-slate-300">{ex.label}</span>
            <span className="font-mono text-xs text-slate-400">pH {ex.pH}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- reaction rate ----------------------------- */
function RateSim() {
  const [T, setT] = useState(25);
  const [C, setC] = useState(0.5);
  const [cat, setCat] = useState(false);
  // Arrhenius-style approximation with a concentration dependence
  const k = 0.9 * Math.exp(-6200 / (8.314 * (T + 273.15))) * C * (cat ? 3 : 1);
  const rows = [0, 2, 5, 10, 20, 40, 60].map((t) => ({ t, C: +(C * Math.exp(-k * t * 60)).toFixed(3), rate: +(k * C * Math.exp(-k * t * 60)).toFixed(4) }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Temperature: {T} °C ({T + 273.15} K)</span>
          <input type="range" min={20} max={80} value={T} onChange={(e) => setT(parseInt(e.target.value, 10))} className="mt-2 w-full accent-brand-600" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Concentration: {C.toFixed(2)} mol/L</span>
          <input type="range" min={0.1} max={2} step={0.1} value={C} onChange={(e) => setC(parseFloat(e.target.value))} className="mt-2 w-full accent-brand-600" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={cat} onChange={(e) => setCat(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Catalyst present (lowers Eₐ)
        </label>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
          <p className="text-xs text-slate-400">Relative rate constant</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-300">{k.toFixed(4)} s⁻¹</p>
          <p className="mt-1 text-xs text-slate-500">Roughly {cat ? '3×' : '1×'} faster than uncatalysed at this temperature.</p>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-3 py-2 text-left text-slate-500">t (s)</th><th className="px-3 py-2 text-left text-slate-500">[A] (mol/L)</th><th className="px-3 py-2 text-left text-slate-500">Rate</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t} className="border-t border-slate-100 dark:border-slate-700/50">
                <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.t}</td>
                <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.C}</td>
                <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VirtualLab() {
  const [tab, setTab] = useState<'titration' | 'ph' | 'rate'>('titration');
  return (
    <Card title="Virtual Lab Simulations" subtitle="Titration, pH scale and reaction rate — interactive, with data tables.">
      <div className="mb-4 flex flex-wrap gap-2">
        {([['titration', 'Titration'], ['ph', 'pH scale'], ['rate', 'Reaction rate']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'titration' && <TitrationSim />}
      {tab === 'ph' && <PhScale />}
      {tab === 'rate' && <RateSim />}
    </Card>
  );
}
