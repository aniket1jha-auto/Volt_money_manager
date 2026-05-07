import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, Search, Upload } from 'lucide-react';
import type { AudienceFile, AudienceFileStatus } from '@/types';
import { getAudienceFiles } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/features/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Table, type TableColumn } from '@/components/ui/Table';
import { formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type StatusFilter = 'all' | AudienceFileStatus;

const STATUS_SEGMENTS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending validation' },
  { value: 'validated', label: 'Validation successful' },
  { value: 'failed',    label: 'Validation failed' },
];

const SOURCE_LABEL: Record<AudienceFile['source'], string> = {
  new_campaign: 'New campaign',
  new_run:      'New run',
};

export default function Audiences() {
  const { activeWorkspace } = useWorkspace();
  const toast = useToast();

  const [files, setFiles] = useState<AudienceFile[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    setFiles(null);
    setError(null);
    getAudienceFiles(activeWorkspace.id)
      .then((items) => { if (!cancelled) setFiles(items); })
      .catch((err: Error) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [activeWorkspace, reloadTick]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const counts = useMemo(() => {
    if (!files) return null;
    const c: Record<StatusFilter, number> = {
      all: files.length, pending: 0, validated: 0, failed: 0,
    };
    for (const f of files) c[f.status] += 1;
    return c;
  }, [files]);

  const filtered = useMemo(() => {
    if (!files) return null;
    let rows = files;
    if (status !== 'all') rows = rows.filter((f) => f.status === status);
    if (search) {
      rows = rows.filter((f) =>
        f.fileName.toLowerCase().includes(search) ||
        (f.campaignName ?? '').toLowerCase().includes(search),
      );
    }
    return rows;
  }, [files, status, search]);

  if (!activeWorkspace) return null;

  const columns: TableColumn<AudienceFile>[] = [
    {
      key: 'fileName',
      header: 'File',
      width: '32%',
      cell: (f) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 border border-border-subtle">
            <FileSpreadsheet size={15} />
          </span>
          <div className="min-w-0">
            <div className="font-medium text-text-primary truncate">{f.fileName}</div>
            <div className="text-[11px] text-text-tertiary tabular">
              {formatBytes(f.fileSizeBytes)}
            </div>
          </div>
        </div>
      ),
      sort: (a, b) => a.fileName.localeCompare(b.fileName),
    },
    {
      key: 'source',
      header: 'Source',
      cell: (f) => (
        <div className="min-w-0">
          <div className="text-xs text-text-secondary">{SOURCE_LABEL[f.source]}</div>
          {f.campaignId && f.campaignName && (
            <Link
              to={`/campaigns/${f.campaignId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-700 hover:underline truncate block max-w-[220px]"
            >
              {f.campaignName}
            </Link>
          )}
          {!f.campaignId && (
            <div className="text-[11px] text-text-tertiary italic">Not yet attached</div>
          )}
        </div>
      ),
    },
    {
      key: 'totalRows',
      header: 'Rows',
      align: 'right',
      cell: (f) => (
        <span className="tabular text-text-primary">
          {f.status === 'pending' || f.status === 'failed'
            ? '—'
            : formatNumber(f.totalRows, activeWorkspace)}
        </span>
      ),
      sort: (a, b) => a.totalRows - b.totalRows,
    },
    {
      key: 'valid',
      header: 'Valid',
      align: 'right',
      cell: (f) => {
        if (f.status !== 'validated') {
          return <span className="text-text-tertiary">—</span>;
        }
        return (
          <span className="tabular text-text-primary">
            {formatNumber(f.validRows, activeWorkspace)}
          </span>
        );
      },
      sort: (a, b) => a.validRows - b.validRows,
    },
    {
      key: 'invalid',
      header: 'Invalid',
      align: 'right',
      cell: (f) => {
        if (f.status !== 'validated') {
          return <span className="text-text-tertiary">—</span>;
        }
        const bad = f.invalidRows + f.duplicates;
        return (
          <span className={cn('tabular', bad > 0 ? 'text-warning-700' : 'text-text-tertiary')}>
            {formatNumber(bad, activeWorkspace)}
          </span>
        );
      },
      sort: (a, b) =>
        (a.invalidRows + a.duplicates) - (b.invalidRows + b.duplicates),
    },
    {
      key: 'uploadedAt',
      header: 'Uploaded',
      cell: (f) => (
        <span className="text-xs text-text-secondary tabular">
          {formatRelative(f.uploadedAt)}
        </span>
      ),
      sort: (a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (f) => <StatusBadge status={f.status} />,
      sort: (a, b) => a.status.localeCompare(b.status),
    },
    {
      key: 'download',
      header: '',
      align: 'right',
      width: 100,
      cell: (f) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.success(
              'Download started',
              `${f.fileName} will be saved to your computer.`,
            );
          }}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors',
            'border border-border-subtle bg-surface',
            'text-text-secondary hover:text-text-primary hover:bg-slate-50',
          )}
          title={`Download ${f.fileName}`}
        >
          <Download size={13} /> Download
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audience list"
        subtitle="Every contact file uploaded for a new campaign or a new run, with its validation status."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SegmentedControl<StatusFilter>
          value={status}
          onChange={setStatus}
          segments={STATUS_SEGMENTS.map((s) => ({
            ...s,
            count: counts ? counts[s.value] : undefined,
          }))}
        />
        <div className="flex-1 min-w-[240px] max-w-sm">
          <Input
            placeholder="Search by file or campaign..."
            leftIcon={<Search size={16} />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Could not load audience files"
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      ) : files === null ? (
        <Card padding="md">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : (filtered?.length ?? 0) === 0 ? (
        <EmptyState filtersActive={status !== 'all' || !!search} />
      ) : (
        <Table<AudienceFile>
          columns={columns}
          rows={filtered ?? []}
          rowKey={(f) => f.id}
          defaultSort={{ key: 'uploadedAt', dir: 'desc' }}
          emptyText="No audience files match your filters."
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: AudienceFileStatus }) {
  if (status === 'pending') {
    return <Badge tone="danger" dot>Pending validation</Badge>;
  }
  if (status === 'failed') {
    return <Badge tone="danger">Validation failed</Badge>;
  }
  return <Badge tone="success" dot>Validation successful</Badge>;
}

function EmptyState({ filtersActive }: { filtersActive: boolean }) {
  if (filtersActive) {
    return (
      <Card padding="lg" className="text-center py-16">
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          No audience files match your filters
        </h3>
        <p className="text-sm text-text-tertiary">
          Try clearing the filters to see every uploaded file.
        </p>
      </Card>
    );
  }
  return (
    <Card padding="lg" className="flex flex-col items-center text-center py-20">
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
        <Upload size={24} />
      </div>
      <h3 className="font-serif italic text-3xl text-text-primary mb-2">No files yet</h3>
      <p className="text-sm text-text-tertiary max-w-sm">
        Files appear here as soon as you upload them on the new-campaign or
        new-run flows.
      </p>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
