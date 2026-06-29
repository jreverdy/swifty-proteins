// Tiny in-memory cache for parsed molecules so that selecting a ligand can load
// it on the list screen, then hand it to the Protein View without re-fetching.
// Doubles as a session-level "previously loaded" cache.

import { loadMolecule, Molecule } from "./cif";

const cache = new Map<string, Molecule>();

export async function getMolecule(id: string): Promise<Molecule> {
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }
  const molecule = await loadMolecule(id);
  cache.set(id, molecule);
  return molecule;
}

export function peekMolecule(id: string): Molecule | null {
  return cache.get(id) ?? null;
}
