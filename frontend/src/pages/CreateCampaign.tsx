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
  CampaignGoal,
  RetryPolicy,
} from '@/types';
import { DEFAULT_RETRY_POLICY } from '@/types';
import { createCampaign } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/features/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, HelperText } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Radio } from '@/components/ui/Radio';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { CsvMappingPanel } from '@/components/features/CsvMappingPanel';
import { RetryPolicyEditor } from '@/components/features/RetryPolicyEditor';
import { useCsvUpload, buildColumnMapping } from '@/lib/csvUpload';
import { formatNumber, formatDateTime } from '@/lib/format';
import { intentLabel, INTENT_LABEL } from '@/lib/labels';
import { cn } from '@/lib/cn';

type ScheduleType = 'immediate' | 'scheduled';

export default function CreateCampaign() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();

  // Section 1
  const [name, setName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTargetIntent, setGoalTargetIntent] = useState<string>('payment_promised');

  // Section 2 — CSV
  const upload = useCsvUpload();
  const { csv, parsing, error: csvError, phoneColIndex, validation, handleFile, setMapping, clear: clearCsv, setError: setCsvError } = upload;

  // Section 3 — schedule
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [startsAt, setStartsAt] = useState('');

  // Section 4 — feedback intents (which post-call outcomes to track)
  const [feedbackIntents, setFeedbackIntents] = useState<string[]>([]);

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

      const goalText = goalDescription.trim();
      const goal: CampaignGoal | undefined = goalText
        ? { description: goalText, targetIntent: goalTargetIntent }
        : undefined;

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
          goal,
          feedbackIntents: (() => {
            const cleaned = feedbackIntents.map((s) => s.trim()).filter(Boolean);
            return cleaned.length ? cleaned : undefined;
          })(),
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
        <Section title="Campaign basics" description="Name the campaign and define what success looks like.">
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
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              rows={2}
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value.slice(0, 200))}
              placeholder="What does success look like? e.g. Lock in payment commitments before the EMI date."
              maxLength={200}
            />
            <HelperText>
              {goalDescription.length}/200 — surfaces as a Goal card on the campaign's analytics view.
            </HelperText>
          </div>

          {goalDescription.trim().length > 0 && (
            <div className="mt-4">
              <Label htmlFor="goal-target">Counts as goal met when call intent is</Label>
              <Select
                id="goal-target"
                value={goalTargetIntent}
                onChange={(e) => setGoalTargetIntent(e.target.value)}
              >
                {Object.keys(INTENT_LABEL).map((i) => (
                  <option key={i} value={i}>{intentLabel(i)}</option>
                ))}
              </Select>
              <HelperText>
                Analytics will report % of answered calls that hit this intent.
              </HelperText>
            </div>
          )}
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
            term="Goal"
            definition={
              goalDescription.trim()
                ? `${goalDescription.trim()} · met when intent is ${intentLabel(goalTargetIntent)}`
                : 'Not set'
            }
          />
          <SummaryRow
            term="Feedback intents"
            definition={(() => {
              const cleaned = feedbackIntents.map((s) => s.trim()).filter(Boolean);
              return cleaned.length ? cleaned.join(' · ') : 'None';
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
// Feedback intents section — operator types in the post-call outcomes
// they want to actively track. One input per row; "+ Add intent" adds
// another row, "Remove" drops a row. Free text — operators may know
// outcomes that are specific to their funnel.
// ────────────────────────────────────────────────────────────────────
interface FeedbackIntentsSectionProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function FeedbackIntentsSection({ value, onChange }: FeedbackIntentsSectionProps) {
  // Always show at least one input row, even when nothing has been
  // typed yet. Empty rows are filtered out at submit time.
  const rows = value.length > 0 ? value : [''];

  const setRow = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
  };

  const addRow = () => onChange([...rows, '']);

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
            Add the post-call outcomes you want to track closely.{' '}
            <span className="text-text-secondary">
              For example: <em className="not-italic font-medium">KYC completed on call</em>,{' '}
              <em className="not-italic font-medium">Application submitted</em>,{' '}
              <em className="not-italic font-medium">Call me later</em>.
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <Input
              placeholder="e.g. KYC completed on call"
              value={row}
              onChange={(e) => setRow(i, e.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1 && row === ''}
              className={cn(
                'text-sm font-medium transition-colors shrink-0',
                rows.length === 1 && row === ''
                  ? 'text-text-tertiary opacity-40 cursor-not-allowed'
                  : 'text-danger-700 hover:text-danger-500',
              )}
            >
              Remove
            </button>
          </div>
        ))}
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
