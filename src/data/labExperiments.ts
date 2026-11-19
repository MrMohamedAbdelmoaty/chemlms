/**
 * Virtual lab experiment catalogue.
 *
 * Each experiment is a curated, realistic chemistry lab activity: objective,
 * procedure steps, safety notes, and a suggested lab-report assignment. The
 * virtual-lab simulations in the UI are the interactive counterparts of these
 * experiments; students work through the simulation and then submit a report.
 */

export interface LabExperiment {
  id: string;
  title: string;
  category: string; // matches video categories
  difficulty: 'Introductory' | 'Intermediate' | 'Advanced';
  durationMin: number;
  objective: string;
  procedure: string[];
  safety: string[];
  simulation: 'titration' | 'ph' | 'rate' | 'gas' | 'stoich' | 'molarity';
  reportTitle: string;
}

export const LAB_EXPERIMENTS: LabExperiment[] = [
  {
    id: 'exp-titration',
    title: 'Acid–Base Titration',
    category: 'Titration',
    difficulty: 'Intermediate',
    durationMin: 60,
    objective:
      'Determine the concentration of an unknown acid by titrating it against a standard base and locating the equivalence point from the pH curve.',
    procedure: [
      'Rinse and fill the burette with the standard NaOH solution.',
      'Pipette a known volume of the acid into the flask and add the indicator.',
      'Record the initial burette reading and add NaOH in small increments.',
      'Record pH after each addition and plot the titration curve.',
      'Identify the equivalence point and calculate the acid concentration.',
    ],
    safety: [
      'Wear goggles, gloves and a lab coat at all times.',
      'Handle NaOH with care — it is corrosive and causes burns.',
      'If solution contacts skin or eyes, rinse generously with water.',
    ],
    simulation: 'titration',
    reportTitle: 'Titration curve report',
  },
  {
    id: 'exp-ph-scale',
    title: 'Measuring the pH Scale',
    category: 'Acids & Bases',
    difficulty: 'Introductory',
    durationMin: 40,
    objective:
      'Compare the acidity/basicity of common substances, relate pH to hydrogen-ion concentration, and classify solutions as acidic, neutral or basic.',
    procedure: [
      'Obtain samples of common household solutions.',
      'Measure the pH of each using pH paper or a meter.',
      'Record [H⁺] from the pH and classify each solution.',
      'Compare measured values with reference values.',
    ],
    safety: [
      'Do not taste or ingest any lab solution.',
      'Avoid mixing bleach with acids — toxic gas may be released.',
    ],
    simulation: 'ph',
    reportTitle: 'pH of everyday substances',
  },
  {
    id: 'exp-rate',
    title: 'Rates of Reaction',
    category: 'Reaction Rates',
    difficulty: 'Intermediate',
    durationMin: 50,
    objective:
      'Investigate how temperature, concentration and catalysts affect reaction rate, and relate the observations to collision theory.',
    procedure: [
      'Run the reaction at different temperatures and record the time to completion.',
      'Repeat at different reactant concentrations.',
      'Repeat with and without a catalyst.',
      'Plot rate against each variable and interpret the trends.',
    ],
    safety: [
      'Use a water bath for heating — never heat directly over a flame.',
      'Ventilate the area when gases are evolved.',
    ],
    simulation: 'rate',
    reportTitle: 'Factors affecting reaction rate',
  },
  {
    id: 'exp-gas',
    title: 'Gas Laws: Boyle, Charles & Combined',
    category: 'Gas Laws',
    difficulty: 'Intermediate',
    durationMin: 45,
    objective:
      'Verify Boyle’s, Charles’s and the combined gas law by observing how pressure, volume and temperature of a fixed amount of gas are related.',
    procedure: [
      'Keep temperature constant and vary volume to test Boyle’s law (P × V = k).',
      'Keep pressure constant and vary temperature to test Charles’s law (V ∝ T).',
      'Use the combined gas law to predict a final state and check it.',
    ],
    safety: [
      'Use sealed, pressure-rated apparatus only.',
      'Do not exceed the apparatus pressure limits.',
    ],
    simulation: 'gas',
    reportTitle: 'Gas law verification report',
  },
  {
    id: 'exp-stoich',
    title: 'Stoichiometry & Limiting Reagent',
    category: 'Stoichiometry',
    difficulty: 'Advanced',
    durationMin: 55,
    objective:
      'Calculate reactant quantities using balanced equations, identify the limiting reagent, and predict the theoretical yield of a product.',
    procedure: [
      'Write and balance the chemical equation for the reaction.',
      'Calculate moles of each reactant from mass/volume data.',
      'Determine the limiting reagent using the stoichiometric ratios.',
      'Calculate the theoretical yield and compare with the actual yield.',
    ],
    safety: [
      'Weigh reagents carefully and record masses precisely.',
      'Follow waste-disposal instructions for the product.',
    ],
    simulation: 'stoich',
    reportTitle: 'Limiting reagent & yield calculation',
  },
  {
    id: 'exp-molarity',
    title: 'Molarity & Dilution',
    category: 'Solutions',
    difficulty: 'Introductory',
    durationMin: 40,
    objective:
      'Prepare a solution of known molarity and apply the dilution equation M₁V₁ = M₂V₂ to prepare diluted solutions.',
    procedure: [
      'Calculate the mass of solute needed for a target molarity and volume.',
      'Dissolve and make up to the exact volume in a volumetric flask.',
      'Use the dilution equation to prepare a series of dilutions.',
      'Verify concentrations by calculation.',
    ],
    safety: [
      'Add acid to water, never water to acid, when diluting.',
      'Use a fume hood for concentrated acids.',
    ],
    simulation: 'molarity',
    reportTitle: 'Molarity & dilution calculations',
  },
];
