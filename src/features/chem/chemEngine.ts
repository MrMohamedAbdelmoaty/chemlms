/**
 * Chemistry engine: chemical-formula parser, equation balancer (rational
 * Gaussian elimination with integer normalisation), and molar-mass maths.
 * Used by the equation balancer, the molar-mass/stoichiometry calculators
 * and the numeric question grader's formula validation.
 */
import { ATOMIC_MASSES } from '../../data/elements';

/** Small exact-rational class so balancer maths never hits float drift. */
class Fraction {
  n: number;
  d: number;
  constructor(n: number, d = 1) {
    let nn = Math.round(n * 1e9);
    let dd = Math.round(d * 1e9);
    if (dd === 0) throw new Error('Division by zero');
    const g = Fraction.gcd(Math.abs(nn), Math.abs(dd)) || 1;
    nn /= g; dd /= g;
    this.n = nn; this.d = dd;
    if (this.d < 0) { this.n = -this.n; this.d = -this.d; }
  }
  static gcd(a: number, b: number): number {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }
  add(o: Fraction) { return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Fraction) { return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Fraction) { return new Fraction(this.n * o.n, this.d * o.d); }
  scale(k: number) { return new Fraction(this.n * k, this.d); }
  div(o: Fraction) { return new Fraction(this.n * o.d, this.d * o.n); }
  neg() { return new Fraction(-this.n, this.d); }
  isZero() { return this.n === 0; }
  toNumber() { return this.n / this.d; }
}

export interface AtomCount {
  element: string;
  left: number; // count on the left side (per unit coefficient)
  right: number;
}

export interface ParsedEquation {
  left: string[];
  right: string[];
  elements: string[];
  atomCounts: AtomCount[]; // per compound index on each side
  matrix: number[][]; // elements x compounds (right side negated)
  error?: string;
}

/** Smallest positive integers proportional to exact rational coefficients. */
function exactIntegers(fracs: Fraction[]): number[] {
  const lcm = fracs.reduce((acc, f) => lcmOf(acc, f.d), 1);
  const ints = fracs.map((f) => f.n * (lcm / f.d));
  let g = ints[0];
  for (const n of ints) g = Fraction.gcd(g, n);
  return ints.map((n) => Math.round(n / g));
}

function lcmOf(a: number, b: number): number {
  return Math.round((a * b) / Fraction.gcd(a, b));
}

/** Strip state symbols (s)/(l)/(g)/(aq), whitespace and \ce wrappers. */
function clean(s: string): string {
  return s
    .replace(/\\ce\s*[{(]/g, '')
    .replace(/\(s\)|\(l\)|\(g\)|\(aq\)/gi, '')
    .replace(/[→⇒]/g, '->')
    .replace(/\s+/g, '');
}

/**
 * Parse a single compound formula like "Ca(OH)2" or "Fe2O3" into an
 * element -> count map. A leading coefficient is ignored (the balancer
 * treats every compound as having coefficient 1 initially).
 */
export function parseCompound(formula: string): Map<string, number> {
  const counts = new Map<string, number>();
  const s = formula.replace(/^\d+/, ''); // drop leading coefficient
  const stack: { map: Map<string, number> }[] = [{ map: counts }];
  const pushCount = (map: Map<string, number>, el: string, n: number) => {
    map.set(el, (map.get(el) ?? 0) + n);
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      const inner = new Map<string, number>();
      stack.push({ map: inner });
      i++;
    } else if (ch === ')') {
      const inner = stack.pop()?.map;
      i++;
      let mult = 1;
      const num = s.slice(i).match(/^\d+/);
      if (num) { mult = parseInt(num[0], 10); i += num[0].length; }
      if (inner) for (const [el, c] of inner) pushCount(stack[stack.length - 1].map, el, c * mult);
    } else if (/[A-Z]/.test(ch)) {
      // element symbol: uppercase + optional lowercase
      const el = ch + (s[i + 1] && /[a-z]/.test(s[i + 1]) ? s[i + 1] : '');
      i += el.length;
      const num = s.slice(i).match(/^\d+/);
      pushCount(stack[stack.length - 1].map, el, num ? parseInt(num[0], 10) : 1);
      if (num) i += num[0].length;
    } else {
      throw new Error(`Unexpected character "${ch}" in formula`);
    }
  }
  return counts;
}

/** Parse a full equation into the matrix used for balancing. */
export function parseEquation(input: string): ParsedEquation {
  const eq = clean(input);
  const arrow = eq.indexOf('->');
  if (arrow < 0) throw new Error('Use an arrow "->" to separate reactants and products.');
  const leftRaw = eq.slice(0, arrow);
  const rightRaw = eq.slice(arrow + 2);
  if (!leftRaw || !rightRaw) throw new Error('Both sides of the equation are required.');
  const left = leftRaw.split('+').filter(Boolean);
  const right = rightRaw.split('+').filter(Boolean);
  for (const c of [...left, ...right]) {
    parseCompound(c); // validates
  }
  const elements = new Set<string>();
  const countMaps: Map<string, number>[] = [];
  for (const c of [...left, ...right]) {
    const m = parseCompound(c);
    countMaps.push(m);
    for (const el of m.keys()) elements.add(el);
  }
  const all = [...elements].sort();
  const matrix = all.map((el) =>
    countMaps.map((m) => m.get(el) ?? 0),
  );
  // negate the right-hand-side columns: sum(coeff * col) = 0
  right.forEach((_, i) => {
    const col = left.length + i;
    for (const row of matrix) row[col] = -row[col];
  });
  const atomCounts: AtomCount[] = all.map((el) => ({ element: el, left: 0, right: 0 }));
  left.forEach((c, i) => {
    const m = parseCompound(c);
    atomCounts.forEach((a) => { a.left += m.get(a.element) ?? 0; });
    void i;
  });
  right.forEach((c) => {
    const m = parseCompound(c);
    atomCounts.forEach((a) => { a.right += m.get(a.element) ?? 0; });
  });
  return { left, right, elements: all, atomCounts, matrix };
}

/** Molar mass (g/mol) of a formula string, e.g. "H2SO4" -> 98.08. */
export function molarMass(formula: string): number {
  const m = parseCompound(formula);
  let total = 0;
  for (const [el, n] of m) {
    const mass = ATOMIC_MASSES[el];
    if (mass == null) throw new Error(`Unknown element "${el}".`);
    total += mass * n;
  }
  return Math.round(total * 1000) / 1000;
}

export interface BalanceResult {
  coefficients: number[]; // per compound, left then right
  balanced: string; // e.g. "4 Fe + 3 O2 -> 2 Fe2O3"
  error?: string;
  steps: {
    left: { formula: string; counts: [string, number][] }[];
    right: { formula: string; counts: [string, number][] }[];
    matrix: number[][];
    elements: string[];
  };
}

/**
 * Balance an equation.
 * Strategy: build the element x compound matrix, find a nullspace vector with
 * rational Gaussian elimination, scale to the smallest positive integers.
 * Falls back to a bounded coefficient search for edge cases.
 */
export function balanceEquation(input: string): BalanceResult {
  const { left, right, matrix, elements } = parseEquation(input);
  const compounds = [...left, ...right];
  const cols = compounds.length;

  const solve = (): Fraction[] | null => {
    // Reduce the element x compound matrix to reduced row echelon form (rationals, exact).
    const A: Fraction[][] = matrix.map((row) => row.map((v) => new Fraction(v)));
    const rows = A.length;
    const pivotCols: number[] = [];
    let r = 0;
    for (let c = 0; c < cols && r < rows; c++) {
      let pivot = -1;
      for (let i = r; i < rows; i++) if (!A[i][c].isZero()) { pivot = i; break; }
      if (pivot < 0) continue;
      [A[r], A[pivot]] = [A[pivot], A[r]];
      const pv = A[r][c];
      for (let k = c; k < cols; k++) A[r][k] = A[r][k].div(pv);
      for (let i = 0; i < rows; i++) {
        if (i !== r && !A[i][c].isZero()) {
          const factor = A[i][c]; // exact rational factor — no float drift
          for (let k = c; k < cols; k++) A[i][k] = A[i][k].sub(A[r][k].mul(factor));
        }
      }
      pivotCols.push(c);
      r++;
    }
    // Nullspace basis: one vector per free (non-pivot) column.
    const freeCols: number[] = [];
    for (let c = 0; c < cols; c++) if (!pivotCols.includes(c)) freeCols.push(c);
    for (const f of freeCols) {
      const v: Fraction[] = new Array(cols).fill(new Fraction(0));
      v[f] = new Fraction(1);
      for (let i = 0; i < pivotCols.length; i++) {
        const pc = pivotCols[i];
        v[pc] = A[i][f].neg();
      }
      if (v.every((x) => Math.abs(x.toNumber()) > 1e-9)) {
        const positive = v.map((x) => (x.toNumber() > 0 ? x : x.neg()));
        if (positive.every((x) => x.toNumber() > 1e-9)) return positive;
      }
    }
    return null;
  };

  let coeffsF = solve();
  if (!coeffsF) {
    const bf = bruteForce(matrix, cols);
    coeffsF = bf ? bf.map((n) => new Fraction(n)) : null;
  }
  if (!coeffsF) {
    return { coefficients: [], balanced: '', error: 'This equation has no non-trivial balancing solution (or the formula could not be parsed).', steps: { left: [], right: [], matrix, elements } };
  }

  // Scale exact rationals to the smallest positive integers via LCM of denominators.
  const ints = exactIntegers(coeffsF);

  const balanced = compounds.map((c, i) => `${ints[i] === 1 ? '' : ints[i] + ' '}${c}`).join(' + ')
    .replace(' -> ', ' -> ');
  const leftParts = compounds.slice(0, left.length).map((f, i) => `${ints[i] === 1 ? '' : ints[i] + ' '}${f}`).join(' + ');
  const rightParts = compounds.slice(left.length).map((f, i) => `${ints[left.length + i] === 1 ? '' : ints[left.length + i] + ' '}${f}`).join(' + ');

  return {
    coefficients: ints,
    balanced: `${leftParts} -> ${rightParts}`,
    steps: {
      left: left.map((f) => ({ formula: f, counts: [...parseCompound(f).entries()] as [string, number][] })),
      right: right.map((f) => ({ formula: f, counts: [...parseCompound(f).entries()] as [string, number][] })),
      matrix,
      elements,
    },
  };
}

/** Bounded coefficient search used when the linear system is under-determined. */
function bruteForce(matrix: number[][], cols: number): number[] | null {
  if (cols > 5) return null;
  const range = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const eqs: number[][] = matrix.map((row) => row.slice(0, cols));
  const recursive = (idx: number, acc: number[]): number[] | null => {
    if (idx === cols) {
      for (const eq of eqs) {
        let sum = 0;
        for (let i = 0; i < cols; i++) sum += eq[i] * acc[i];
        if (Math.abs(sum) > 1e-6) return null;
      }
      return acc;
    }
    for (const v of range) {
      const res = recursive(idx + 1, [...acc, v]);
      if (res) return res;
    }
    return null;
  };
  return recursive(0, []);
}
