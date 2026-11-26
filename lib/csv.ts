// A small CSV reader (no extra packages: 01-prd.md §8). Handles quoted
// fields, "" inside quotes, commas and line breaks inside quotes, CRLF, a
// byte-order mark, and blank lines.

export function parseCSV(text: string): string[][] {
  const s = String(text ?? "").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// Header names compared loosely: "Short_Description " → "short description".
export function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-\s]+/g, " ");
}

// Turns rows into objects keyed by the header row. `aliases` maps each
// known field to the header names that mean it. Columns that match no alias
// go to `extra`, keyed by their header as written.
export function readTable<K extends string>(
  text: string,
  aliases: Record<K, string[]>,
): { rows: { known: Partial<Record<K, string>>; extra: Record<string, string> }[]; hasHeader: boolean } {
  const all = parseCSV(text);
  if (!all.length) return { rows: [], hasHeader: false };
  const header = all[0].map((h) => h.trim());
  const lookup = new Map<string, K>();
  for (const [field, names] of Object.entries(aliases) as [K, string[]][]) {
    for (const n of names) lookup.set(normHeader(n), field);
  }
  const cols = header.map((h) => lookup.get(normHeader(h)) ?? null);
  const used = new Set<K>();
  const map = cols.map((k) => {
    if (k && !used.has(k)) {
      used.add(k);
      return k;
    }
    return null; // a repeated known column is treated as extra
  });
  const rows = all.slice(1).map((r) => {
    const known: Partial<Record<K, string>> = {};
    const extra: Record<string, string> = {};
    header.forEach((h, i) => {
      const v = (r[i] ?? "").trim();
      const k = map[i];
      if (k) known[k] = v;
      else if (h && v) extra[h] = v;
    });
    return { known, extra };
  });
  return { rows, hasHeader: map.some(Boolean) };
}
