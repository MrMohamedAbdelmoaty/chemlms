/**
 * Equation balancer UI: parses chemical equations, solves for integer
 * coefficients with the chemistry engine, and shows step-by-step working —
 * atom counts per compound, the element × compound matrix, and the balanced
 * result rendered with KaTeX \ce{} notation.
 */
import { useState } from 'react';
import { balanceEquation } from './chemEngine';
import { Badge, Button, Card, Input } from '../../components/ui';
import { KaTeX } from './KaTeXText';

const EXAMPLES = ['Fe + O2 -> Fe2O3', 'H2 + O2 -> H2O', 'C3H8 + O2 -> CO2 + H2O', 'Al + HCl -> AlCl3 + H2', 'KClO3 -> KCl + O2'];

export function EquationBalancer({ initialEquation, onConsume }: { initialEquation?: string; onConsume?: () => void }) {
  const [eq, setEq] = useState(initialEquation ?? 'Fe + O2 -> Fe2O3');
  const [result, setResult] = useState<ReturnType<typeof balanceEquation> | null>(null);

  const balance = () => {
    try {
      const r = balanceEquation(eq);
      setResult(r);
    } catch (e) {
      setResult({ coefficients: [], balanced: '', error: (e as Error).message, steps: { left: [], right: [], matrix: [], elements: [] } });
    }
  };

  const formatEquation = (s: string) => s.replace(/\b(O2|H2|N2|Cl2|Br2|I2|F2)\b/g, '$1').replace(/->/g, ' \\to ');

  return (
    <Card title="Equation Balancer" subtitle="Enter a chemical equation with -> between reactants and products.">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={eq} onChange={(e) => setEq(e.target.value)} placeholder="Fe + O2 -> Fe2O3"
          className="font-mono" onKeyDown={(e) => e.key === 'Enter' && balance()}
          aria-label="Chemical equation"
        />
        <Button onClick={balance}>Balance</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => { setEq(ex); setResult(null); }}
            className="rounded-full border border-slate-300 px-2.5 py-1 font-mono text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
            {ex}
          </button>
        ))}
      </div>

      {result?.error && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">⚠ {result.error}</div>}

      {result && !result.error && result.coefficients.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Balanced equation</p>
            <KaTeX tex={`\\ce{${formatEquation(result.balanced)}}`} display className="text-xl" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Coefficients: {result.coefficients.join(', ')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Step 1 — atom counts per compound
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {[...result.steps.left, ...result.steps.right].map((c) => (
                    <tr key={c.formula} className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
                      <td className="px-4 py-1.5 font-mono font-semibold text-slate-800 dark:text-slate-100">{c.formula}</td>
                      <td className="px-4 py-1.5 text-slate-600 dark:text-slate-300">
                        {c.counts.map(([el, n]) => <span key={el} className="mr-2">{el}: {n}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Step 2 — element × compound matrix (right side negated)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left text-slate-400">element</th>
                      {[...result.steps.left, ...result.steps.right].map((c) => (
                        <th key={c.formula} className="px-1 py-1 font-mono text-slate-500">{c.formula}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.matrix.map((row, ri) => (
                      <tr key={result.steps.elements[ri]} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-2 py-1 font-mono text-slate-600 dark:text-slate-300">{result.steps.elements[ri]}</td>
                        {row.map((v, ci) => (
                          <td key={ci} className="px-1 py-1 text-center font-mono text-slate-700 dark:text-slate-200">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-slate-400">
                Solving the system gives the smallest positive integer coefficients (Gaussian elimination over rationals).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="green">✓ Atoms conserved</Badge>
            {onConsume && (
              <Button variant="outline" onClick={() => { onConsume(); }}>Done</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
