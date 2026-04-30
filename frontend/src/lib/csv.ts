/*
 * Tiny CSV parser. Handles:
 *   - quoted fields with embedded commas
 *   - escaped quotes ("")
 *   - CRLF or LF
 *   - trailing newline
 *
 * For a UI mock this is enough. Backend will use a proper parser.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let i = 0;
  const len = text.length;
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      lines.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const [headers, ...rest] = lines;
  // Trim and skip empty trailing rows
  const rows = rest.filter((r) => r.some((c) => c.trim().length > 0));
  return { headers: headers.map((h) => h.trim()), rows };
}

/* Phone number normalization. Returns the E.164 form if valid, else null. */
export function normalizeIndianPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '+91' + digits;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits[1])) {
    return '+91' + digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) {
    return '+' + digits;
  }
  if (digits.length === 13 && digits.startsWith('091') && /^[6-9]/.test(digits[3])) {
    return '+' + digits.slice(1);
  }
  return null;
}

export function autoDetectPhoneColumn(headers: string[]): number | null {
  const idx = headers.findIndex((h) => /phone|mobile|number|contact/i.test(h));
  return idx >= 0 ? idx : null;
}

export interface CsvValidation {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
}

export function validateCsv(rows: string[][], phoneColIndex: number): CsvValidation {
  const seen = new Set<string>();
  let valid = 0;
  let invalid = 0;
  let dup = 0;
  for (const row of rows) {
    const cell = row[phoneColIndex] ?? '';
    const norm = normalizeIndianPhone(cell);
    if (!norm) {
      invalid++;
      continue;
    }
    if (seen.has(norm)) {
      dup++;
      continue;
    }
    seen.add(norm);
    valid++;
  }
  return {
    totalRows: rows.length,
    validRows: valid,
    invalidRows: invalid,
    duplicates: dup,
  };
}
