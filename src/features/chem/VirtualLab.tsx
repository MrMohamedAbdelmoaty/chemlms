/**
 * Virtual Lab — a complete interactive chemistry lab.
 *
 * Six live simulations (titration, pH scale, reaction rate, gas laws,
 * stoichiometry/limiting reagent, molarity & dilution) plus a lab-experiments
 * hub that lists each experiment with its objective, procedure, safety notes
 * and a suggested lab-report assignment. Each experiment links to its
 * interactive simulation.
 */
import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Modal } from '../../components/ui';
import { LAB_EXPERIMENTS, type LabExperiment } from '../../data/labExperiments';
import { assessmentApi } from '../../services/api';

type Sim = 'titration' | 'ph' | 'rate' | 'gas' | 'stoich' | 'molarity';

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

/* --------------------------------- gas laws ------------------------------- */
function GasLawsSim() {
  const [mode, setMode] = useState<'boyle' | 'charles' | 'combined'>('boyle');
  const [n, setN] = useState(1); // moles
  const R = 8.314;
  // Boyle: P*V = const at fixed T. Charles: V/T = const at fixed P. Combined: P*V/T = const.
  const [v, setV] = useState(24.6); // L
  const [t, setT] = useState(298); // K
  const [p, setP] = useState(101.3); // kPa

  let result = '';
  let formula = '';
  if (mode === 'boyle') {
    const k = p * v; // P*V constant
    result = `P × V = ${k.toFixed(1)} kPa·L (constant). Halving the volume doubles the pressure.`;
    formula = 'P₁V₁ = P₂V₂';
  } else if (mode === 'charles') {
    const k = v / t; // V/T constant
    result = `V / T = ${k.toFixed(4)} L/K (constant). Doubling the absolute temperature doubles the volume.`;
    formula = 'V₁/T₁ = V₂/T₂';
  } else {
    const k = (p * v) / t; // P*V/T constant
    const p2 = (k * t) / v;
    result = `P·V/T = ${k.toFixed(2)} kPa·L/K. At the new state the predicted pressure is ${p2.toFixed(1)} kPa.`;
    formula = 'P₁V₁/T₁ = P₂V₂/T₂';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([['boyle', 'Boyle’s law (P·V)'], ['charles', 'Charles’s law (V/T)'], ['combined', 'Combined gas law']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMode(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${mode === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Volume (L): {v.toFixed(1)}</span>
          <input type="range" min={1} max={50} step={0.5} value={v} onChange={(e) => setV(parseFloat(e.target.value))} className="w-full accent-brand-600" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Temperature (K): {t.toFixed(0)}</span>
          <input type="range" min={200} max={600} step={5} value={t} onChange={(e) => setT(parseFloat(e.target.value))} className="w-full accent-brand-600" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Pressure (kPa): {p.toFixed(1)}</span>
          <input type="range" min={10} max={500} step={5} value={p} onChange={(e) => setP(parseFloat(e.target.value))} className="w-full accent-brand-600" />
        </label>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <p className="text-xs text-slate-400">Relationship</p>
        <p className="text-lg font-mono font-semibold text-brand-600 dark:text-brand-300">{formula}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result}</p>
        <p className="mt-2 text-xs text-slate-500">Ideal gas: PV = nRT, R = {R} J/(mol·K), n = {n} mol</p>
      </div>
    </div>
  );
}

/* ----------------------------- stoichiometry ------------------------------ */
function StoichSim() {
  const [balanced, setBalanced] = useState('2 H2 + O2 -> 2 H2O');
  const [r1, setR1] = useState('4'); // moles H2
  const [r2, setR2] = useState('3'); // moles O2
  const coeffs = [2, 1, 2];
  const molH2 = parseFloat(r1) || 0;
  const molO2 = parseFloat(r2) || 0;
  const needO2 = molH2 / 2;
  const limiting = needO2 <= molO2 ? 'H2' : 'O2';
  const water = Math.min(molH2, molO2 * 2);
  return (
    <div className="space-y-4">
      <Input value={balanced} onChange={(e) => setBalanced(e.target.value)} className="font-mono" />
      <p className="text-xs text-slate-500">Balanced equation: <span className="font-mono font-semibold text-brand-600 dark:text-brand-300">{balanced}</span> (coefficients 2 : 1 : 2)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Moles of H₂ available</span>
          <Input type="number" value={r1} onChange={(e) => setR1(e.target.value)} className="font-mono" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Moles of O₂ available</span>
          <Input type="number" value={r2} onChange={(e) => setR2(e.target.value)} className="font-mono" />
        </label>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <div className="flex justify-between"><span className="text-slate-500">O₂ required for the H₂</span><b className="font-mono">{needO2.toFixed(2)} mol</b></div>
        <div className="mt-1 flex justify-between"><span className="text-slate-500">Limiting reagent</span><b className="text-rose-600">{limiting}</b></div>
        <div className="mt-1 flex justify-between"><span className="text-slate-500">Theoretical yield H₂O</span><b className="font-mono text-brand-600 dark:text-brand-300">{water.toFixed(2)} mol</b></div>
        <p className="mt-2 text-xs text-slate-500">The limiting reagent is fully consumed; the product is capped by it.</p>
      </div>
    </div>
  );
}

/* ------------------------------- molarity --------------------------------- */
function MolaritySim() {
  const [targetM, setTargetM] = useState('0.5');
  const [targetV, setTargetV] = useState('250'); // mL
  const [stockM, setStockM] = useState('1.0');
  const M = parseFloat(targetM) || 0;
  const V = parseFloat(targetV) || 0;
  const SM = parseFloat(stockM) || 0;
  // mass of solute (NaCl, molar mass 58.44) for the target solution
  const mass = (M * V / 1000) * 58.44;
  // dilution: stock volume needed to make the target from a stock solution
  const vStock = (M * V) / (SM * 1000);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Target molarity (M)</span>
          <Input type="number" value={targetM} onChange={(e) => setTargetM(e.target.value)} className="font-mono" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Target volume (mL)</span>
          <Input type="number" value={targetV} onChange={(e) => setTargetV(e.target.value)} className="font-mono" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Stock molarity (M) — for dilution</span>
          <Input type="number" value={stockM} onChange={(e) => setStockM(e.target.value)} className="font-mono" />
        </label>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <p className="text-xs text-slate-400">Prepare from solid (NaCl, M = 58.44 g/mol)</p>
        <p className="text-lg font-mono font-semibold text-brand-600 dark:text-brand-300">{mass.toFixed(2)} g in {V.toFixed(0)} mL</p>
        <p className="mt-3 text-xs text-slate-400">Prepare by dilution (M₁V₁ = M₂V₂)</p>
        <p className="text-lg font-mono font-semibold text-brand-600 dark:text-brand-300">{vStock.toFixed(2)} mL of {SM.toFixed(1)} M stock → dilute to {V.toFixed(0)} mL</p>
        <p className="mt-2 text-xs text-slate-500">Molarity = moles solute ÷ litres of solution. Dilution keeps moles constant: M₁V₁ = M₂V₂.</p>
      </div>
    </div>
  );
}

/* ---------------------------- lab experiments hub ------------------------- */
function LabExperimentsHub({ onOpenSim }: { onOpenSim: (sim: Sim) => void }) {
  const [open, setOpen] = useState<LabExperiment | null>(null);
  return (
    <div className="space-y-3">
      {LAB_EXPERIMENTS.map((exp) => (
        <div key={exp.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{exp.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{exp.objective}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Badge tone="blue">{exp.category}</Badge>
              <Badge tone={exp.difficulty === 'Introductory' ? 'green' : exp.difficulty === 'Intermediate' ? 'amber' : 'violet'}>{exp.difficulty}</Badge>
              <Badge tone="slate">{exp.durationMin} min</Badge>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="h-8 px-3 text-xs" onClick={() => onOpenSim(exp.simulation)}>Open simulation</Button>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setOpen(exp)}>Procedure & safety</Button>
          </div>
        </div>
      ))}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} wide>
        {open && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Objective</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{open.objective}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Procedure</h3>
              <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {open.procedure.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-rose-600 dark:text-rose-400">Safety</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {open.safety.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-xs text-amber-700">Lab report: "{open.reportTitle}" — submit it as an assignment.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
              <Button onClick={() => { onOpenSim(open.simulation); setOpen(null); }}>Open simulation</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function VirtualLab({ onOpenVideos }: { onOpenVideos?: () => void }) {
  const [tab, setTab] = useState<Sim | 'experiments'>('experiments');
  void assessmentApi; // keep import used for future report linking

  const SIM_TABS: [Sim | 'experiments', string][] = [
    ['experiments', '🔬 Lab experiments'],
    ['titration', 'Titration'],
    ['ph', 'pH scale'],
    ['rate', 'Reaction rate'],
    ['gas', 'Gas laws'],
    ['stoich', 'Stoichiometry'],
    ['molarity', 'Molarity'],
  ];

  return (
    <Card title="Virtual Lab" subtitle="Six interactive simulations and a full lab-experiment catalogue — with videos and lab-report assignments.">
      <div className="mb-4 flex flex-wrap gap-2">
        {SIM_TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
            {label}
          </button>
        ))}
        {onOpenVideos && (
          <button type="button" onClick={onOpenVideos}
            className="rounded-full px-3 py-1 text-sm font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-200">
            🎬 Video library
          </button>
        )}
      </div>
      {tab === 'experiments' && <LabExperimentsHub onOpenSim={(s) => setTab(s)} />}
      {tab === 'titration' && <TitrationSim />}
      {tab === 'ph' && <PhScale />}
      {tab === 'rate' && <RateSim />}
      {tab === 'gas' && <GasLawsSim />}
      {tab === 'stoich' && <StoichSim />}
      {tab === 'molarity' && <MolaritySim />}
    </Card>
  );
}
