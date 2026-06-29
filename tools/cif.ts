// Fetches and parses RCSB ligand Chemical Information Files (.cif).
// We read the `_chem_comp_atom` and `_chem_comp_bond` loops, preferring the
// idealised coordinates and falling back to the model coordinates when absent.

export type Atom = {
  id: string; // atom_id, e.g. "C5'"
  element: string; // type_symbol, e.g. "C"
  x: number;
  y: number;
  z: number;
};

export type Bond = {
  a: string; // atom_id_1
  b: string; // atom_id_2
  order: number; // 1 = single, 2 = double, 3 = triple
};

export type Molecule = {
  id: string;
  atoms: Atom[];
  bonds: Bond[];
};

export type CifErrorCode = "NO_NETWORK" | "NOT_FOUND" | "TIMEOUT" | "PARSE" | "UNKNOWN";

export class CifError extends Error {
  code: CifErrorCode;
  constructor(code: CifErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CifError";
  }
}

const REQUEST_TIMEOUT_MS = 15000;

export function ligandUrl(id: string): string {
  return `https://files.rcsb.org/ligands/view/${encodeURIComponent(id)}.cif`;
}

/** User-friendly message for an error, matching the wording suggested by the subject. */
export function cifErrorMessage(error: unknown): { title: string; details: string } {
  const code = error instanceof CifError ? error.code : "UNKNOWN";
  switch (code) {
    case "NO_NETWORK":
      return { title: "No internet connection", details: "Please check your network." };
    case "NOT_FOUND":
      return {
        title: "Ligand not found (404)",
        details: "This ligand may not exist in the database.",
      };
    case "TIMEOUT":
      return { title: "Request timeout", details: "Please try again." };
    case "PARSE":
      return {
        title: "Failed to parse ligand data",
        details: "The file may be corrupted.",
      };
    default:
      return { title: "Unable to load ligand", details: "Please try again." };
  }
}

export async function fetchLigandCif(id: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ligandUrl(id), { signal: controller.signal });

    if (response.status === 404) {
      throw new CifError("NOT_FOUND", `Ligand ${id} not found.`);
    }
    if (!response.ok) {
      throw new CifError("UNKNOWN", `Server returned status ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof CifError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new CifError("TIMEOUT", "The request timed out.");
    }
    // fetch throws a TypeError on network failures (DNS, offline, etc.).
    throw new CifError("NO_NETWORK", "Network request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

// Splits a CIF data line into tokens, honouring single and double quoted values.
function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    const char = line[i];
    if (char === " " || char === "\t") {
      i++;
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      i++;
      let value = "";
      // A quoted value ends at the matching quote followed by whitespace or EOL.
      while (i < len) {
        if (line[i] === quote && (i + 1 >= len || line[i + 1] === " " || line[i + 1] === "\t")) {
          i++;
          break;
        }
        value += line[i];
        i++;
      }
      tokens.push(value);
      continue;
    }
    let value = "";
    while (i < len && line[i] !== " " && line[i] !== "\t") {
      value += line[i];
      i++;
    }
    tokens.push(value);
  }

  return tokens;
}

function parseOrder(value: string): number {
  switch (value.toUpperCase()) {
    case "DOUB":
      return 2;
    case "TRIP":
      return 3;
    case "QUAD":
      return 4;
    default:
      return 1; // SING, AROM, or unknown -> draw as single
  }
}

function pickCoord(primary: string | undefined, fallback: string | undefined): number | null {
  const tryParse = (raw: string | undefined): number | null => {
    if (raw === undefined || raw === "?" || raw === ".") {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return tryParse(primary) ?? tryParse(fallback);
}

// Reads a `loop_` block: returns the ordered column names and the data rows.
type Loop = { columns: string[]; rows: string[][] };

function parseLoops(lines: string[]): Map<string, Loop> {
  const loops = new Map<string, Loop>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line !== "loop_") {
      i++;
      continue;
    }

    // Collect column headers (lines starting with "_").
    i++;
    const columns: string[] = [];
    while (i < lines.length && lines[i].trim().startsWith("_")) {
      columns.push(lines[i].trim());
      i++;
    }
    if (columns.length === 0) {
      continue;
    }
    const category = columns[0].split(".")[0]; // e.g. "_chem_comp_atom"

    // Collect data rows until the loop terminates.
    const rows: string[][] = [];
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (trimmed === "" || trimmed === "#" || trimmed === "loop_" || trimmed.startsWith("_") || trimmed.startsWith("data_")) {
        break;
      }
      rows.push(tokenizeLine(raw));
      i++;
    }

    loops.set(category, { columns, rows });
  }

  return loops;
}

// Single-atom (and other single-row) ligands store data as `_category.key value`
// pairs instead of a loop_. We reconstruct an equivalent single-row Loop from them.
// Loop headers (one token) and data rows (no leading "_") are naturally ignored.
function parseSingleRow(lines: string[], category: string): Loop | null {
  const columns: string[] = [];
  const row: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(`${category}.`)) {
      continue;
    }
    const tokens = tokenizeLine(trimmed);
    if (tokens.length < 2) {
      continue; // loop header, no inline value
    }
    columns.push(tokens[0]);
    row.push(tokens[1]);
  }
  return columns.length > 0 ? { columns, rows: [row] } : null;
}

function columnIndex(columns: string[], suffix: string): number {
  return columns.findIndex((col) => col.endsWith(`.${suffix}`));
}

export function parseCif(text: string, id: string): Molecule {
  const lines = text.split(/\r?\n/);
  const loops = parseLoops(lines);

  const atomLoop = loops.get("_chem_comp_atom") ?? parseSingleRow(lines, "_chem_comp_atom");
  if (!atomLoop) {
    throw new CifError("PARSE", "No atom data found in CIF file.");
  }

  const idIdx = columnIndex(atomLoop.columns, "atom_id");
  const elIdx = columnIndex(atomLoop.columns, "type_symbol");
  const xIdealIdx = columnIndex(atomLoop.columns, "pdbx_model_Cartn_x_ideal");
  const yIdealIdx = columnIndex(atomLoop.columns, "pdbx_model_Cartn_y_ideal");
  const zIdealIdx = columnIndex(atomLoop.columns, "pdbx_model_Cartn_z_ideal");
  const xModelIdx = columnIndex(atomLoop.columns, "model_Cartn_x");
  const yModelIdx = columnIndex(atomLoop.columns, "model_Cartn_y");
  const zModelIdx = columnIndex(atomLoop.columns, "model_Cartn_z");

  if (idIdx < 0 || elIdx < 0) {
    throw new CifError("PARSE", "CIF atom loop is missing required columns.");
  }

  const atoms: Atom[] = [];
  for (const row of atomLoop.rows) {
    const atomId = row[idIdx];
    const element = row[elIdx];
    if (!atomId || !element) {
      continue;
    }
    const x = pickCoord(row[xIdealIdx], row[xModelIdx]);
    const y = pickCoord(row[yIdealIdx], row[yModelIdx]);
    const z = pickCoord(row[zIdealIdx], row[zModelIdx]);
    if (x === null || y === null || z === null) {
      continue;
    }
    atoms.push({ id: atomId, element, x, y, z });
  }

  if (atoms.length === 0) {
    throw new CifError("PARSE", "No valid atoms with coordinates found.");
  }

  const bonds: Bond[] = [];
  const bondLoop = loops.get("_chem_comp_bond") ?? parseSingleRow(lines, "_chem_comp_bond");
  if (bondLoop) {
    const a1Idx = columnIndex(bondLoop.columns, "atom_id_1");
    const a2Idx = columnIndex(bondLoop.columns, "atom_id_2");
    const orderIdx = columnIndex(bondLoop.columns, "value_order");
    if (a1Idx >= 0 && a2Idx >= 0) {
      const known = new Set(atoms.map((atom) => atom.id));
      for (const row of bondLoop.rows) {
        const a = row[a1Idx];
        const b = row[a2Idx];
        if (!a || !b || !known.has(a) || !known.has(b)) {
          continue;
        }
        bonds.push({ a, b, order: orderIdx >= 0 ? parseOrder(row[orderIdx]) : 1 });
      }
    }
  }

  return { id, atoms, bonds };
}

export async function loadMolecule(id: string): Promise<Molecule> {
  const text = await fetchLigandCif(id);
  return parseCif(text, id);
}
