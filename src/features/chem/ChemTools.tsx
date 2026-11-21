/**
 * Chemistry Lab — hub page that hosts every chemistry-specific tool:
 * periodic table, notation renderer, equation balancer, calculators,
 * molecule viewer, virtual lab and the lab-safety module.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PeriodicTable } from './PeriodicTable';
import { EquationBalancer } from './EquationBalancer';
import { Calculators } from './Calculators';
import { MoleculeViewer } from './MoleculeViewer';
import { VirtualLab } from './VirtualLab';
import { VideoLibrary } from './VideoLibrary';
import { LabSafety } from './LabSafety';
import { NotationPlayground } from './KaTeXText';
import { DeliverableStudio } from './DeliverableStudio';
import { Card } from '../../components/ui';

type Tool = 'table' | 'notation' | 'balancer' | 'calcs' | 'molecules' | 'lab' | 'videos' | 'safety' | 'studio';

const TABS: [Tool, string, string][] = [
  ['table', 'Periodic table', '🧪'],
  ['notation', 'Notation', '∑'],
  ['balancer', 'Balancer', '⚖️'],
  ['calcs', 'Calculators', '🧮'],
  ['molecules', 'Molecules', '🌐'],
  ['lab', 'Virtual lab', '🔬'],
  ['videos', 'Videos', '🎬'],
  ['safety', 'Lab safety', '⚠️'],
  ['studio', 'Deliverables', '📄'],
];

export function ChemTools() {
  const [tool, setTool] = useState<Tool>('table');
  const [equation, setEquation] = useState('');
  const { user } = useApp();
  // The Deliverable Studio is a teacher/admin tool — hide it from students.
  const canStudio = user?.role === 'admin' || user?.role === 'teacher';
  const tabs = canStudio ? TABS : TABS.filter((t) => t[0] !== 'studio');

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setTool(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tool === key ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}>
              <span className="mr-1">{icon}</span>{label}
            </button>
          ))}
        </div>
      </Card>

      {tool === 'table' && <PeriodicTable onUseElement={(sym) => { setEquation((e) => (e ? `${e} + ${sym}` : sym)); setTool('balancer'); }} />}
      {tool === 'notation' && (
        <Card title="Chemical Notation Renderer" subtitle="KaTeX + mhchem — formulas, ionic charges, equations and state symbols.">
          <NotationPlayground />
        </Card>
      )}
      {tool === 'balancer' && (
        <EquationBalancer
          initialEquation={equation || undefined}
          onConsume={() => setEquation('')}
        />
      )}
      {tool === 'calcs' && <Calculators />}
      {tool === 'molecules' && <MoleculeViewer />}
      {tool === 'lab' && <VirtualLab onOpenVideos={() => setTool('videos')} />}
      {tool === 'videos' && <VideoLibrary />}
      {tool === 'safety' && <LabSafety />}
      {tool === 'studio' && <DeliverableStudio />}
    </div>
  );
}
