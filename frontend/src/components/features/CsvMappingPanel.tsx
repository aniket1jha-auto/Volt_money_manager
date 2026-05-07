import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { VAR_OPTIONS, type CsvState } from '@/lib/csvUpload';
import type { CsvValidation } from '@/lib/csv';
import { cn } from '@/lib/cn';

interface CsvMappingPanelProps {
  csv: CsvState;
  setMapping: (colIndex: number, variable: string) => void;
  phoneColIndex: number | null;
  validation: CsvValidation | null;
  onReplace: () => void;
  /**
   * Limit how many preview rows to show. Defaults to 10. Useful in
   * narrower surfaces (e.g. drawers) where you may want fewer rows.
   */
  previewRows?: number;
}

/*
 * Reusable CSV mapping panel — column → variable mapping table, preview
 * rows, and a validation summary. Used from the New Campaign builder
 * and from the "Add contacts" drawer on Campaign Detail.
 */
export function CsvMappingPanel({
  csv,
  setMapping,
  phoneColIndex,
  validation,
  onReplace,
  previewRows = 10,
}: CsvMappingPanelProps) {
  return (
    <div className="space-y-5">
      {/* File header */}
      <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-slate-25 px-4 py-3">
        <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <FileText size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{csv.fileName}</div>
          <div className="text-xs text-text-tertiary">
            {(csv.fileSize / 1024).toFixed(1)} KB · {csv.headers.length} columns · {csv.rows.length.toLocaleString('en-IN')} rows
          </div>
        </div>
        <button
          onClick={onReplace}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Replace CSV
        </button>
      </div>

      {/* Mapping */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-2">Map columns</h4>
        <p className="text-xs text-text-tertiary mb-3">
          Match each column to a variable.{' '}
          <span className="text-danger-700 font-medium">
            Phone number is required and must map to exactly one column.
          </span>
        </p>
        <div className="rounded-md border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-25 border-b border-border-subtle">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">CSV column</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">Sample</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide w-56">Variable</th>
              </tr>
            </thead>
            <tbody>
              {csv.headers.map((h, i) => {
                const sample = csv.rows[0]?.[i] ?? '';
                return (
                  <tr key={i} className="border-b border-border-subtle last:border-b-0">
                    <td className="px-4 py-2 font-medium text-text-primary">{h}</td>
                    <td className="px-4 py-2 text-text-tertiary truncate max-w-[180px]">
                      <code className="font-mono text-xs">{sample}</code>
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={csv.mapping[i] ?? '__skip__'}
                        onChange={(e) => setMapping(i, e.target.value)}
                        className="h-8"
                      >
                        {VAR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-2">
          Preview (first {previewRows} rows)
        </h4>
        <div className="rounded-md border border-border-subtle overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-25 border-b border-border-subtle">
              <tr>
                {csv.headers.map((h, i) => {
                  const v = csv.mapping[i];
                  return (
                    <th key={i} className="text-left px-3 py-2 font-medium text-text-primary whitespace-nowrap">
                      <div>{h}</div>
                      <div
                        className={cn(
                          'text-[10px] uppercase tracking-wide font-semibold mt-0.5',
                          v === '__skip__'
                            ? 'text-text-tertiary'
                            : v === 'phone_number'
                              ? 'text-blue-600'
                              : 'text-brand-700',
                        )}
                      >
                        {v === '__skip__'
                          ? 'Skipped'
                          : VAR_OPTIONS.find((o) => o.value === v)?.label.split(' ')[0]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {csv.rows.slice(0, previewRows).map((row, ri) => (
                <tr key={ri} className="border-b border-border-subtle last:border-b-0">
                  {csv.headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-text-secondary whitespace-nowrap font-mono text-xs">
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation summary */}
      {phoneColIndex == null ? (
        <div className="inline-flex items-center gap-2 rounded-md bg-warning-50 border border-warning-500/20 px-3 py-2 text-sm text-warning-700">
          <AlertTriangle size={16} />
          Map a phone number column to continue.
        </div>
      ) : validation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ValidationStat tone="neutral" label="Total rows" value={validation.totalRows.toLocaleString('en-IN')} />
          <ValidationStat tone="success" label="Valid"      value={validation.validRows.toLocaleString('en-IN')}   icon={<CheckCircle2 size={14} />} />
          <ValidationStat tone="danger"  label="Invalid"    value={validation.invalidRows.toLocaleString('en-IN')} icon={<AlertTriangle size={14} />} />
          <ValidationStat tone="warning" label="Duplicates" value={validation.duplicates.toLocaleString('en-IN')} />
        </div>
      )}
    </div>
  );
}

function ValidationStat({
  tone,
  label,
  value,
  icon,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  const styles = {
    neutral: 'bg-slate-50 border-slate-200 text-slate-700',
    success: 'bg-success-50 border-success-500/20 text-success-700',
    warning: 'bg-warning-50 border-warning-500/20 text-warning-700',
    danger:  'bg-danger-50 border-danger-500/20 text-danger-700',
  } as const;
  return (
    <div className={cn('rounded-md border px-4 py-3', styles[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold opacity-80">
        {icon} {label}
      </div>
      <div className="text-xl font-semibold tabular mt-1">{value}</div>
    </div>
  );
}
