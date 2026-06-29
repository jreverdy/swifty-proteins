// CPK (Corey-Pauling-Koltun) colouring scheme and atomic radii.
// Colours are the standard CPK palette; radii are van der Waals radii in angstroms.
// Unknown elements fall back to a bright pink sphere so they are easy to spot.

export type ElementInfo = {
  /** Hex colour (e.g. "#FF0D0D") used for the atom sphere. */
  color: string;
  /** Van der Waals radius in angstroms, used to scale the sphere. */
  radius: number;
  /** Human readable element name. */
  name: string;
};

const DEFAULT_INFO: ElementInfo = { color: "#FF1493", radius: 1.6, name: "Unknown" };

// Keyed by upper-cased element symbol.
const ELEMENTS: Record<string, ElementInfo> = {
  H: { color: "#FFFFFF", radius: 1.2, name: "Hydrogen" },
  HE: { color: "#D9FFFF", radius: 1.4, name: "Helium" },
  LI: { color: "#CC80FF", radius: 1.82, name: "Lithium" },
  BE: { color: "#C2FF00", radius: 1.53, name: "Beryllium" },
  B: { color: "#FFB5B5", radius: 1.92, name: "Boron" },
  C: { color: "#909090", radius: 1.7, name: "Carbon" },
  N: { color: "#3050F8", radius: 1.55, name: "Nitrogen" },
  O: { color: "#FF0D0D", radius: 1.52, name: "Oxygen" },
  F: { color: "#90E050", radius: 1.47, name: "Fluorine" },
  NE: { color: "#B3E3F5", radius: 1.54, name: "Neon" },
  NA: { color: "#AB5CF2", radius: 2.27, name: "Sodium" },
  MG: { color: "#8AFF00", radius: 1.73, name: "Magnesium" },
  AL: { color: "#BFA6A6", radius: 1.84, name: "Aluminium" },
  SI: { color: "#F0C8A0", radius: 2.1, name: "Silicon" },
  P: { color: "#FF8000", radius: 1.8, name: "Phosphorus" },
  S: { color: "#FFFF30", radius: 1.8, name: "Sulfur" },
  CL: { color: "#1FF01F", radius: 1.75, name: "Chlorine" },
  AR: { color: "#80D1E3", radius: 1.88, name: "Argon" },
  K: { color: "#8F40D4", radius: 2.75, name: "Potassium" },
  CA: { color: "#3DFF00", radius: 2.31, name: "Calcium" },
  FE: { color: "#E06633", radius: 2.0, name: "Iron" },
  CO: { color: "#F090A0", radius: 2.0, name: "Cobalt" },
  NI: { color: "#50D050", radius: 1.63, name: "Nickel" },
  CU: { color: "#C88033", radius: 1.4, name: "Copper" },
  ZN: { color: "#7D80B0", radius: 1.39, name: "Zinc" },
  BR: { color: "#A62929", radius: 1.85, name: "Bromine" },
  I: { color: "#940094", radius: 1.98, name: "Iodine" },
  // Additional elements commonly seen in PDB ligands / drugs (standard CPK/Jmol colours).
  SE: { color: "#FFA100", radius: 1.9, name: "Selenium" },
  AS: { color: "#BD80E3", radius: 1.85, name: "Arsenic" },
  MN: { color: "#9C7AC7", radius: 2.05, name: "Manganese" },
  MO: { color: "#54B5B5", radius: 2.1, name: "Molybdenum" },
  CR: { color: "#8A99C7", radius: 2.05, name: "Chromium" },
  V: { color: "#A6A6AB", radius: 2.05, name: "Vanadium" },
  TI: { color: "#BFC2C7", radius: 2.15, name: "Titanium" },
  W: { color: "#2194D6", radius: 2.1, name: "Tungsten" },
  PT: { color: "#D0D0E0", radius: 1.75, name: "Platinum" },
  AU: { color: "#FFD123", radius: 1.66, name: "Gold" },
  AG: { color: "#C0C0C0", radius: 1.72, name: "Silver" },
  HG: { color: "#B8B8D0", radius: 1.55, name: "Mercury" },
  CD: { color: "#FFD98F", radius: 1.58, name: "Cadmium" },
  PB: { color: "#575961", radius: 2.02, name: "Lead" },
  SN: { color: "#668080", radius: 2.17, name: "Tin" },
  SB: { color: "#9E63B5", radius: 2.06, name: "Antimony" },
  GA: { color: "#C28F8F", radius: 1.87, name: "Gallium" },
  SR: { color: "#00FF00", radius: 2.49, name: "Strontium" },
  BA: { color: "#00C900", radius: 2.68, name: "Barium" },
  CS: { color: "#57178F", radius: 3.43, name: "Cesium" },
  RB: { color: "#702EB0", radius: 3.03, name: "Rubidium" },
  RU: { color: "#248F8F", radius: 2.05, name: "Ruthenium" },
  RH: { color: "#0A7D8C", radius: 2.0, name: "Rhodium" },
  PD: { color: "#006985", radius: 1.63, name: "Palladium" },
  IR: { color: "#175487", radius: 2.0, name: "Iridium" },
  OS: { color: "#266696", radius: 2.0, name: "Osmium" },
  RE: { color: "#267DAB", radius: 2.05, name: "Rhenium" },
};

export function getElementInfo(symbol: string): ElementInfo {
  return ELEMENTS[symbol.trim().toUpperCase()] ?? DEFAULT_INFO;
}
