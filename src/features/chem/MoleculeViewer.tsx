/**
 * 2D/3D molecule viewer — a dependency-free canvas ball-and-stick renderer
 * (works fully offline; no CDN needed). Drag to rotate, scroll to zoom.
 * Includes common molecules relevant to the chemistry curriculum.
 */
import { useEffect, useRef, useState } from 'react';
import { Badge, Card } from '../../components/ui';
import { KaTeX } from './KaTeXText';

interface Atom { element: string; x: number; y: number; z: number }
interface Molecule { name: string; formula: string; note: string; atoms: Atom[]; bonds: [number, number][] }

const COLORS: Record<string, string> = {
  H: '#f8fafc', C: '#33333a', O: '#e5484d', N: '#3b82f6', S: '#eab308',
  Cl: '#22c55e', Na: '#a855f7', K: '#d946ef', Ca: '#f97316', F: '#a3e635', Br: '#b45309',
};
const RADIUS: Record<string, number> = { H: 0.32, C: 0.7, O: 0.66, N: 0.65, S: 1.0, Cl: 1.0, Na: 1.2, K: 1.3, Ca: 1.3, F: 0.6, Br: 1.1 };

const MOLECULES: Molecule[] = [
  {
    name: 'Water', formula: 'H2O', note: 'Bent shape, 104.5° bond angle — explains water’s polarity.',
    atoms: [{ element: 'O', x: 0, y: 0, z: 0 }, { element: 'H', x: 0.76, y: 0.59, z: 0 }, { element: 'H', x: -0.76, y: 0.59, z: 0 }],
    bonds: [[0, 1], [0, 2]],
  },
  {
    name: 'Carbon dioxide', formula: 'CO2', note: 'Linear molecule — the two C=O double bonds cancel in polarity.',
    atoms: [{ element: 'C', x: 0, y: 0, z: 0 }, { element: 'O', x: 1.16, y: 0, z: 0 }, { element: 'O', x: -1.16, y: 0, z: 0 }],
    bonds: [[0, 1], [0, 2]],
  },
  {
    name: 'Methane', formula: 'CH4', note: 'Tetrahedral shape (109.5°) predicted by VSEPR theory.',
    atoms: [
      { element: 'C', x: 0, y: 0, z: 0 },
      { element: 'H', x: 0.63, y: 0.63, z: 0.63 }, { element: 'H', x: 0.63, y: -0.63, z: -0.63 },
      { element: 'H', x: -0.63, y: 0.63, z: -0.63 }, { element: 'H', x: -0.63, y: -0.63, z: 0.63 },
    ],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
  },
  {
    name: 'Ammonia', formula: 'NH3', note: 'Trigonal pyramidal shape with a lone pair on nitrogen.',
    atoms: [
      { element: 'N', x: 0, y: 0.12, z: 0 },
      { element: 'H', x: 0.94, y: -0.3, z: 0 }, { element: 'H', x: -0.47, y: -0.3, z: 0.81 }, { element: 'H', x: -0.47, y: -0.3, z: -0.81 },
    ],
    bonds: [[0, 1], [0, 2], [0, 3]],
  },
  {
    name: 'Ethene (ethylene)', formula: 'C2H4', note: 'Planar molecule with a C=C double bond; basis of alkene reactions.',
    atoms: [
      { element: 'C', x: -0.67, y: 0, z: 0 }, { element: 'C', x: 0.67, y: 0, z: 0 },
      { element: 'H', x: -1.29, y: 0.98, z: 0 }, { element: 'H', x: -1.29, y: -0.98, z: 0 },
      { element: 'H', x: 1.29, y: 0.98, z: 0 }, { element: 'H', x: 1.29, y: -0.98, z: 0 },
    ],
    bonds: [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5]],
  },
  {
    name: 'Benzene', formula: 'C6H6', note: 'Planar hexagonal ring with delocalised π electrons.',
    atoms: Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 * Math.PI) / 180;
      return { element: 'C' as string, x: 1.4 * Math.cos(a), y: 1.4 * Math.sin(a), z: 0 };
    }).concat(Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 * Math.PI) / 180;
      return { element: 'H' as string, x: 2.49 * Math.cos(a), y: 2.49 * Math.sin(a), z: 0 };
    })) as Molecule['atoms'],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]],
  },
  {
    name: 'Oxygen', formula: 'O2', note: 'Diatomic molecule with a double bond.',
    atoms: [{ element: 'O', x: 0, y: 0, z: 0 }, { element: 'O', x: 1.21, y: 0, z: 0 }],
    bonds: [[0, 1]],
  },
  {
    name: 'Sodium chloride', formula: 'NaCl', note: 'Ionic compound — lattice of Na⁺ and Cl⁻ ions (shown as one formula unit).',
    atoms: [{ element: 'Na', x: 0, y: 0, z: 0 }, { element: 'Cl', x: 2.82, y: 0, z: 0 }],
    bonds: [[0, 1]],
  },
];

export function MoleculeViewer() {
  const [idx, setIdx] = useState(0);
  const mol = MOLECULES[idx];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ yaw: 0.6, pitch: -0.35, zoom: 1, dragging: false, lastX: 0, lastY: 0, auto: true });
  const [size, setSize] = useState({ w: 360, h: 300 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setSize({ w: rect.width, h: rect.height });
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      const st = stateRef.current;
      const { w, h } = size;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(248,250,252,0)';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;

      // auto-rotate
      if (st.auto && !st.dragging) st.yaw += 0.006;

      const project = (a: Atom): { x: number; y: number; z: number } => {
        const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
        let x = a.x * cosY + a.z * sinY;
        let z1 = -a.x * sinY + a.z * cosY;
        let y = a.y * Math.cos(st.pitch) - z1 * Math.sin(st.pitch);
        let z2 = a.y * Math.sin(st.pitch) + z1 * Math.cos(st.pitch);
        const f = 4.2 * st.zoom;
        const f2 = f / (f - z2 * 0.55);
        return { x: cx + x * f2 * 60, y: cy - y * f2 * 60, z: z2 };
      };

      const projected = mol.atoms.map(project);
      // bonds first (painter's order: by average z)
      const bondList = mol.bonds.map(([a, b]) => {
        const pa = projected[a], pb = projected[b];
        return { a: pa, b: pb, z: (pa.z + pb.z) / 2 };
      }).sort((p, q) => p.z - q.z);
      ctx.lineWidth = 3.5;
      for (const bd of bondList) {
        ctx.strokeStyle = 'rgba(51,51,58,0.85)';
        ctx.beginPath();
        ctx.moveTo(bd.a.x, bd.a.y);
        ctx.lineTo(bd.b.x, bd.b.y);
        ctx.stroke();
      }
      // atoms sorted back-to-front
      const atoms = mol.atoms.map((a, i) => ({ a, p: projected[i], z: projected[i].z, i }))
        .sort((x, y) => x.z - y.z);
      for (const { a, p } of atoms) {
        const r = Math.max(6, RADIUS[a.element] ?? 0.7) * (size.w / 360) * st.zoom;
        const shade = Math.max(0.45, Math.min(1, (p.z + 3) / 6));
        const base = COLORS[a.element] ?? '#888';
        ctx.beginPath();
        ctx.fillStyle = base;
        ctx.globalAlpha = 1;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        // simple shading highlight (light from top-left)
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.45 * shade})`;
        ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        if (r > 9) {
          ctx.fillStyle = 'rgba(20,20,24,0.8)';
          ctx.font = `bold ${r * 0.9}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(a.element, p.x, p.y);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onDown = (e: MouseEvent) => {
      const st = stateRef.current;
      st.dragging = true; st.lastX = e.clientX; st.lastY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      const st = stateRef.current;
      if (!st.dragging) return;
      st.yaw += (e.clientX - st.lastX) * 0.01;
      st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch + (e.clientY - st.lastY) * 0.01));
      st.lastX = e.clientX; st.lastY = e.clientY;
    };
    const onUp = () => { stateRef.current.dragging = false; };
    const onWheel = (e: WheelEvent) => {
      stateRef.current.zoom = Math.max(0.4, Math.min(2.6, stateRef.current.zoom - e.deltaY * 0.001));
    };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [mol, size.w, size.h]);

  return (
    <Card title="2D / 3D Molecule Viewer" subtitle="Drag to rotate · scroll to zoom · ball-and-stick model">
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div>
          <canvas
            ref={canvasRef} className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
            style={{ height: 300 }} role="img" aria-label={`3D view of ${mol.name}`}
          />
          <p className="mt-2 text-center text-xs text-slate-400">{mol.note}</p>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Molecule</p>
            <select value={idx} onChange={(e) => setIdx(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {MOLECULES.map((m, i) => <option key={m.name} value={i}>{m.formula} — {m.name}</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-400">Formula</p>
            <KaTeX tex={`\\ce{${mol.formula}}}`} className="text-xl" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {mol.atoms.length} atoms · {mol.bonds.length} bonds
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.keys(COLORS).filter((el) => mol.atoms.some((a) => a.element === el)).map((el) => (
                <Badge key={el} tone="slate">{el}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
