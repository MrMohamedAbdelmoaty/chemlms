/**
 * KaTeX-backed chemical notation renderer.
 * KaTeX ships the mhchem extension, so `\ce{}` renders formulas, equations,
 * ionic charges, state symbols and reaction arrows natively.
 */
import katex from 'katex';
import { useMemo, useState } from 'react';
import { cn } from '../../components/ui';

export function KaTeX({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html' });
    } catch {
      return `<span class="text-rose-500">⚠ Could not render: ${tex}</span>`;
    }
  }, [tex, display]);
  return <span className={cn('katex', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline chemical text: renders \ce{} and \( \) segments with KaTeX. */
export function ChemText({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => {
    // Split on \ce{...} blocks and \(...\) inline math.
    const parts = children.split(/(\ce\{[^}]*\}|\\\([^)]*\\\))/g);
    return parts
      .map((part) => {
        if (part.startsWith('\\ce{')) {
          try {
            return katex.renderToString(part, { throwOnError: false, displayMode: false, output: 'html' });
          } catch { return part; }
        }
        if (part.startsWith('\\(')) {
          try {
            return katex.renderToString(part.replace(/^\\\(|\\\)$/g, ''), { throwOnError: false, displayMode: false, output: 'html' });
          } catch { return part; }
        }
        return `<span>${part.replace(/</g, '&lt;')}</span>`;
      })
      .join('');
  }, [children]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Interactive playground: type \ce{} LaTeX and see it render live. */
export function NotationPlayground() {
  const [tex, setTex] = useState('\\ce{2H2 + O2 -> 2H2O}\\\\ \ce{SO4^{2-}}\\\\ \ce{NaCl(s)}\\\\ \ce{Fe^{3+} + 3OH^{-} -> Fe(OH)3 v}');
  const examples = [
    ['\\ce{H2SO4}', 'Sulfuric acid'],
    ['\\ce{Ca(OH)2 -> Ca^{2+} + 2OH^{-}}', 'Dissociation of calcium hydroxide'],
    ['\\ce{2Al + 6HCl -> 2AlCl3 + 3H2 ^}', 'Reaction with gas evolution'],
    ['\\ce{CH3COOH <=> CH3COO^{-} + H+}', 'Weak acid equilibrium'],
  ];
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="tex-input" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Input (KaTeX + mhchem — use \ce{})
        </label>
        <textarea
          id="tex-input" value={tex} onChange={(e) => setTex(e.target.value)} rows={4}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Preview</p>
        <div className="space-y-1 text-lg leading-relaxed">
          {tex.split('\\\\').filter(Boolean).map((line, i) => (
            <KaTeX key={i} tex={line.trim()} display />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {examples.map(([ex, label]) => (
          <button key={ex} type="button" onClick={() => setTex(ex)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Tip: teachers can use this notation in lesson content, question stems and answer keys. Students get the same
        renderer in quiz questions.
      </p>
    </div>
  );
}
