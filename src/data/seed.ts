/**
 * Seed data for ChemLMS.
 * Builds a fully-populated in-memory Database (3 curricula, 5 classes,
 * 1 admin / 3 teachers / 20 students / 12 parents, sample chemistry
 * lessons, 35 tagged questions, grades, attendance, live sessions,
 * messages, announcements, notifications and audit logs).
 * Deterministic (seeded RNG) so the demo looks the same on every load.
 */
import type {
  Database, Grade, Question, SchoolClass, User, BloomLevel,
} from '../types';

/* ----------------------------- deterministic RNG ----------------------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (min: number, max: number) => Math.round((min + rnd() * (max - min)) * 10) / 10;

const now = new Date();
const iso = (daysFromNow: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateStr = (daysFromNow: number) => iso(daysFromNow).slice(0, 10);

/* ------------------------------------ curricula ------------------------------- */
const curricula = [
  { id: 'c-eg', name: 'Egyptian National (English Track)', code: 'EG', color: 'sky', description: 'Ministry of Education national curriculum delivered in English.', examStyle: 'National secondary exams' },
  { id: 'c-us', name: 'American Diploma / SAT / AP', code: 'US', color: 'amber', description: 'US-style high school diploma with SAT and AP Chemistry tracks.', examStyle: 'SAT Subject + AP Exams' },
  { id: 'c-uk', name: 'IGCSE / A-Level', code: 'UK', color: 'emerald', description: 'Cambridge IGCSE Chemistry and Edexcel/A-Level Chemistry.', examStyle: 'Cambridge IGCSE & A-Level' },
] as const;

const gradeDefs: [string, string][] = [
  ['c-eg', 'Grade 10'], ['c-eg', 'Grade 11'], ['c-eg', 'Grade 12'],
  ['c-us', 'Grade 9'], ['c-us', 'Grade 10'], ['c-us', 'AP Chemistry'],
  ['c-uk', 'IGCSE'], ['c-uk', 'A-Level'],
];
const grades: Grade[] = gradeDefs.map(([curriculumId, name], i) => ({
  id: `g-${curriculumId}-${i}`, curriculumId, name, order: i,
}));

/* --------------------------------------- topics ------------------------------- */
const TOPIC_DEFS: [string, string, string][] = [
  ['atomic-structure', 'Matter', 'Atomic structure'],
  ['bonding', 'Structure & Bonding', 'Chemical bonding'],
  ['stoichiometry', 'Stoichiometry', 'Stoichiometry & moles'],
  ['gas-laws', 'Gases', 'Gas laws'],
  ['acids-bases', 'Acids & Bases', 'Acids, bases & titration'],
  ['equilibrium', 'Equilibrium', 'Chemical equilibrium'],
  ['thermochem', 'Energy', 'Thermochemistry'],
  ['organic', 'Organic Chemistry', 'Organic chemistry'],
  ['lab-safety', 'Laboratory', 'Laboratory safety'],
];
const LO_TEXT: Record<string, [string, string]> = {
  'atomic-structure': [
    'Describe the structure of the atom and calculate the numbers of protons, neutrons and electrons.',
    'Explain periodic trends in atomic size, ionisation energy and electronegativity.',
  ],
  bonding: [
    'Compare ionic, covalent and metallic bonding in terms of structure and properties.',
    'Predict the shape of simple molecules using VSEPR theory.',
  ],
  stoichiometry: [
    'Calculate moles, molar mass and concentration in chemical calculations.',
    'Solve limiting-reagent and percentage-yield stoichiometry problems.',
  ],
  'gas-laws': [
    'State and apply Boyle’s, Charles’s and the combined gas laws.',
    'Use the ideal gas equation PV = nRT in calculations.',
  ],
  'acids-bases': [
    'Calculate pH and pOH from hydrogen-ion and hydroxide-ion concentrations.',
    'Perform titration calculations and identify suitable indicators.',
  ],
  equilibrium: [
    'Explain dynamic equilibrium and predict the effect of changing conditions (Le Chatelier).',
    'Calculate equilibrium constants from experimental data.',
  ],
  thermochem: [
    'Define enthalpy change and distinguish exothermic from endothermic reactions.',
    'Calculate heat changes using q = mcΔT and Hess’s law.',
  ],
  organic: [
    'Identify functional groups and draw structural formulae of organic compounds.',
    'Compare the properties and reactions of alkanes, alkenes and alcohols.',
  ],
  'lab-safety': [
    'Recognise GHS hazard pictograms and safe laboratory practices.',
    'Demonstrate correct use of apparatus and emergency procedures.',
  ],
};
const topicId = (slug: string, curr: string) => `t-${slug}-${curr}`;
const loId = (slug: string, curr: string, idx: number) => `lo-${slug}-${curr}-${idx}`;

const topics = curricula.flatMap((c) => {
  const key = c.id.replace('c-', '');
  return TOPIC_DEFS.map(([slug, unit, name]) => ({
    id: topicId(slug, key), curriculumId: c.id, unit, name,
  }));
});
const learningOutcomes = curricula.flatMap((c) => {
  const key = c.id.replace('c-', '');
  return TOPIC_DEFS.flatMap(([slug, , name]) =>
    LO_TEXT[slug].map((text, idx) => ({
      id: loId(slug, key, idx),
      curriculumId: c.id,
      topicId: topicId(slug, key),
      code: `LO-${slug.slice(0, 3).toUpperCase()}-${idx + 1}`,
      text,
    })),
  );
});

/* ---------------------------------- users ----------------------------------- */
const AVATARS = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500'];

const STUDENT_NAMES = [
  'Ahmed Al-Rashid', 'Layla Hassan', 'Youssef Khalil', 'Mariam Saleh', 'Khaled Ibrahim',
  'Salma Farouk', 'Tarek Mansour', 'Nour Abdullah', 'Hassan Malik', 'Rania Zentouri',
  'Ali Hussein', 'Dina Salam', 'Omar Qassem', 'Sara Hadi', 'Karim Fawzi',
  'Lina Nader', 'Walid Darwish', 'Farah Abbas', 'Nasser Diab', 'Joud Saad',
];
const PARENT_NAMES: [string, number[]][] = [
  ['Rashid Al-Rashid', [1]],
  ['Nadia Hassan', [2]],
  ['Ahmed Khalil', [3, 7]],
  ['Fatima Saleh', [4]],
  ['Mahmoud Ibrahim', [5, 13]],
  ['Layla Farouk', [6]],
  ['Khaled Mansour', [7]],
  ['Sara Abdullah', [8, 15]],
  ['Yusuf Malik', [9]],
  ['Huda Zentouri', [10]],
  ['Tariq Hussein', [11, 16]],
  ['Rane Salam', [12, 18, 20]],
];

const users: User[] = [
  { id: 'u-admin', name: 'Dr. Nabil El-Sayed', email: 'admin@chemlms.edu', role: 'admin', avatarColor: 'bg-slate-700', status: 'active', password: 'admin123' },
  { id: 'u-t1', name: 'Dr. Lena Hassan', email: 'lena@chemlms.edu', role: 'teacher', avatarColor: AVATARS[0], status: 'active', password: 'teacher123', classIds: ['c1', 'c3'] },
  { id: 'u-t2', name: 'Mr. Omar Khalil', email: 'omar@chemlms.edu', role: 'teacher', avatarColor: AVATARS[1], status: 'active', password: 'teacher123', classIds: ['c2', 'c4'] },
  { id: 'u-t3', name: 'Ms. Sara Ibrahim', email: 'sara@chemlms.edu', role: 'teacher', avatarColor: AVATARS[2], status: 'active', password: 'teacher123', classIds: ['c5'] },
];

// Classes: 2 per curriculum where possible. Students s1..s20 mapped below.
const CLASSES: [string, string, string, string, string, string[]][] = [
  // id, name, gradeId, curriculumId, teacherId, studentIds
  ['c1', 'Chemistry 10A', 'g-c-eg-0', 'c-eg', 'u-t1', ['s1', 's2', 's3', 's4', 's5']],
  ['c2', 'Chemistry 11B', 'g-c-eg-1', 'c-eg', 'u-t2', ['s6', 's7', 's8', 's9', 's10']],
  ['c3', 'Chemistry 10A (US)', 'g-c-us-1', 'c-us', 'u-t1', ['s11', 's12', 's13', 's14', 's15']],
  ['c4', 'AP Chemistry', 'g-c-us-2', 'c-us', 'u-t2', ['s16', 's17', 's18']],
  ['c5', 'IGCSE Chemistry', 'g-c-uk-0', 'c-uk', 'u-t3', ['s19', 's20']],
];
const classes: SchoolClass[] = CLASSES.map(([id, name, gradeId, curriculumId, teacherId, studentIds]) => ({
  id, name, gradeId, curriculumId, teacherId, studentIds,
}));

// Students with homeroom class membership
for (let i = 0; i < STUDENT_NAMES.length; i++) {
  const classOf = CLASSES.find(([, , , , , ids]) => ids.includes(`s${i + 1}`))!;
  users.push({
    id: `s${i + 1}`, name: STUDENT_NAMES[i], email: `student${i + 1}@chemlms.edu`,
    role: 'student', avatarColor: AVATARS[i % AVATARS.length], status: 'active',
    password: 'student123', studentClassIds: [classOf[0]],
  });
}

// Parents + parent_student links (children arrays on the user record)
const parentStudentLinks: { parentId: string; studentId: string }[] = [];
for (let i = 0; i < PARENT_NAMES.length; i++) {
  const [name, childIds] = PARENT_NAMES[i];
  const pid = `p${i + 1}`;
  users.push({
    id: pid, name, email: `parent${i + 1}@chemlms.edu`, role: 'parent',
    avatarColor: AVATARS[(i + 3) % AVATARS.length], status: 'active',
    password: 'parent123', children: childIds.map((c) => `s${c}`),
  });
  for (const c of childIds) parentStudentLinks.push({ parentId: pid, studentId: `s${c}` });
}
// Student guardian links
for (const u of users.filter((u) => u.role === 'student')) {
  u.guardians = parentStudentLinks.filter((l) => l.studentId === u.id).map((l) => l.parentId);
}

/* ----------------------------------- courses --------------------------------- */
const courses = classes.map((c) => ({
  id: `cr-${c.id}`, classId: c.id, curriculumId: c.curriculumId, subject: 'Chemistry',
  title: `Chemistry — ${c.name}`,
  description: 'Chemistry course with interactive lessons, chemistry tools and assessments.',
  teacherId: c.teacherId, lessonIds: [] as string[],
}));

/* ------------------------------------- lessons -------------------------------- */
const LESSON_DEFS: [string, string, string, string, number, number][] = [
  // title, summary, content, topicSlug, recordedMinutes, order
  ['Atomic Structure & the Periodic Table', 'Atoms, subatomic particles and how the periodic table is organised.',
    'The atom consists of a nucleus of protons and neutrons surrounded by electrons in shells. The atomic number (Z) fixes the element; the mass number (A) is the sum of protons and neutrons. Elements are arranged in the periodic table by increasing Z, with recurring (periodic) properties. Use the interactive periodic table in the Chemistry Lab to explore trends in atomic radius, electronegativity and ionisation energy.',
    'atomic-structure', 28, 1],
  ['Electron Configuration', 'How electrons fill orbitals and how this explains the periodic table.',
    'Electrons fill subshells in aufbau order: 1s, 2s, 2p, 3s, 3p, 4s, 3d … Configurations can be written in full or with noble-gas shorthand, e.g. Na (Z = 11) is [Ne] 3s¹. Valence electrons determine chemical behaviour and bonding.',
    'atomic-structure', 22, 2],
  ['Chemical Bonding', 'Ionic, covalent and metallic bonding, and molecular shape.',
    'Ionic bonds form by electron transfer between metals and nonmetals, giving lattice structures. Covalent bonds share electron pairs between nonmetals; VSEPR theory predicts molecular shape from bonding and lone pairs. Metallic bonding is a lattice of positive ions in a sea of delocalised electrons, explaining conductivity and malleability.',
    'bonding', 30, 3],
  ['Stoichiometry & Moles', 'The mole concept, molar mass and balancing chemical equations.',
    'The mole (mol) is the SI unit for amount of substance; 1 mol contains 6.02 × 10²³ particles. Molar mass (g/mol) links mass and moles: n = m / M. Balanced equations give the mole ratios needed for calculations. Try the equation balancer and the mole/molarity calculators in the Chemistry Lab.',
    'stoichiometry', 32, 4],
  ['Gas Laws', 'Boyle’s, Charles’s, combined gas laws and the ideal gas equation.',
    'For a fixed amount of gas: Boyle’s law gives P ∝ 1/V at constant T; Charles’s law gives V ∝ T at constant P. The ideal gas equation PV = nRT combines these. Standard conditions (STP) use 0 °C (273.15 K) and 1 atm, where 1 mol of gas occupies 22.4 L.',
    'gas-laws', 26, 5],
  ['Acids, Bases & Titration', 'pH, neutralisation and titration calculations.',
    'pH = −log[H⁺]. Strong acids fully dissociate; weak acids only partly. In titration, a solution of known concentration (titrant) is added until the equivalence point is reached, where moles of acid equal moles of base. Choose an indicator whose colour change matches the pH at equivalence. Practice with the virtual titration lab.',
    'acids-bases', 34, 6],
  ['Chemical Equilibrium', 'Dynamic equilibrium, the equilibrium constant and Le Chatelier’s principle.',
    'In a closed system, reversible reactions reach dynamic equilibrium when rates of forward and reverse reactions are equal. The equilibrium constant K expresses the ratio of product to reactant concentrations. Le Chatelier’s principle: changing concentration, pressure or temperature shifts equilibrium to oppose the change.',
    'equilibrium', 29, 7],
  ['Thermochemistry & Organic Basics', 'Enthalpy changes, Hess’s law, and introductory organic chemistry.',
    'Exothermic reactions release energy (ΔH negative), endothermic reactions absorb it. Heat change q = mcΔT. Hess’s law allows combining reactions to find unknown enthalpies. In organic chemistry, functional groups such as hydroxyl (–OH), carbonyl (C=O) and carboxyl (–COOH) determine properties and reactions of compounds.',
    'thermochem', 31, 8],
];

const lessons = LESSON_DEFS.flatMap((def, li) =>
  courses.map((cr) => {
    const [title, summary, content, topicSlug, recordedMinutes, order] = def;
    const currKey = cr.curriculumId.replace('c-', '');
    const topic = topicId(topicSlug, currKey);
    const los = [0, 1].map((idx) => loId(topicSlug, currKey, idx));
    const id = `l-${cr.id.replace('cr-', '')}-${li + 1}`;
    cr.lessonIds.push(id);
    return {
      id, courseId: cr.id, title, summary, content, topicId: topic, loIds: los,
      recordedMinutes, order,
      resources: [
        { type: 'video' as const, title: `${title} — recorded lesson`, url: '#player', durationMin: recordedMinutes },
        { type: 'pdf' as const, title: `${title} — notes (PDF)`, url: '#pdf' },
        { type: 'slides' as const, title: `${title} — slides`, url: '#slides' },
      ],
    };
  }),
);

/* ------------------------------------- questions ------------------------------ */
// Helper to tag a question with curriculum/topic/LO/difficulty.
const CK = { eg: 'c-eg', us: 'c-us', uk: 'c-uk' } as const;
const T = (slug: string, curr: 'eg' | 'us' | 'uk') => topicId(slug, curr);
const LOS = (slug: string, curr: 'eg' | 'us' | 'uk', n = 2) => [0, 1].slice(0, n).map((i) => loId(slug, curr, i));

type Q = Omit<Question, 'id' | 'curriculumId' | 'topicId' | 'loIds'> & { curr: 'eg' | 'us' | 'uk'; topic: string };
const QDEFS: Q[] = [
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Remember', type: 'mcq', points: 2,
    stem: 'Which subatomic particle has no electrical charge?',
    options: ['Electron', 'Neutron', 'Proton', 'Positron'], answer: 'Neutron',
    explanation: 'Neutrons are neutral; protons are positive and electrons negative.' },
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Understand', type: 'mcq', points: 2,
    stem: 'The mass number of an atom equals the total number of:',
    options: ['Protons + electrons', 'Protons + neutrons', 'Neutrons + electrons', 'Protons only'],
    answer: 'Protons + neutrons', explanation: 'Mass number A = Z (protons) + N (neutrons).' },
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Remember', type: 'fill', points: 2,
    stem: 'The number of protons in an atom is called its ____.',
    answer: ['atomic number', 'atomic number (Z)', 'proton number'],
    explanation: 'The atomic number (Z) defines the element.' },
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Apply', type: 'mcq', points: 3,
    stem: 'The electron configuration of sodium (Na, Z = 11) is:',
    options: ['[Ne] 3s1', '[Ne] 3s2', '[Ar] 3s1', '1s2 2s2 2p6 3s2'], answer: '[Ne] 3s1',
    explanation: 'Sodium has 11 electrons: neon core (10) plus one 3s electron.' },
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Understand', type: 'truefalse', points: 2,
    stem: 'Isotopes of the same element have the same number of neutrons.',
    answer: 'false',
    explanation: 'Isotopes have the same protons but different neutron numbers.' },
  { curr: 'eg', topic: 'bonding', difficulty: 'Understand', type: 'mcq', points: 2,
    stem: 'A covalent bond is formed when:',
    options: ['Electrons are transferred from one atom to another', 'Electrons are shared between atoms',
      'Positive and negative ions attract each other', 'Electrons move freely in a lattice'],
    answer: 'Electrons are shared between atoms', explanation: 'Covalent bonding shares electron pairs, usually between nonmetals.' },
  { curr: 'eg', topic: 'bonding', difficulty: 'Apply', type: 'fill', points: 2,
    stem: 'In an ionic bond, the atom that loses an electron becomes a ____ ion.',
    answer: ['positive', 'cation', 'positively charged'],
    explanation: 'Losing electrons leaves a net positive charge (a cation).' },
  { curr: 'eg', topic: 'bonding', difficulty: 'Understand', type: 'truefalse', points: 2,
    stem: 'Metallic bonding consists of a lattice of positive ions in a sea of delocalised electrons.',
    answer: 'true', explanation: 'This model explains conductivity, malleability and ductility of metals.' },
  { curr: 'us', topic: 'stoichiometry', difficulty: 'Apply', type: 'mcq', points: 3,
    stem: 'In the reaction 2H₂ + O₂ → 2H₂O, the mole ratio of H₂ to O₂ is:',
    options: ['1 : 1', '2 : 1', '1 : 2', '2 : 2'], answer: '2 : 1',
    explanation: 'Balanced coefficients give the mole ratio directly: 2 mol H₂ per 1 mol O₂.' },
  { curr: 'us', topic: 'stoichiometry', difficulty: 'Apply', type: 'numeric', points: 4,
    stem: 'How many moles are present in 48 g of carbon atoms? (Ar of C = 12)',
    answer: { value: 4, unit: 'mol', sigfigs: 1, tolerance: 0.02, accepts: ['4', '4.0', '4 mol'] },
    explanation: 'n = m / M = 48 g ÷ 12 g/mol = 4 mol.' },
  { curr: 'us', topic: 'stoichiometry', difficulty: 'Apply', type: 'numeric', points: 4,
    stem: 'What is the mass of 0.5 mol of sodium chloride (NaCl)? (Na = 23, Cl = 35.5)',
    answer: { value: 29.25, unit: 'g', sigfigs: 3, tolerance: 0.01, accepts: ['29.2', '29.25', '29.3', '29.25 g'] },
    explanation: 'M(NaCl) = 58.5 g/mol; mass = 0.5 × 58.5 = 29.25 g.' },
  { curr: 'us', topic: 'gas-laws', difficulty: 'Understand', type: 'mcq', points: 2,
    stem: 'Boyle’s law states that, at constant temperature, the pressure of a gas is ____ its volume.',
    options: ['Directly proportional to', 'Inversely proportional to', 'Equal to', 'Unrelated to'],
    answer: 'Inversely proportional to', explanation: 'PV = constant at fixed T.' },
  { curr: 'us', topic: 'gas-laws', difficulty: 'Apply', type: 'numeric', points: 4,
    stem: 'A gas occupies 2.0 L at 1.00 atm. At constant temperature, what pressure will make its volume 1.0 L?',
    answer: { value: 2, unit: 'atm', sigfigs: 2, tolerance: 0.02, accepts: ['2', '2.0', '2 atm'] },
    explanation: 'P₁V₁ = P₂V₂ → P₂ = (1.00 × 2.0) / 1.0 = 2.0 atm.' },
  { curr: 'uk', topic: 'acids-bases', difficulty: 'Apply', type: 'mcq', points: 3,
    stem: 'The pH of a solution in which [H⁺] = 1 × 10⁻³ mol/L is:',
    options: ['3', '7', '10', '1 × 10⁻³'], answer: '3',
    explanation: 'pH = −log[H⁺] = −log(10⁻³) = 3.' },
  { curr: 'uk', topic: 'acids-bases', difficulty: 'Remember', type: 'fill', points: 2,
    stem: 'A solution with a pH of 7 at 25 °C is called ____.',
    answer: ['neutral', 'neutral solution'], explanation: 'At pH 7, [H⁺] = [OH⁻] — the solution is neutral.' },
  { curr: 'uk', topic: 'acids-bases', difficulty: 'Understand', type: 'truefalse', points: 2,
    stem: 'In an acid–base titration, the indicator changes colour at the equivalence point.',
    answer: 'true',
    explanation: 'The indicator is chosen so its colour change matches the pH at equivalence.' },
  { curr: 'uk', topic: 'acids-bases', difficulty: 'Apply', type: 'numeric', points: 5,
    stem: '25.0 mL of 0.100 mol/L HCl is neutralised with NaOH. How many moles of HCl are present?',
    answer: { value: 0.0025, unit: 'mol', sigfigs: 2, tolerance: 0.01, accepts: ['0.0025', '2.5e-3', '0.00250', '2.5 × 10⁻³'] },
    explanation: 'n = C × V = 0.100 mol/L × 0.0250 L = 0.0025 mol (2.5 × 10⁻³ mol).' },
  { curr: 'uk', topic: 'equilibrium', difficulty: 'Apply', type: 'mcq', points: 3,
    stem: 'For N₂(g) + 3H₂(g) ⇌ 2NH₃(g), increasing the pressure shifts the equilibrium position towards the:',
    options: ['Reactants, because there are more gas molecules', 'Products, because there are fewer gas molecules',
      'Reactants, because pressure always shifts left', 'No change, because pressure does not affect gas equilibria'],
    answer: 'Products, because there are fewer gas molecules',
    explanation: 'Le Chatelier: the system shifts to the side with fewer moles of gas (4 → 2).' },
  { curr: 'uk', topic: 'equilibrium', difficulty: 'Evaluate', type: 'truefalse', points: 2,
    stem: 'A catalyst increases the yield of a reversible reaction by shifting the equilibrium.',
    answer: 'false', explanation: 'A catalyst speeds up both directions equally; it does not change equilibrium yield.' },
  { curr: 'uk', topic: 'thermochem', difficulty: 'Understand', type: 'mcq', points: 2,
    stem: 'Combustion of a fuel is an example of a ____ reaction.',
    options: ['Endothermic', 'Exothermic', 'Photolytic', 'Reversible only'], answer: 'Exothermic',
    explanation: 'Combustion releases energy to the surroundings (ΔH < 0).' },
  { curr: 'us', topic: 'thermochem', difficulty: 'Apply', type: 'numeric', points: 5,
    stem: 'Calculate the heat energy needed to raise the temperature of 250 g of water by 10 °C. (c = 4.18 J/g·°C)',
    answer: { value: 10450, unit: 'J', sigfigs: 3, tolerance: 0.01, accepts: ['10450', '10.45 kJ', '10450 J', '1.045e4'] },
    explanation: 'q = mcΔT = 250 × 4.18 × 10 = 10 450 J (10.45 kJ).' },
  { curr: 'uk', topic: 'organic', difficulty: 'Understand', type: 'mcq', points: 2,
    stem: 'Which functional group is present in ethanol, C₂H₅OH?',
    options: ['Hydroxyl', 'Carboxyl', 'Amino', 'Carbonyl'], answer: 'Hydroxyl',
    explanation: 'Ethanol contains the –OH (hydroxyl) group, making it an alcohol.' },
  { curr: 'uk', topic: 'organic', difficulty: 'Remember', type: 'fill', points: 2,
    stem: 'The general formula of an alkane with n carbon atoms is ____.',
    answer: ['CnH2n+2', 'CnH2(n+2)', 'C_n H_2n+2'], explanation: 'Alkanes are saturated hydrocarbons with the general formula CₙH₂ₙ₊₂.' },
  { curr: 'uk', topic: 'organic', difficulty: 'Analyze', type: 'matching', points: 4,
    stem: 'Match each functional group to the class of compound it defines.',
    answer: { pairs: [
      { left: 'Hydroxyl (–OH)', right: 'Alcohol' },
      { left: 'Carboxyl (–COOH)', right: 'Carboxylic acid' },
      { left: 'Amino (–NH₂)', right: 'Amine' },
      { left: 'Carbonyl (C=O)', right: 'Aldehyde / ketone' },
    ] },
    explanation: 'Functional groups determine the class and typical reactions of organic compounds.' },
  { curr: 'eg', topic: 'lab-safety', difficulty: 'Remember', type: 'mcq', points: 2,
    stem: 'Which GHS pictogram is used for corrosive substances?',
    options: ['Corrosion', 'Flame', 'Environment', 'Health hazard'], answer: 'Corrosion',
    explanation: 'The corrosion pictogram (liquid on hand and metal) signals corrosive hazards.' },
  { curr: 'eg', topic: 'lab-safety', difficulty: 'Understand', type: 'truefalse', points: 2,
    stem: 'When diluting concentrated acid, you should always add the acid to water.',
    answer: 'false',
    explanation: 'Add acid to water? No — the correct rule is: always add acid to water, never water to acid. This statement is worded inversely, so it is false as written (the safe rule is add acid to water).' },
  { curr: 'eg', topic: 'stoichiometry', difficulty: 'Analyze', type: 'balance', points: 6,
    stem: 'Balance the equation: Fe + O₂ → Fe₂O₃. Enter the coefficients for Fe, O₂, Fe₂O₃.',
    answer: { equation: 'Fe + O2 -> Fe2O3', coefficients: [4, 3, 2] },
    explanation: '4Fe + 3O₂ → 2Fe₂O₃. Check: 4 Fe and 6 O on each side.' },
  { curr: 'eg', topic: 'stoichiometry', difficulty: 'Apply', type: 'balance', points: 4,
    stem: 'Balance the equation: H₂ + O₂ → H₂O. Enter the coefficients for H₂, O₂, H₂O.',
    answer: { equation: 'H2 + O2 -> H2O', coefficients: [2, 1, 2] },
    explanation: '2H₂ + O₂ → 2H₂O. Check: 4 H and 2 O on each side.' },
  { curr: 'us', topic: 'stoichiometry', difficulty: 'Evaluate', type: 'balance', points: 6,
    stem: 'Balance the equation: C₃H₈ + O₂ → CO₂ + H₂O. Enter coefficients for C₃H₈, O₂, CO₂, H₂O.',
    answer: { equation: 'C3H8 + O2 -> CO2 + H2O', coefficients: [1, 5, 3, 4] },
    explanation: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O. Check: 3 C, 8 H, 10 O on each side.' },
  { curr: 'us', topic: 'stoichiometry', difficulty: 'Apply', type: 'numeric', points: 3,
    stem: 'In the reaction 2H₂ + O₂ → 2H₂O, how many moles of water are produced from 4 mol of hydrogen?',
    answer: { value: 4, unit: 'mol', sigfigs: 1, tolerance: 0.02, accepts: ['4', '4 mol'] },
    explanation: 'The 2 : 2 ratio means moles of H₂ equal moles of H₂O, so 4 mol H₂ → 4 mol H₂O.' },
  { curr: 'uk', topic: 'acids-bases', difficulty: 'Analyze', type: 'graph', points: 4,
    stem: 'The graph shows the pH curve for the titration of a strong acid with a strong base. Approximate the pH at the equivalence point.',
    data: { graph: {
      labels: ['0', '5', '10', '15', '20', '25', '30'],
      series: [{ name: 'pH', values: [1, 1.2, 1.5, 2.5, 7, 11, 12.5] }],
    } },
    options: ['1', '7', '10', '12.5'], answer: '7',
    explanation: 'A strong acid–strong base titration reaches pH 7 at equivalence.' },
  { curr: 'uk', topic: 'stoichiometry', difficulty: 'Analyze', type: 'graph', points: 3,
    stem: 'The graph shows reaction rate against temperature for a fixed concentration. As temperature increases, the rate:',
    data: { graph: {
      labels: ['20', '30', '40', '50', '60', '70'],
      series: [{ name: 'Rate (relative)', values: [2, 4, 7, 12, 18, 25] }],
    } },
    options: ['Increases steadily', 'Decreases steadily', 'Stays constant', 'Drops after 50 °C'], answer: 'Increases steadily',
    explanation: 'Higher temperature gives more particles energy above the activation threshold, raising the rate.' },
  { curr: 'us', topic: 'atomic-structure', difficulty: 'Create', type: 'essay', points: 8,
    stem: 'Explain why sodium is more reactive than magnesium, referring to their atomic structure. (CER: Claim, Evidence, Reasoning)',
    answer: '',
    explanation: 'Model answer should mention: Na has one valence electron vs Mg two; Na loses its 3s¹ electron more easily (lower first ionisation energy); both are metals but Na reacts more vigorously (e.g. with water).' },
  { curr: 'eg', topic: 'acids-bases', difficulty: 'Remember', type: 'mcq', points: 2,
    stem: 'Which of the following is the correct formula for sulfuric acid?',
    options: ['H2SO4', 'HSO4', 'H2SO3', 'H2S4O'], answer: 'H2SO4',
    explanation: 'Sulfuric acid: two H⁺ and the sulfate ion SO₄²⁻ → H₂SO₄.' },
  { curr: 'eg', topic: 'atomic-structure', difficulty: 'Understand', type: 'fill', points: 2,
    stem: 'The subscript in the formula H₂O indicates that one molecule of water contains ____ hydrogen atoms.',
    answer: ['two', '2', 'two hydrogen'],
    explanation: 'The subscript 2 means two hydrogen atoms per water molecule.' },
];

const questions: Question[] = QDEFS.map((q, i) => ({
  id: `q${i + 1}`, curriculumId: CK[q.curr], topicId: T(q.topic, q.curr),
  loIds: LOS(q.topic, q.curr, q.topic === 'lab-safety' ? 1 : 2),
  ...q,
}));

/* ----------------------------- quizzes & assignments ------------------------- */
const quizzes = classes.map((c, i) => ({
  id: `quiz-${c.id}`, courseId: `cr-${c.id}`,
  title: i % 2 === 0 ? 'Unit check-up quiz' : 'Mid-unit knowledge check',
  description: 'Auto-graded quiz covering the current unit learning outcomes.',
  questionIds: (() => {
    const sets = [['q1', 'q2', 'q3', 'q4', 'q5'], ['q7', 'q8', 'q28', 'q29', 'q4'],
      ['q9', 'q10', 'q11', 'q12', 'q22'], ['q30', 'q31', 'q24', 'q35', 'q20'], ['q16', 'q17', 'q18', 'q19', 'q33']] as string[][];
    return sets[i];
  })(),
  timeLimitMin: 20, deadline: dateStr(3 + i), attempts: 2, randomize: true, published: true,
}));

const assignments = classes.map((c, i) => ({
  id: `asg-${c.id}`, courseId: `cr-${c.id}`,
  title: ['Lab report: Molar mass determination', 'Lab report: Rates of reaction', 'Assignment: Gas law analysis',
    'Assignment: Equilibrium case study', 'Assignment: Acid–base titration report'][i],
  description: 'Write a lab-style report. Upload your PDF or type your answer; the teacher will grade manually.',
  deadline: dateStr(5 + i), maxScore: 20, type: 'file' as const,
}));

/* ----------------------------------- submissions ----------------------------- */
const submissions: Database['submissions'] = [];
for (const qz of quizzes) {
  const cls = classes.find((c) => `quiz-${c.id}` === qz.id)!;
  for (const sid of cls.studentIds) {
    const maxScore = qz.questionIds.reduce(
      (acc, qid) => acc + questions.find((q) => q.id === qid)!.points, 0);
    const perfect = rnd() > 0.55;
    const score = perfect ? maxScore : Math.round(maxScore * between(0.45, 0.9));
    submissions.push({
      id: `sub-${qz.id}-${sid}`, assessmentId: qz.id, assessmentKind: 'quiz',
      classId: cls.id, studentId: sid,
      answers: Object.fromEntries(qz.questionIds.map((qid) => [qid, 'seeded'])),
      score, maxScore, feedback: perfect ? 'Well done — strong grasp of the unit.' : 'Review the explanations for the incorrect items.',
      submittedAt: iso(-2), status: 'graded',
    });
  }
}
// Teachers manually grade the file assignment for some students; others missing.
for (const asg of assignments) {
  const cls = classes.find((c) => `asg-${c.id}` === asg.id)!;
  cls.studentIds.forEach((sid, idx) => {
    if (idx % 4 === 3) return; // ~25% missing for a realistic demo
    const score = between(12, 19.5);
    submissions.push({
      id: `sub-${asg.id}-${sid}`, assessmentId: asg.id, assessmentKind: 'assignment',
      classId: cls.id, studentId: sid, answers: { note: 'Uploaded lab report PDF.' },
      score: Math.round(score), maxScore: asg.maxScore,
      feedback: score > 17 ? 'Excellent experimental write-up.' : 'Good work — tighten your error analysis next time.',
      submittedAt: iso(-3), status: 'graded',
    });
  });
}

/* ------------------------------------ gradebook ------------------------------ */
const gradebook: Database['gradebook'] = [];
const STUD_BY_CLASS = Object.fromEntries(classes.map((c) => [c.id, c.studentIds]));
for (const cls of classes) {
  for (const sid of STUD_BY_CLASS[cls.id]) {
    const quizScores = submissions.filter(
      (s) => s.classId === cls.id && s.studentId === sid && s.assessmentKind === 'quiz');
    const asgScores = submissions.filter(
      (s) => s.classId === cls.id && s.studentId === sid && s.assessmentKind === 'assignment');
    const base = quizScores.length ? quizScores.reduce((a, b) => a + b.score!, 0) / quizScores.length : between(60, 90);
    gradebook.push({ id: `gb-${cls.id}-${sid}-1`, classId: cls.id, studentId: sid, assessmentId: `quiz-${cls.id}`, title: 'Unit check-up quiz', type: 'quiz', score: Math.round(base), maxScore: 100, date: dateStr(-8) });
    gradebook.push({ id: `gb-${cls.id}-${sid}-2`, classId: cls.id, studentId: sid, assessmentId: `quiz-${cls.id}-2`, title: 'Mid-unit knowledge check', type: 'quiz', score: Math.round(base + between(-8, 8)), maxScore: 100, date: dateStr(-4) });
    gradebook.push({ id: `gb-${cls.id}-${sid}-3`, classId: cls.id, studentId: sid, assessmentId: `asg-${cls.id}`, title: 'Lab report', type: 'assignment', score: asgScores[0]?.score ?? null, maxScore: 20, date: dateStr(-2) });
    gradebook.push({ id: `gb-${cls.id}-${sid}-4`, classId: cls.id, studentId: sid, assessmentId: `midterm-${cls.id}`, title: 'Midterm exam', type: 'exam', score: Math.round(base + between(-12, 12)), maxScore: 100, date: dateStr(-10) });
    gradebook.push({ id: `gb-${cls.id}-${sid}-5`, classId: cls.id, studentId: sid, assessmentId: `lab-${cls.id}`, title: 'Practical lab assessment', type: 'lab', score: Math.round(base + between(-6, 10)), maxScore: 100, date: dateStr(-6) });
  }
}

/* ------------------------------------- attendance ---------------------------- */
const attendance: Database['attendance'] = [];
for (let day = 11; day >= 0; day--) {
  for (const cls of classes) {
    for (const sid of cls.studentIds) {
      const r = rnd();
      const status: Database['attendance'][number]['status'] = r > 0.92 ? 'absent' : r > 0.82 ? 'late' : 'present';
      attendance.push({ id: `att-${cls.id}-${sid}-${day}`, classId: cls.id, studentId: sid, date: dateStr(-day), status });
    }
  }
}

/* ------------------------------- live sessions ------------------------------ */
const liveSessions: Database['liveSessions'] = [
  { id: 'live-1', classId: 'c1', title: 'Live: Atomic structure & periodic trends', start: iso(0, 10), durationMin: 45, platform: 'zoom', link: 'https://zoom.us/j/00000000001', teacherId: 'u-t1', joinedStudentIds: ['s1', 's2', 's3'] },
  { id: 'live-2', classId: 'c3', title: 'Live: Stoichiometry workshop', start: iso(1, 11), durationMin: 50, platform: 'google-meet', link: 'https://meet.google.com/abc-defg-hij', teacherId: 'u-t1', joinedStudentIds: [] },
  { id: 'live-3', classId: 'c2', title: 'Live: Bonding Q&A', start: iso(-1, 12), durationMin: 40, platform: 'jitsi', link: 'https://meet.jit.si/chemlms-bonding', teacherId: 'u-t2', joinedStudentIds: ['s6', 's7', 's8', 's9'] },
];

/* ----------------------------------- messages -------------------------------- */
const messages: Database['messages'] = [
  { id: 'm1', fromId: 'u-t1', toId: 's1', content: 'Great progress on the atomic structure unit, Ahmed! Keep it up.', at: iso(-2, 15), read: true },
  { id: 'm2', fromId: 's1', toId: 'u-t1', content: 'Thank you, Dr. Lena! I will review the electron configuration exercise.', at: iso(-2, 15), read: true },
  { id: 'm3', fromId: 'p3', toId: 'u-t2', content: 'Hello Mr. Omar, could you share Tarek’s feedback on the midterm?', at: iso(-1, 9), read: false },
  { id: 'm4', fromId: 'u-t2', toId: 'p3', content: 'Sure — Tarek scored 82%. He should re-practise mole calculations. Happy to discuss at a meeting.', at: iso(-1, 10), read: false },
  { id: 'm5', fromId: 'u-t3', toId: 's19', content: 'Nasser, your titration lab report was thorough. Add more detail on indicator choice.', at: iso(-3, 16), read: true },
  { id: 'm6', fromId: 'p12', toId: 'u-t3', content: 'Thanks for the update on Farah and Joud.', at: iso(-2, 11), read: true },
];

/* ----------------------------- announcements & logs --------------------------- */
const announcements: Database['announcements'] = [
  { id: 'a1', title: 'Lab safety refresher before practicals', body: 'All chemistry students must complete the Lab Safety module and pass the safety quiz before their next practical session.', targets: { roles: ['student'], gradeIds: [], classIds: [] }, at: iso(-3, 8), byId: 'u-admin' },
  { id: 'a2', title: 'Midterm exam schedule published', body: 'The midterm exam timetable for Term 1 is now available under Reports. Please check your class schedule.', targets: { roles: ['student', 'parent'], gradeIds: [], classIds: [] }, at: iso(-5, 9), byId: 'u-admin' },
  { id: 'a3', title: 'Parent–teacher meetings — booking open', body: 'Parents can now request meetings with teachers of their children from the Messaging page.', targets: { roles: ['parent'], gradeIds: [], classIds: [] }, at: iso(-1, 14), byId: 'u-admin' },
];

const notifications: Database['notifications'] = [];
let nid = 0;
const notify = (userId: string, type: Database['notifications'][number]['type'], title: string, body: string, at = iso(-1, 9), read = false) =>
  notifications.push({ id: `n${++nid}`, userId, type, title, body, at, read });

for (const s of users.filter((u) => u.role === 'student')) {
  notify(s.id, 'grade', 'New grade posted', 'Your midterm exam grade has been posted — see Grades & Feedback.', iso(-1, 8));
  notify(s.id, 'assignment', 'Assignment due soon', 'A lab report is due within 5 days.', iso(-2, 12));
}
for (const p of users.filter((u) => u.role === 'parent')) {
  const child = users.find((u) => u.id === p.children![0]);
  notify(p.id, 'grade', 'New grade for ' + child!.name, `${child!.name} received a new midterm grade — see Grades.`, iso(-1, 8));
  notify(p.id, 'announcement', 'School announcement', 'Midterm exam schedule published.', iso(-5, 9));
}
notify('s2', 'absence', 'Absence recorded', 'You were marked absent in Chemistry 10A on the latest attendance day.', iso(-4, 8));
notify('s19', 'late', 'Late arrival recorded', 'You were marked late in IGCSE Chemistry.', iso(-3, 8));

const auditLogs: Database['auditLogs'] = [
  { id: 'al1', actorId: 'u-admin', action: 'login', detail: 'Admin signed in', at: iso(-6, 8) },
  { id: 'al2', actorId: 'u-t1', action: 'quiz.published', detail: 'Published "Unit check-up quiz" for Chemistry 10A', at: iso(-5, 9) },
  { id: 'al3', actorId: 'u-t2', action: 'grade.updated', detail: 'Updated submission sub-asg-c2-s6', at: iso(-4, 10) },
  { id: 'al4', actorId: 'u-admin', action: 'announcement.posted', detail: 'Posted school-wide announcement', at: iso(-5, 9) },
];

/* ------------------------------- lesson progress ----------------------------- */
const progress: Record<string, Database['progress'][string]> = {};
for (const s of users.filter((u) => u.role === 'student')) {
  const watched: Database['progress'][string] = {};
  for (const lesson of lessons) {
    watched[lesson.id] = (rnd() * 101) | 0;
  }
  progress[s.id] = watched;
}

export function createDatabase(): Database {
  return {
    users, curricula: curricula.map((c) => ({ ...c, gradeIds: grades.filter((g) => g.curriculumId === c.id).map((g) => g.id) })),
    grades, classes, topics, learningOutcomes, courses, lessons, questions, quizzes, assignments,
    submissions: submissions.map((s) => ({ ...s })),
    gradebook: gradebook.map((g) => ({ ...g })),
    attendance: attendance.map((a) => ({ ...a })),
    liveSessions: liveSessions.map((l) => ({ ...l })),
    messages: messages.map((m) => ({ ...m })),
    announcements: announcements.map((a) => ({ ...a })),
    notifications: notifications.map((n) => ({ ...n })),
    auditLogs: auditLogs.map((a) => ({ ...a })),
    settings: { name: 'Sahara International School', logoText: 'SIS', primaryColor: 'indigo', defaultLanguage: 'en', theme: 'light' },
    parentStudentLinks: parentStudentLinks.map((l) => ({ ...l })),
    progress: JSON.parse(JSON.stringify(progress)),
  };
}

export const BLOOM_LEVELS: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
