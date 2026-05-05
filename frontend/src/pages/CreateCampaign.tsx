import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import type { VoiceAgent, ContactList, CampaignSchedule } from '@/types';
import { getVoiceAgents, createCampaign } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/features/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label, HelperText } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Radio } from '@/components/ui/Radio';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  parseCsv,
  autoDetectPhoneColumn,
  validateCsv,
  type CsvValidation,
} from '@/lib/csv';
import { formatNumber, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

type ScheduleType = 'immediate' | 'scheduled';

const VAR_OPTIONS = [
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

interface CsvState {
  fileName: string;
  fileSize: number;
  parsedAt: string;
  headers: string[];
  rows: string[][];
  /** mapping by column index → variable */
  mapping: Record<number, string>;
}

export default function CreateCampaign() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();

  // Section 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voiceAgentId, setVoiceAgentId] = useState('');
  const [agents, setAgents] = useState<VoiceAgent[] | null>(null);

  // Section 2
  const [csv, setCsv] = useState<CsvState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Section 3
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [startsAt, setStartsAt] = useState('');

  // Confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    getVoiceAgents(activeWorkspace.id).then(setAgents);
  }, [activeWorkspace]);

  // ── CSV handling ───────────────────────────────────────────────────
  function handleFile(file: File) {
    setCsvError(null);
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        setCsvError('Could not parse this file as CSV.');
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
      setCsvError('Could not read this file.');
      setParsing(false);
    };
    reader.readAsText(file);
  }

  function setMapping(colIndex: number, variable: string) {
    if (!csv) return;
    const next = { ...csv.mapping };
    // Enforce: phone_number can map to exactly one column.
    if (variable === 'phone_number') {
      Object.keys(next).forEach((k) => {
        if (next[Number(k)] === 'phone_number') next[Number(k)] = '__skip__';
      });
    }
    next[colIndex] = variable;
    setCsv({ ...csv, mapping: next });
  }

  // ── Validation ─────────────────────────────────────────────────────
  const phoneColIndex = useMemo(() => {
    if (!csv) return null;
    const entry = Object.entries(csv.mapping).find(([, v]) => v === 'phone_number');
    return entry ? Number(entry[0]) : null;
  }, [csv]);

  const validation: CsvValidation | null = useMemo(() => {
    if (!csv || phoneColIndex == null) return null;
    return validateCsv(csv.rows, phoneColIndex);
  }, [csv, phoneColIndex]);

  const canLaunch = useMemo(() => {
    if (!name.trim()) return false;
    if (!voiceAgentId) return false;
    if (!csv) return false;
    if (phoneColIndex == null) return false;
    if (!validation || validation.validRows === 0) return false;
    if (scheduleType === 'scheduled' && !startsAt) return false;
    return true;
  }, [name, voiceAgentId, csv, phoneColIndex, validation, scheduleType, startsAt]);

  const canSaveDraft = useMemo(() => name.trim().length > 0, [name]);

  // ── Submit ─────────────────────────────────────────────────────────
  async function submit(asDraft: boolean) {
    if (!activeWorkspace) return;
    if (!asDraft && !canLaunch) return;
    setSubmitting(true);
    try {
      const colMap: Record<string, string> = {};
      if (csv) {
        Object.entries(csv.mapping).forEach(([k, v]) => {
          if (v !== '__skip__') colMap[csv.headers[Number(k)]] = v;
        });
      }
      const contactList: ContactList = csv
        ? {
            fileName: csv.fileName,
            uploadedAt: csv.parsedAt,
            totalRows: validation?.totalRows ?? csv.rows.length,
            validRows: validation?.validRows ?? 0,
            invalidRows: validation?.invalidRows ?? 0,
            duplicates: validation?.duplicates ?? 0,
            columnMapping: colMap,
          }
        : {
            fileName: 'draft.csv',
            uploadedAt: new Date().toISOString(),
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            duplicates: 0,
            columnMapping: {},
          };
      const schedule: CampaignSchedule =
        scheduleType === 'scheduled'
          ? { type: 'scheduled', startsAt: new Date(startsAt).toISOString(), timezone: activeWorkspace.timezone }
          : { type: 'immediate', timezone: activeWorkspace.timezone };

      const created = await createCampaign(
        activeWorkspace.id,
        { name: name.trim(), description: description.trim() || undefined, voiceAgentId, contactList, schedule },
        asDraft,
      );

      if (asDraft) {
        toast.success('Saved as draft', `'${created.name}' is saved. You can launch it later.`);
        navigate('/campaigns');
      } else {
        toast.success('Campaign launched', `'${created.name}' is now ${created.status === 'scheduled' ? 'scheduled' : 'running'}.`);
        navigate(`/campaigns/${created.id}`);
      }
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (!activeWorkspace) return null;

  const validCount = validation?.validRows ?? 0;
  const selectedAgent = agents?.find((a) => a.id === voiceAgentId) ?? null;

  return (
    <>
      <PageHeader
        title="New campaign"
        subtitle="Upload a contact list, pick a voice agent, schedule, and launch."
        actions={
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/campaigns')}
          >
            Back to campaigns
          </Button>
        }
      />

      <div className="space-y-6 max-w-4xl">
        {/* 7.1 BASICS */}
        <Section title="Campaign basics" description="Name your campaign and choose a voice agent.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="name" required>Campaign name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                placeholder="e.g. EMI Reminder — May 2026"
                maxLength={80}
              />
              <HelperText>{name.length}/80</HelperText>
            </div>

            <div>
              <Label htmlFor="agent" required>Voice agent</Label>
              {agents === null ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  id="agent"
                  value={voiceAgentId}
                  onChange={(e) => setVoiceAgentId(e.target.value)}
                >
                  <option value="" disabled>Choose an agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.voice} ({a.language})
                    </option>
                  ))}
                </Select>
              )}
              {selectedAgent && (
                <HelperText>{selectedAgent.description}</HelperText>
              )}
            </div>
          </div>

          <div className="mt-5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="What's this campaign for?"
              maxLength={200}
            />
            <HelperText>{description.length}/200</HelperText>
          </div>
        </Section>

        {/* 7.2 CONTACT LIST */}
        <Section title="Contact list" description="Drop a CSV with phone numbers and any contact attributes.">
          {!csv && !parsing && (
            <FileDropzone
              accept=".csv"
              maxSizeMb={5}
              onFile={handleFile}
              onError={(msg) => setCsvError(msg)}
            />
          )}

          {parsing && (
            <div className="border-2 border-dashed border-blue-500/40 bg-blue-50/30 rounded-xl px-6 py-10 flex flex-col items-center text-center">
              <RefreshCw size={20} className="animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium text-text-primary">Parsing CSV...</p>
            </div>
          )}

          {csvError && !parsing && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-danger-50 border border-danger-500/20 px-3 py-2 text-sm text-danger-700">
              <AlertTriangle size={16} /> {csvError}
            </div>
          )}

          {csv && !parsing && (
            <CsvMappingPanel
              csv={csv}
              setMapping={setMapping}
              phoneColIndex={phoneColIndex}
              validation={validation}
              onReplace={() => { setCsv(null); setCsvError(null); }}
            />
          )}
        </Section>

        {/* 7.3 SCHEDULE */}
        <Section title="Schedule" description={`All times in ${activeWorkspace.timezone}.`}>
          <div className="space-y-3">
            <Radio
              id="immediate"
              name="schedule"
              value="immediate"
              checked={scheduleType === 'immediate'}
              onChange={() => setScheduleType('immediate')}
              label="Launch immediately"
              helper="Calls start as soon as the campaign is launched."
            />
            <Radio
              id="scheduled"
              name="schedule"
              value="scheduled"
              checked={scheduleType === 'scheduled'}
              onChange={() => setScheduleType('scheduled')}
              label="Schedule for"
              helper="Choose a specific date and time."
            />

            {scheduleType === 'scheduled' && (
              <div className="ml-6 mt-2 max-w-xs">
                <Input
                  type="datetime-local"
                  leftIcon={<Calendar size={14} />}
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                {startsAt && (
                  <HelperText>
                    Calls will start at:{' '}
                    <span className="font-medium text-text-primary">
                      {formatDateTime(new Date(startsAt).toISOString(), activeWorkspace)}
                    </span>
                  </HelperText>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle">
          <Button
            variant="ghost"
            onClick={() => submit(true)}
            disabled={!canSaveDraft || submitting}
          >
            Save as draft
          </Button>
          <Button
            disabled={!canLaunch || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            {scheduleType === 'scheduled' ? 'Schedule campaign' : 'Launch campaign'}
          </Button>
        </div>
      </div>

      {/* 7.7 CONFIRMATION MODAL */}
      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={scheduleType === 'scheduled' ? 'Schedule this campaign?' : 'Launch this campaign?'}
        description={scheduleType === 'scheduled'
          ? 'Once scheduled, the campaign will start automatically at the chosen time.'
          : "We'll start placing calls right away. Make sure your contact list and timing are correct."}
        size="md"
        dismissable={!submitting}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => submit(false)} loading={submitting}>
              {scheduleType === 'scheduled' ? 'Schedule now' : 'Launch now'}
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-border-subtle">
          <SummaryRow term="Name"             definition={name} />
          <SummaryRow term="Agent"            definition={selectedAgent?.name ?? '—'} />
          <SummaryRow term="Contacts"         definition={`${formatNumber(validCount, activeWorkspace)} valid`} />
          <SummaryRow
            term="Starts"
            definition={
              scheduleType === 'scheduled' && startsAt
                ? formatDateTime(new Date(startsAt).toISOString(), activeWorkspace)
                : 'Immediately'
            }
          />
        </dl>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-start gap-3 mb-5">
        {icon && (
          <div className="h-8 w-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          {description && <p className="text-sm text-text-tertiary mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function SummaryRow({ term, definition }: { term: string; definition: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-text-tertiary">{term}</dt>
      <dd className="text-text-primary font-medium tabular truncate">{definition}</dd>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// CSV mapping panel — column → variable + preview + validation
// ────────────────────────────────────────────────────────────────────
function CsvMappingPanel({
  csv,
  setMapping,
  phoneColIndex,
  validation,
  onReplace,
}: {
  csv: CsvState;
  setMapping: (colIndex: number, variable: string) => void;
  phoneColIndex: number | null;
  validation: CsvValidation | null;
  onReplace: () => void;
}) {
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
          Match each column to a variable. <span className="text-danger-700 font-medium">Phone number is required and must map to exactly one column.</span>
        </p>
        <div className="rounded-md border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-25 border-b border-border-subtle">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">CSV column</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">Sample</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide w-64">Variable</th>
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
        <h4 className="text-sm font-semibold text-text-primary mb-2">Preview (first 10 rows)</h4>
        <div className="rounded-md border border-border-subtle overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-25 border-b border-border-subtle">
              <tr>
                {csv.headers.map((h, i) => {
                  const v = csv.mapping[i];
                  return (
                    <th key={i} className="text-left px-3 py-2 font-medium text-text-primary whitespace-nowrap">
                      <div>{h}</div>
                      <div className={cn(
                        'text-[10px] uppercase tracking-wide font-semibold mt-0.5',
                        v === '__skip__' ? 'text-text-tertiary'
                          : v === 'phone_number' ? 'text-blue-600' : 'text-brand-700',
                      )}>
                        {v === '__skip__' ? 'Skipped' : VAR_OPTIONS.find((o) => o.value === v)?.label.split(' ')[0]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {csv.rows.slice(0, 10).map((row, ri) => (
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
          <ValidationStat
            tone="neutral"
            label="Total rows"
            value={validation.totalRows.toLocaleString('en-IN')}
          />
          <ValidationStat
            tone="success"
            label="Valid"
            value={validation.validRows.toLocaleString('en-IN')}
            icon={<CheckCircle2 size={14} />}
          />
          <ValidationStat
            tone="danger"
            label="Invalid"
            value={validation.invalidRows.toLocaleString('en-IN')}
            icon={<AlertTriangle size={14} />}
          />
          <ValidationStat
            tone="warning"
            label="Duplicates"
            value={validation.duplicates.toLocaleString('en-IN')}
          />
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
