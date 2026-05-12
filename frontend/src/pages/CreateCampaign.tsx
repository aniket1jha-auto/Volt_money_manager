import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Inbox,
  Plus,
} from 'lucide-react';
import type {
  ContactList,
  CampaignSchedule,
  FeedbackIntent,
  RetryPolicy,
} from '@/types';
import { DEFAULT_RETRY_POLICY } from '@/types';
import { createCampaign } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/features/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label, HelperText } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Radio } from '@/components/ui/Radio';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { CsvMappingPanel } from '@/components/features/CsvMappingPanel';
import { RetryPolicyEditor } from '@/components/features/RetryPolicyEditor';
import { useCsvUpload, buildColumnMapping } from '@/lib/csvUpload';
import { formatNumber, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

type ScheduleType = 'immediate' | 'scheduled';

export default function CreateCampaign() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();

  // Section 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Section 2 — CSV
  const upload = useCsvUpload();
  const { csv, parsing, error: csvError, phoneColIndex, validation, handleFile, setMapping, clear: clearCsv, setError: setCsvError } = upload;

  // Section 3 — schedule
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [startsAt, setStartsAt] = useState('');

  // Section 4 — feedback intents (which post-call outcomes to track).
  // Each entry has a short name plus a longer description used by the
  // backend LLM to classify each call's outcome against the operator's
  // vocabulary instead of a generic one.
  const [feedbackIntents, setFeedbackIntents] = useState<FeedbackIntent[]>([]);

  // Section 5 — retry policy
  const [retryPolicy, setRetryPolicy] = useState<RetryPolicy>(DEFAULT_RETRY_POLICY);

  // Confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canLaunch = useMemo(() => {
    if (!name.trim()) return false;
    if (!csv) return false;
    if (phoneColIndex == null) return false;
    if (!validation || validation.validRows === 0) return false;
    if (scheduleType === 'scheduled' && !startsAt) return false;
    return true;
  }, [name, csv, phoneColIndex, validation, scheduleType, startsAt]);

  // ── Submit ─────────────────────────────────────────────────────────
  async function submit() {
    if (!activeWorkspace) return;
    if (!canLaunch) return;
    setSubmitting(true);
    try {
      const contactList: ContactList = {
        fileName: csv!.fileName,
        uploadedAt: csv!.parsedAt,
        totalRows: validation?.totalRows ?? csv!.rows.length,
        validRows: validation?.validRows ?? 0,
        invalidRows: validation?.invalidRows ?? 0,
        duplicates: validation?.duplicates ?? 0,
        columnMapping: buildColumnMapping(csv!),
      };
      const schedule: CampaignSchedule =
        scheduleType === 'scheduled'
          ? { type: 'scheduled', startsAt: new Date(startsAt).toISOString(), timezone: activeWorkspace.timezone }
          : { type: 'immediate', timezone: activeWorkspace.timezone };

      const cleanedIntents = feedbackIntents
        .map((fi) => ({ name: fi.name.trim(), description: fi.description.trim() }))
        .filter((fi) => fi.name.length > 0);

      const trimmedDescription = description.trim();

      const created = await createCampaign(
        activeWorkspace.id,
        {
          name: name.trim(),
          // Voice agent is no longer surfaced at creation time — backend
          // assigns one (or the operator picks later via a different flow).
          // For the UI mock we point at the workspace's default agent.
          voiceAgentId: 'agent_loan_recovery',
          contactList,
          schedule,
          retryPolicy,
          description: trimmedDescription || undefined,
          feedbackIntents: cleanedIntents.length ? cleanedIntents : undefined,
        },
      );

      toast.success(
        'Campaign launched',
        scheduleType === 'scheduled'
          ? `'${created.name}' is scheduled.`
          : `'${created.name}' is now active.`,
      );
      navigate(`/campaigns/${created.id}`);
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (!activeWorkspace) return null;

  const validCount = validation?.validRows ?? 0;

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
        <Section title="Campaign basics" description="Name the campaign and describe what it's for.">
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

          <div className="mt-5">
            <Label htmlFor="description">Campaign description</Label>
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 240))}
              placeholder="What is this campaign for? e.g. Outbound calls to remind customers about upcoming EMI due dates."
              maxLength={240}
            />
            <HelperText>
              {description.length}/240 — a short, plain-English summary for context.
            </HelperText>
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
              onReplace={clearCsv}
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

        {/* 7.4 FEEDBACK INTENTS */}
        <FeedbackIntentsSection
          value={feedbackIntents}
          onChange={setFeedbackIntents}
        />

        {/* 7.5 RETRY POLICY */}
        <RetryPolicyEditor value={retryPolicy} onChange={setRetryPolicy} />

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle">
          <Button
            variant="ghost"
            onClick={() => navigate('/campaigns')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            disabled={!canLaunch || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            {scheduleType === 'scheduled' ? 'Schedule campaign' : 'Launch campaign'}
          </Button>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
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
            <Button onClick={() => submit()} loading={submitting}>
              {scheduleType === 'scheduled' ? 'Schedule now' : 'Launch now'}
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-border-subtle">
          <SummaryRow term="Name"     definition={name} />
          <SummaryRow term="Contacts" definition={`${formatNumber(validCount, activeWorkspace)} valid`} />
          <SummaryRow
            term="Starts"
            definition={
              scheduleType === 'scheduled' && startsAt
                ? formatDateTime(new Date(startsAt).toISOString(), activeWorkspace)
                : 'Immediately'
            }
          />
          <SummaryRow
            term="Retries"
            definition={
              retryPolicy.enabled
                ? `${retryPolicy.maxAttempts} attempt${retryPolicy.maxAttempts === 1 ? '' : 's'} · every ${retryPolicy.intervalMinutes < 60 ? `${retryPolicy.intervalMinutes}m` : `${(retryPolicy.intervalMinutes / 60).toFixed(0)}h`}`
                : 'Off'
            }
          />
          <SummaryRow
            term="Description"
            definition={description.trim() || 'Not set'}
          />
          <SummaryRow
            term="Feedback intents"
            definition={(() => {
              const names = feedbackIntents
                .map((fi) => fi.name.trim())
                .filter(Boolean);
              return names.length ? names.join(' · ') : 'None';
            })()}
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
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-start gap-3 mb-5">
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
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-text-tertiary">{term}</dt>
      <dd className="text-text-primary font-medium tabular truncate">{definition}</dd>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Feedback intents section — operator declares the post-call outcomes
// they want to track. Each row carries two fields:
//   - Intent name        → short label surfaced in the UI / analytics
//   - What this means    → longer explanation used by the backend LLM
//                          to classify calls against this vocabulary
//
// "+ Add intent" appends a row; "Remove" drops it. Free text — every
// operator's funnel is different.
// ────────────────────────────────────────────────────────────────────
interface FeedbackIntentsSectionProps {
  value: FeedbackIntent[];
  onChange: (next: FeedbackIntent[]) => void;
}

const EMPTY_INTENT: FeedbackIntent = { name: '', description: '' };

function FeedbackIntentsSection({ value, onChange }: FeedbackIntentsSectionProps) {
  // Always show at least one input row, even when nothing has been
  // typed yet. Empty rows are filtered out at submit time.
  const rows = value.length > 0 ? value : [EMPTY_INTENT];

  const isRowEmpty = (r: FeedbackIntent) =>
    r.name.trim() === '' && r.description.trim() === '';

  const setName = (i: number, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], name: v };
    onChange(next);
  };

  const setDescription = (i: number, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], description: v };
    onChange(next);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
  };

  const addRow = () => onChange([...rows, EMPTY_INTENT]);

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Inbox size={16} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-text-primary">
            Feedback intents
          </h3>
          <p className="text-sm text-text-tertiary mt-0.5">
            Define the post-call outcomes you want to track. For each one,
            give it a short name and explain what it means — the assistant
            uses your explanation to classify every call against your
            vocabulary.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const empty = isRowEmpty(row) && rows.length === 1;
          return (
            <div
              key={i}
              className="rounded-md border border-border-subtle bg-slate-25/60 p-3 space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Intent name — e.g. KYC Completed"
                  value={row.name}
                  onChange={(e) => setName(i, e.target.value.slice(0, 60))}
                  className="flex-1 font-medium"
                  maxLength={60}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={empty}
                  className={cn(
                    'text-sm font-medium transition-colors shrink-0',
                    empty
                      ? 'text-text-tertiary opacity-40 cursor-not-allowed'
                      : 'text-danger-700 hover:text-danger-500',
                  )}
                >
                  Remove
                </button>
              </div>
              <Textarea
                rows={2}
                placeholder="What does this intent mean? e.g. Customer completed eKYC verification during the call and is ready for disbursal."
                value={row.description}
                onChange={(e) => setDescription(i, e.target.value.slice(0, 240))}
                maxLength={240}
              />
              <p className="text-[11px] text-text-tertiary">
                Helps the assistant decide when a call counts as this outcome.
                {' '}
                <span className="tabular">{row.description.length}/240</span>
              </p>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        <Plus size={14} strokeWidth={2.5} />
        Add intent
      </button>
    </Card>
  );
}
