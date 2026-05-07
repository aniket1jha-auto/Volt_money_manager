import { useEffect, useMemo, useState } from 'react';
import {
  X,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Rocket,
} from 'lucide-react';
import type {
  Campaign,
  ContactList,
  CampaignSchedule,
  RetryPolicy,
  Workspace,
} from '@/types';
import { DEFAULT_RETRY_POLICY } from '@/types';
import { startCampaignRun } from '@/lib/api';
import { useCsvUpload, buildColumnMapping } from '@/lib/csvUpload';
import { CsvMappingPanel } from '@/components/features/CsvMappingPanel';
import { RetryPolicyEditor } from '@/components/features/RetryPolicyEditor';
import { useToast } from '@/components/ui/Toast';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Input, HelperText } from '@/components/ui/Input';
import { Radio } from '@/components/ui/Radio';
import { formatNumber, formatDateTime } from '@/lib/format';

type ScheduleType = 'immediate' | 'scheduled';

interface NewRunDrawerProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  workspace: Workspace;
  /** Called after a successful start so the parent can re-fetch. */
  onStarted: (campaign: Campaign) => void;
}

/*
 * Drawer for queueing a new run on an existing campaign. Mirrors the
 * upload + schedule + retry flow from the New Campaign page (CSV upload
 * → column mapping → validation → schedule → retry policy → submit) but
 * lives in a 720px right-side drawer so the user stays anchored to the
 * campaign they're editing. Submitted retry policy becomes the
 * campaign's new default and is snapshot-saved on the run record.
 */
export function NewRunDrawer({
  open,
  onClose,
  campaign,
  workspace,
  onStarted,
}: NewRunDrawerProps) {
  const toast = useToast();
  const upload = useCsvUpload();
  const {
    csv,
    parsing,
    error: csvError,
    phoneColIndex,
    validation,
    handleFile,
    setMapping,
    clear: clearCsv,
    setError: setCsvError,
  } = upload;

  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [startsAt, setStartsAt] = useState('');
  const [retryPolicy, setRetryPolicy] = useState<RetryPolicy>(
    campaign.retryPolicy ?? DEFAULT_RETRY_POLICY,
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset whenever the drawer opens for a (potentially new) campaign.
  useEffect(() => {
    if (!open) return;
    clearCsv();
    setScheduleType('immediate');
    setStartsAt('');
    setRetryPolicy(campaign.retryPolicy ?? DEFAULT_RETRY_POLICY);
    setSubmitting(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign.id]);

  const canSubmit = useMemo(() => {
    if (!csv) return false;
    if (phoneColIndex == null) return false;
    if (!validation || validation.validRows === 0) return false;
    if (scheduleType === 'scheduled' && !startsAt) return false;
    return true;
  }, [csv, phoneColIndex, validation, scheduleType, startsAt]);

  async function submit() {
    if (!csv || !canSubmit) return;
    setSubmitting(true);
    try {
      const contactList: ContactList = {
        fileName: csv.fileName,
        uploadedAt: csv.parsedAt,
        totalRows: validation?.totalRows ?? csv.rows.length,
        validRows: validation?.validRows ?? 0,
        invalidRows: validation?.invalidRows ?? 0,
        duplicates: validation?.duplicates ?? 0,
        columnMapping: buildColumnMapping(csv),
      };
      const schedule: CampaignSchedule =
        scheduleType === 'scheduled'
          ? {
              type: 'scheduled',
              startsAt: new Date(startsAt).toISOString(),
              timezone: workspace.timezone,
            }
          : { type: 'immediate', timezone: workspace.timezone };

      const { campaign: updated, run } = await startCampaignRun(workspace.id, campaign.id, {
        contactList,
        schedule,
        retryPolicy,
      });

      const verb = run.status === 'queued' ? 'scheduled' : 'queued';
      toast.success(
        `Run ${verb}`,
        `${formatNumber(contactList.validRows, workspace)} contacts on '${campaign.name}'.`,
      );
      onStarted(updated);
      onClose();
    } catch (err) {
      toast.error(
        'Could not start the run',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const validCount = validation?.validRows ?? 0;

  return (
    <Drawer open={open} onClose={onClose} width={720}>
      {/* Header */}
      <header className="px-5 py-4 border-b border-border-subtle flex items-start gap-3 shrink-0">
        <div className="h-10 w-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
          <Rocket size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-text-primary truncate">
            Start a new run
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">
            {campaign.name} · {formatNumber(campaign.metrics.baseUploaded, workspace)} contacts so far
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          disabled={submitting}
          className="p-1.5 -mr-1 rounded text-text-tertiary hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </header>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* CSV upload */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Upload CSV
            </h3>
            {!csv && !parsing && (
              <FileDropzone
                accept=".csv"
                maxSizeMb={5}
                onFile={handleFile}
                onError={(msg) => setCsvError(msg)}
              />
            )}

            {parsing && (
              <div className="border-2 border-dashed border-blue-500/40 bg-blue-50/30 rounded-xl px-6 py-8 flex flex-col items-center text-center">
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
                previewRows={5}
              />
            )}
          </section>

          {/* Schedule */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Schedule</h3>
            <p className="text-xs text-text-tertiary mb-3">
              All times in {workspace.timezone}.
            </p>
            <div className="space-y-3">
              <Radio
                id="nr-immediate"
                name="nr-schedule"
                value="immediate"
                checked={scheduleType === 'immediate'}
                onChange={() => setScheduleType('immediate')}
                label="Start calling immediately"
                helper="Calls go out as soon as the run is queued."
              />
              <Radio
                id="nr-scheduled"
                name="nr-schedule"
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
                        {formatDateTime(new Date(startsAt).toISOString(), workspace)}
                      </span>
                    </HelperText>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Retry policy */}
          <RetryPolicyEditor value={retryPolicy} onChange={setRetryPolicy} compact />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-slate-25 px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-text-tertiary tabular">
          {csv && validation
            ? <>
                <span className="font-semibold text-text-primary">
                  {formatNumber(validCount, workspace)}
                </span>{' '}
                valid contacts ready
              </>
            : 'Upload a CSV to continue'}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || submitting} loading={submitting}>
            {scheduleType === 'scheduled' ? 'Schedule run' : 'Start run'}
          </Button>
        </div>
      </footer>
    </Drawer>
  );
}
