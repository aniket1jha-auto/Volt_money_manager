/*
 * Shared CSV upload state + parsing for the Campaign creation flow and
 * the "Add contacts to existing campaign" drawer. Both surfaces use the
 * same column → variable mapping vocabulary, the same auto-detection,
 * and the same validation rules.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  parseCsv,
  autoDetectPhoneColumn,
  validateCsv,
  type CsvValidation,
} from './csv';

export const VAR_OPTIONS: { value: string; label: string }[] = [
  { value: '__skip__',         label: "Don't import" },
  { value: 'phone_number',     label: 'Phone number  (required)' },
  { value: 'customer_name',    label: 'Customer name' },
  { value: 'loan_amount',      label: 'Loan amount' },
  { value: 'due_date',         label: 'Due date' },
  { value: 'last_interaction', label: 'Last interaction' },
  { value: 'custom_var_1',     label: 'Custom variable 1' },
  { value: 'custom_var_2',     label: 'Custom variable 2' },
  { value: 'custom_var_3',     label: 'Custom variable 3' },
  { value: 'custom_var_4',     label: 'Custom variable 4' },
  { value: 'custom_var_5',     label: 'Custom variable 5' },
];

export interface CsvState {
  fileName: string;
  fileSize: number;
  parsedAt: string;
  headers: string[];
  rows: string[][];
  /** mapping by column index → variable */
  mapping: Record<number, string>;
}

export interface UseCsvUploadReturn {
  csv: CsvState | null;
  parsing: boolean;
  error: string | null;
  /** index of the column currently mapped to phone_number (or null) */
  phoneColIndex: number | null;
  validation: CsvValidation | null;
  /** Read a File, parse, auto-detect mappings, and load into state. */
  handleFile: (file: File) => void;
  setMapping: (colIndex: number, variable: string) => void;
  clear: () => void;
  setError: (msg: string | null) => void;
}

export function useCsvUpload(): UseCsvUploadReturn {
  const [csv, setCsv] = useState<CsvState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        setError('Could not parse this file as CSV.');
        setParsing(false);
        return;
      }
      // 200ms parse simulation for realism
      setTimeout(() => {
        const phoneIdx = autoDetectPhoneColumn(headers);
        const mapping: Record<number, string> = {};
        headers.forEach((_, i) => { mapping[i] = '__skip__'; });
        if (phoneIdx != null) mapping[phoneIdx] = 'phone_number';

        // Auto-suggest other common columns
        headers.forEach((h, i) => {
          if (mapping[i] !== '__skip__') return;
          const lower = h.toLowerCase();
          if (/name/.test(lower)) mapping[i] = 'customer_name';
          else if (/amount|principal|emi/.test(lower)) mapping[i] = 'loan_amount';
          else if (/due|date/.test(lower)) mapping[i] = 'due_date';
          else if (/last/.test(lower)) mapping[i] = 'last_interaction';
        });

        setCsv({
          fileName: file.name,
          fileSize: file.size,
          parsedAt: new Date().toISOString(),
          headers,
          rows,
          mapping,
        });
        setParsing(false);
      }, 200);
    };
    reader.onerror = () => {
      setError('Could not read this file.');
      setParsing(false);
    };
    reader.readAsText(file);
  }, []);

  const setMapping = useCallback((colIndex: number, variable: string) => {
    setCsv((cur) => {
      if (!cur) return cur;
      const next = { ...cur.mapping };
      // Enforce: phone_number can map to exactly one column.
      if (variable === 'phone_number') {
        Object.keys(next).forEach((k) => {
          if (next[Number(k)] === 'phone_number') next[Number(k)] = '__skip__';
        });
      }
      next[colIndex] = variable;
      return { ...cur, mapping: next };
    });
  }, []);

  const clear = useCallback(() => {
    setCsv(null);
    setError(null);
  }, []);

  const phoneColIndex = useMemo(() => {
    if (!csv) return null;
    const entry = Object.entries(csv.mapping).find(([, v]) => v === 'phone_number');
    return entry ? Number(entry[0]) : null;
  }, [csv]);

  const validation = useMemo(() => {
    if (!csv || phoneColIndex == null) return null;
    return validateCsv(csv.rows, phoneColIndex);
  }, [csv, phoneColIndex]);

  return {
    csv,
    parsing,
    error,
    phoneColIndex,
    validation,
    handleFile,
    setMapping,
    clear,
    setError,
  };
}

/** Build the columnMapping shape for ContactList from a CsvState. */
export function buildColumnMapping(csv: CsvState): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(csv.mapping).forEach(([k, v]) => {
    if (v !== '__skip__') out[csv.headers[Number(k)]] = v;
  });
  return out;
}
