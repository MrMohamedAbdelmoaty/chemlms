/**
 * Chemistry calculators: moles, molar mass, molarity, stoichiometry and the
 * ideal / combined gas laws. Every calculator shows its step-by-step working.
 */
import { useState } from 'react';
import { Card, Input } from '../../components/ui';
import { molarMass } from './chemEngine';

function Steps({ rows }: { rows: string[] }) {
  return (
    <ol className="mt-3 space-y-1 border-l-2 border-brand-200 pl-4 text-sm text-slate-600 dark:text-slate-300">
      {rows.map((r, i) => (
        <li key={i} className="font-mono">
          <span className="mr-1 font-semibold text-brand-600 dark:text-brand-300">{i + 1}.</span>{r}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export function Calculators() {
  const [tab, setTab] = useState<'moles' | 'molarity' | 'stoichiometry' | 'gas'>('moles');

  /* ---------------- moles & molar mass ---------------- */
  const [molFormula, setMolFormula] = useState('H2O');
  const [molMass, setMolMass] = useState('18');
  const [molGiven, setMolGiven] = useState('48');
  const molError = (() => { try { molarMass(molFormula); return ''; } catch (e) { return (e as Error).message; } })();
  const mm = (() => { try { return molarMass(molFormula); } catch { return NaN; } })();
  const molesVal = parseFloat(molGiven) / (parseFloat(molMass) || 1);

  /* ---------------- molarity ---------------- */
  const [mrMol, setMrMol] = useState('0.0025');
  const [mrVol, setMrVol] = useState('0.025');
  const molarity = parseFloat(mrMol) / (parseFloat(mrVol) || 1);

  /* ---------------- stoichiometry ---------------- */
  const [stA, setStA] = useState('H2');
  const [stACoef, setStACoef] = useState('2');
  const [stB, setStB] = useState('H2O');
  const [stBCoef, setStBCoef] = useState('2');
  const [stAMass, setStAMass] = useState('4');
  const [stAVol, setStAVol] = useState('');
  const stErrorA = (() => { try { molarMass(stA); return ''; } catch (e) { return (e as Error).message; } })();
  const stErrorB = (() => { try { molarMass(stB); return ''; } catch (e) { return (e as Error).message; } })();
  const mmA = (() => { try { return molarMass(stA); } catch { return NaN; } })();
  const mmB = (() => { try { return molarMass(stB); } catch { return NaN; } })();
  const nA = parseFloat(stAMass) / (mmA || 1);
  const ratio = (parseFloat(stBCoef) || 0) / (parseFloat(stACoef) || 1);
  const nB = nA * ratio;
  const massB = nB * (mmB || 0);

  /* ---------------- gas laws ---------------- */
  const [p1, setP1] = useState('1');
  const [v1, setV1] = useState('2');
  const [t1, setT1] = useState('273');
  const [p2, setP2] = useState('');
  const [v2, setV2] = useState('1');
  const [t2, setT2] = useState('273');
  const combinedResult = p2
    ? (parseFloat(p1) * parseFloat(v1) * parseFloat(t2)) / (parseFloat(t1) * parseFloat(v2) * parseFloat(p2))
    : NaN;

  const tabs = [
    ['moles', 'Moles & molar mass'],
    ['molarity', 'Molarity'],
    ['stoichiometry', 'Stoichiometry'],
    ['gas', 'Gas laws'],
  ] as const;

  return (
    <Card title="Chemistry Calculators" subtitle="Moles, molarity, stoichiometry and gas-law calculations with full working.">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'moles' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Compound formula"><Input value={molFormula} onChange={(e) => setMolFormula(e.target.value)} className="font-mono" placeholder="H2SO4" /></Field>
            <Field label="Molar mass M (g/mol)"><Input value={molMass} onChange={(e) => setMolMass(e.target.value)} className="font-mono" /></Field>
            <Field label="Mass m (g)"><Input value={molGiven} onChange={(e) => setMolGiven(e.target.value)} className="font-mono" /></Field>
            {molError && <p className="text-sm text-rose-600">⚠ {molError}</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Result</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-300">{fmt(molesVal)} mol</p>
            <Steps rows={[
              `M(${molFormula}) = ${fmt(mm)} g/mol`,
              `n = m / M = ${molGiven} / ${molMass}`,
              `n = ${fmt(molesVal)} mol`,
            ]} />
          </div>
        </div>
      )}

      {tab === 'molarity' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Amount of substance n (mol)"><Input value={mrMol} onChange={(e) => setMrMol(e.target.value)} className="font-mono" /></Field>
            <Field label="Volume V (L)"><Input value={mrVol} onChange={(e) => setMrVol(e.target.value)} className="font-mono" /></Field>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Result</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-300">{fmt(molarity)} mol/L</p>
            <Steps rows={[
              `C = n / V`,
              `C = ${mrMol} / ${mrVol}`,
              `C = ${fmt(molarity)} mol/L`,
            ]} />
          </div>
        </div>
      )}

      {tab === 'stoichiometry' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="A formula"><Input value={stA} onChange={(e) => setStA(e.target.value)} className="font-mono" /></Field>
            <Field label="A coefficient"><Input value={stACoef} onChange={(e) => setStACoef(e.target.value)} className="font-mono" /></Field>
            <Field label="B formula"><Input value={stB} onChange={(e) => setStB(e.target.value)} className="font-mono" /></Field>
            <Field label="B coefficient"><Input value={stBCoef} onChange={(e) => setStBCoef(e.target.value)} className="font-mono" /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Mass of A (g)"><Input value={stAMass} onChange={(e) => setStAMass(e.target.value)} className="font-mono" /></Field>
            {stErrorA && <p className="text-sm text-rose-600">⚠ {stErrorA}</p>}
            {stErrorB && <p className="text-sm text-rose-600">⚠ {stErrorB}</p>}
          </div>
          <p className="text-xs text-slate-400">Mole ratio from coefficients: {stACoef} {stA} : {stBCoef} {stB}</p>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Result</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-300">{fmt(nB)} mol of {stB} (≈ {fmt(massB)} g)</p>
            <Steps rows={[
              `M(${stA}) = ${fmt(mmA)} g/mol`,
              `n(${stA}) = ${stAMass} / ${fmt(mmA)} = ${fmt(nA)} mol`,
              `Ratio: n(${stB}) = n(${stA}) × ${stBCoef}/${stACoef}`,
              `n(${stB}) = ${fmt(nB)} mol, mass = ${fmt(nB)} × ${fmt(mmB)} = ${fmt(massB)} g`,
            ]} />
          </div>
        </div>
      )}

      {tab === 'gas' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <Field label="P₁ (atm)"><Input value={p1} onChange={(e) => setP1(e.target.value)} className="font-mono" /></Field>
            <Field label="V₁ (L)"><Input value={v1} onChange={(e) => setV1(e.target.value)} className="font-mono" /></Field>
            <Field label="T₁ (K)"><Input value={t1} onChange={(e) => setT1(e.target.value)} className="font-mono" /></Field>
            <Field label="P₂ (atm)"><Input value={p2} onChange={(e) => setP2(e.target.value)} className="font-mono" /></Field>
            <Field label="V₂ (L)"><Input value={v2} onChange={(e) => setV2(e.target.value)} className="font-mono" /></Field>
            <Field label="T₂ (K)"><Input value={t2} onChange={(e) => setT2(e.target.value)} className="font-mono" /></Field>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Combined gas law (P₁V₁/T₁ = P₂V₂/T₂)</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-300">
              {p2 ? `${fmt(combinedResult)} atm` : 'Fill in any 5 values'}
            </p>
            {p2 && (
              <Steps rows={[
                `P₁V₁/T₁ = P₂V₂/T₂`,
                `${p1}×${v1}/${t1} = P₂×${v2}/${t2}`,
                `P₂ = ${p1}×${v1}×${t2} / (${t1}×${v2})`,
                `P₂ = ${fmt(combinedResult)} atm`,
              ]} />
            )}
            <p className="mt-2 text-xs text-slate-400">Ideal gas: PV = nRT with R = 0.0821 L·atm/(mol·K).</p>
          </div>
        </div>
      )}
    </Card>
  );
}
