/**
 * Full periodic table dataset (Z = 1..118).
 * Tuple: [atomicNumber, symbol, name, atomicMass, category, block, electronegativity, covalentRadiusPm, phase]
 * Category keys drive the legend and color coding in the PeriodicTable component.
 */

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide';

export interface ChemElement {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  category: ElementCategory;
  block: 's' | 'p' | 'd' | 'f';
  electronegativity: number;
  radiusPm: number;
  phase: 'solid' | 'liquid' | 'gas';
}

export const CATEGORY_META: Record<ElementCategory, { label: string; color: string }> = {
  'alkali-metal': { label: 'Alkali metal', color: 'bg-rose-400/90 dark:bg-rose-500/80' },
  'alkaline-earth': { label: 'Alkaline earth', color: 'bg-orange-400/90 dark:bg-orange-500/80' },
  'transition-metal': { label: 'Transition metal', color: 'bg-amber-300/90 dark:bg-amber-400/80' },
  'post-transition': { label: 'Post-transition', color: 'bg-yellow-300/90 dark:bg-yellow-400/80' },
  metalloid: { label: 'Metalloid', color: 'bg-lime-300/90 dark:bg-lime-400/80' },
  nonmetal: { label: 'Nonmetal', color: 'bg-emerald-300/90 dark:bg-emerald-400/80' },
  halogen: { label: 'Halogen', color: 'bg-sky-300/90 dark:bg-sky-400/80' },
  'noble-gas': { label: 'Noble gas', color: 'bg-violet-300/90 dark:bg-violet-400/80' },
  lanthanide: { label: 'Lanthanide', color: 'bg-fuchsia-300/90 dark:bg-fuchsia-400/80' },
  actinide: { label: 'Actinide', color: 'bg-cyan-300/90 dark:bg-cyan-400/80' },
};

const RAW: [number, string, string, number, ElementCategory, string, number, number, ChemElement['phase']][] = [
  [1, 'H', 'Hydrogen', 1.008, 'nonmetal', 's', 2.2, 31, 'gas'],
  [2, 'He', 'Helium', 4.003, 'noble-gas', 's', 0, 28, 'gas'],
  [3, 'Li', 'Lithium', 6.94, 'alkali-metal', 's', 0.98, 128, 'solid'],
  [4, 'Be', 'Beryllium', 9.012, 'alkaline-earth', 's', 1.57, 96, 'solid'],
  [5, 'B', 'Boron', 10.81, 'metalloid', 'p', 2.04, 84, 'solid'],
  [6, 'C', 'Carbon', 12.01, 'nonmetal', 'p', 2.55, 76, 'solid'],
  [7, 'N', 'Nitrogen', 14.01, 'nonmetal', 'p', 3.04, 71, 'gas'],
  [8, 'O', 'Oxygen', 16.00, 'nonmetal', 'p', 3.44, 66, 'gas'],
  [9, 'F', 'Fluorine', 19.00, 'halogen', 'p', 3.98, 57, 'gas'],
  [10, 'Ne', 'Neon', 20.18, 'noble-gas', 'p', 0, 58, 'gas'],
  [11, 'Na', 'Sodium', 22.99, 'alkali-metal', 's', 0.93, 166, 'solid'],
  [12, 'Mg', 'Magnesium', 24.31, 'alkaline-earth', 's', 1.31, 141, 'solid'],
  [13, 'Al', 'Aluminium', 26.98, 'post-transition', 'p', 1.61, 121, 'solid'],
  [14, 'Si', 'Silicon', 28.09, 'metalloid', 'p', 1.9, 111, 'solid'],
  [15, 'P', 'Phosphorus', 30.97, 'nonmetal', 'p', 2.19, 107, 'solid'],
  [16, 'S', 'Sulfur', 32.07, 'nonmetal', 'p', 2.58, 105, 'solid'],
  [17, 'Cl', 'Chlorine', 35.45, 'halogen', 'p', 3.16, 102, 'gas'],
  [18, 'Ar', 'Argon', 39.95, 'noble-gas', 'p', 0, 106, 'gas'],
  [19, 'K', 'Potassium', 39.10, 'alkali-metal', 's', 0.82, 203, 'solid'],
  [20, 'Ca', 'Calcium', 40.08, 'alkaline-earth', 's', 1.0, 176, 'solid'],
  [21, 'Sc', 'Scandium', 44.96, 'transition-metal', 'd', 1.36, 170, 'solid'],
  [22, 'Ti', 'Titanium', 47.87, 'transition-metal', 'd', 1.54, 160, 'solid'],
  [23, 'V', 'Vanadium', 50.94, 'transition-metal', 'd', 1.63, 153, 'solid'],
  [24, 'Cr', 'Chromium', 52.00, 'transition-metal', 'd', 1.66, 139, 'solid'],
  [25, 'Mn', 'Manganese', 54.94, 'transition-metal', 'd', 1.55, 139, 'solid'],
  [26, 'Fe', 'Iron', 55.85, 'transition-metal', 'd', 1.83, 132, 'solid'],
  [27, 'Co', 'Cobalt', 58.93, 'transition-metal', 'd', 1.88, 126, 'solid'],
  [28, 'Ni', 'Nickel', 58.69, 'transition-metal', 'd', 1.91, 124, 'solid'],
  [29, 'Cu', 'Copper', 63.55, 'transition-metal', 'd', 1.9, 132, 'solid'],
  [30, 'Zn', 'Zinc', 65.38, 'transition-metal', 'd', 1.65, 122, 'solid'],
  [31, 'Ga', 'Gallium', 69.72, 'post-transition', 'p', 1.81, 122, 'solid'],
  [32, 'Ge', 'Germanium', 72.63, 'metalloid', 'p', 2.01, 120, 'solid'],
  [33, 'As', 'Arsenic', 74.92, 'metalloid', 'p', 2.18, 119, 'solid'],
  [34, 'Se', 'Selenium', 78.97, 'nonmetal', 'p', 2.55, 120, 'solid'],
  [35, 'Br', 'Bromine', 79.90, 'halogen', 'p', 2.96, 120, 'liquid'],
  [36, 'Kr', 'Krypton', 83.80, 'noble-gas', 'p', 3.0, 116, 'gas'],
  [37, 'Rb', 'Rubidium', 85.47, 'alkali-metal', 's', 0.82, 220, 'solid'],
  [38, 'Sr', 'Strontium', 87.62, 'alkaline-earth', 's', 0.95, 195, 'solid'],
  [39, 'Y', 'Yttrium', 88.91, 'transition-metal', 'd', 1.22, 190, 'solid'],
  [40, 'Zr', 'Zirconium', 91.22, 'transition-metal', 'd', 1.33, 175, 'solid'],
  [41, 'Nb', 'Niobium', 92.91, 'transition-metal', 'd', 1.6, 164, 'solid'],
  [42, 'Mo', 'Molybdenum', 95.95, 'transition-metal', 'd', 2.16, 154, 'solid'],
  [43, 'Tc', 'Technetium', 98.00, 'transition-metal', 'd', 1.9, 147, 'solid'],
  [44, 'Ru', 'Ruthenium', 101.07, 'transition-metal', 'd', 2.2, 146, 'solid'],
  [45, 'Rh', 'Rhodium', 102.91, 'transition-metal', 'd', 2.28, 142, 'solid'],
  [46, 'Pd', 'Palladium', 106.42, 'transition-metal', 'd', 2.2, 139, 'solid'],
  [47, 'Ag', 'Silver', 107.87, 'transition-metal', 'd', 1.93, 145, 'solid'],
  [48, 'Cd', 'Cadmium', 112.41, 'transition-metal', 'd', 1.69, 144, 'solid'],
  [49, 'In', 'Indium', 114.82, 'post-transition', 'p', 1.78, 142, 'solid'],
  [50, 'Sn', 'Tin', 118.71, 'post-transition', 'p', 1.96, 139, 'solid'],
  [51, 'Sb', 'Antimony', 121.76, 'metalloid', 'p', 2.05, 139, 'solid'],
  [52, 'Te', 'Tellurium', 127.60, 'metalloid', 'p', 2.1, 138, 'solid'],
  [53, 'I', 'Iodine', 126.90, 'halogen', 'p', 2.66, 139, 'solid'],
  [54, 'Xe', 'Xenon', 131.29, 'noble-gas', 'p', 2.6, 140, 'gas'],
  [55, 'Cs', 'Caesium', 132.91, 'alkali-metal', 's', 0.79, 244, 'solid'],
  [56, 'Ba', 'Barium', 137.33, 'alkaline-earth', 's', 0.89, 215, 'solid'],
  [57, 'La', 'Lanthanum', 138.91, 'lanthanide', 'f', 1.1, 195, 'solid'],
  [58, 'Ce', 'Cerium', 140.12, 'lanthanide', 'f', 1.12, 203, 'solid'],
  [59, 'Pr', 'Praseodymium', 140.91, 'lanthanide', 'f', 1.13, 203, 'solid'],
  [60, 'Nd', 'Neodymium', 144.24, 'lanthanide', 'f', 1.14, 201, 'solid'],
  [61, 'Pm', 'Promethium', 145.00, 'lanthanide', 'f', 1.13, 199, 'solid'],
  [62, 'Sm', 'Samarium', 150.36, 'lanthanide', 'f', 1.17, 200, 'solid'],
  [63, 'Eu', 'Europium', 151.96, 'lanthanide', 'f', 1.2, 200, 'solid'],
  [64, 'Gd', 'Gadolinium', 157.25, 'lanthanide', 'f', 1.2, 196, 'solid'],
  [65, 'Tb', 'Terbium', 158.93, 'lanthanide', 'f', 1.2, 194, 'solid'],
  [66, 'Dy', 'Dysprosium', 162.50, 'lanthanide', 'f', 1.22, 192, 'solid'],
  [67, 'Ho', 'Holmium', 164.93, 'lanthanide', 'f', 1.23, 192, 'solid'],
  [68, 'Er', 'Erbium', 167.26, 'lanthanide', 'f', 1.24, 189, 'solid'],
  [69, 'Tm', 'Thulium', 168.93, 'lanthanide', 'f', 1.25, 190, 'solid'],
  [70, 'Yb', 'Ytterbium', 173.05, 'lanthanide', 'f', 1.1, 188, 'solid'],
  [71, 'Lu', 'Lutetium', 174.97, 'lanthanide', 'f', 1.27, 187, 'solid'],
  [72, 'Hf', 'Hafnium', 178.49, 'transition-metal', 'd', 1.3, 175, 'solid'],
  [73, 'Ta', 'Tantalum', 180.95, 'transition-metal', 'd', 1.5, 170, 'solid'],
  [74, 'W', 'Tungsten', 183.84, 'transition-metal', 'd', 2.36, 162, 'solid'],
  [75, 'Re', 'Rhenium', 186.21, 'transition-metal', 'd', 1.9, 151, 'solid'],
  [76, 'Os', 'Osmium', 190.23, 'transition-metal', 'd', 2.2, 144, 'solid'],
  [77, 'Ir', 'Iridium', 192.22, 'transition-metal', 'd', 2.2, 141, 'solid'],
  [78, 'Pt', 'Platinum', 195.08, 'transition-metal', 'd', 2.28, 136, 'solid'],
  [79, 'Au', 'Gold', 196.97, 'transition-metal', 'd', 2.54, 136, 'solid'],
  [80, 'Hg', 'Mercury', 200.59, 'transition-metal', 'd', 2.0, 132, 'liquid'],
  [81, 'Tl', 'Thallium', 204.38, 'post-transition', 'p', 1.62, 145, 'solid'],
  [82, 'Pb', 'Lead', 207.2, 'post-transition', 'p', 1.87, 146, 'solid'],
  [83, 'Bi', 'Bismuth', 208.98, 'post-transition', 'p', 2.02, 148, 'solid'],
  [84, 'Po', 'Polonium', 209.00, 'post-transition', 'p', 2.0, 140, 'solid'],
  [85, 'At', 'Astatine', 210.00, 'halogen', 'p', 2.2, 150, 'solid'],
  [86, 'Rn', 'Radon', 222.00, 'noble-gas', 'p', 2.2, 150, 'gas'],
  [87, 'Fr', 'Francium', 223.00, 'alkali-metal', 's', 0.7, 260, 'solid'],
  [88, 'Ra', 'Radium', 226.00, 'alkaline-earth', 's', 0.9, 221, 'solid'],
  [89, 'Ac', 'Actinium', 227.00, 'actinide', 'f', 1.1, 215, 'solid'],
  [90, 'Th', 'Thorium', 232.04, 'actinide', 'f', 1.3, 206, 'solid'],
  [91, 'Pa', 'Protactinium', 231.04, 'actinide', 'f', 1.5, 199, 'solid'],
  [92, 'U', 'Uranium', 238.03, 'actinide', 'f', 1.38, 196, 'solid'],
  [93, 'Np', 'Neptunium', 237.00, 'actinide', 'f', 1.36, 190, 'solid'],
  [94, 'Pu', 'Plutonium', 244.00, 'actinide', 'f', 1.28, 187, 'solid'],
  [95, 'Am', 'Americium', 243.00, 'actinide', 'f', 1.3, 187, 'solid'],
  [96, 'Cm', 'Curium', 247.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [97, 'Bk', 'Berkelium', 247.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [98, 'Cf', 'Californium', 251.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [99, 'Es', 'Einsteinium', 252.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [100, 'Fm', 'Fermium', 257.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [101, 'Md', 'Mendelevium', 258.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [102, 'No', 'Nobelium', 259.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [103, 'Lr', 'Lawrencium', 266.00, 'actinide', 'f', 1.3, 185, 'solid'],
  [104, 'Rf', 'Rutherfordium', 267.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [105, 'Db', 'Dubnium', 268.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [106, 'Sg', 'Seaborgium', 271.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [107, 'Bh', 'Bohrium', 272.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [108, 'Hs', 'Hassium', 270.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [109, 'Mt', 'Meitnerium', 276.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [110, 'Ds', 'Darmstadtium', 281.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [111, 'Rg', 'Roentgenium', 282.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [112, 'Cn', 'Copernicium', 285.00, 'transition-metal', 'd', 1.3, 180, 'solid'],
  [113, 'Nh', 'Nihonium', 286.00, 'post-transition', 'p', 1.3, 180, 'solid'],
  [114, 'Fl', 'Flerovium', 289.00, 'post-transition', 'p', 1.3, 180, 'solid'],
  [115, 'Mc', 'Moscovium', 290.00, 'post-transition', 'p', 1.3, 180, 'solid'],
  [116, 'Lv', 'Livermorium', 293.00, 'post-transition', 'p', 1.3, 180, 'solid'],
  [117, 'Ts', 'Tennessine', 294.00, 'halogen', 'p', 1.3, 180, 'solid'],
  [118, 'Og', 'Oganesson', 294.00, 'noble-gas', 'p', 1.3, 180, 'solid'],
];

export const ELEMENTS: ChemElement[] = RAW.map(
  ([z, symbol, name, mass, category, block, en, radiusPm, phase]) => ({
    z, symbol, name, mass, category, block: block as ChemElement['block'], electronegativity: en, radiusPm, phase,
  }),
);

/** Element symbol -> atomic mass (used by the molar-mass / stoichiometry calculators). */
export const ATOMIC_MASSES: Record<string, number> = Object.fromEntries(
  ELEMENTS.map((e) => [e.symbol, e.mass]),
);

/**
 * Builds a compact electron configuration for atomic number Z
 * (noble-gas shorthand), e.g. 26 -> "[Ar] 3d⁶ 4s²".
 * Uses the standard aufbau filling order as a deterministic approximation.
 */
export function electronConfiguration(z: number): string {
  const ORDER: [string, number][] = [
    ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6],
    ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10], ['6p', 6],
    ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6],
  ];
  const filled: [string, number][] = []; // [subshell, count]
  let remaining = z;
  for (const [sub, max] of ORDER) {
    const take = Math.min(max, remaining);
    if (take > 0) {
      filled.push([sub, take]);
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
  // Compact via noble-gas shorthand: find the largest core matching a noble gas
  const NOBLES: [number, string][] = [
    [2, 'He'], [10, 'Ne'], [18, 'Ar'], [36, 'Kr'], [54, 'Xe'], [86, 'Rn'],
  ];
  let cumulative = 0;
  for (let i = 0; i < filled.length; i++) {
    cumulative += filled[i][1];
    for (const [n, symbol] of NOBLES) {
      if (cumulative === n && i < filled.length - 1) {
        const tail = filled.slice(i + 1).map(([s, c]) => `${s}${c}`);
        return `[${symbol}] ${tail.join(' ')}`;
      }
    }
  }
  return filled.map(([s, c]) => `${s}${c}`).join(' ');
}
