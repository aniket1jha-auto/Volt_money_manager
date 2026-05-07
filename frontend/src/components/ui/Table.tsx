import { useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** cell renderer */
  cell: (row: T) => ReactNode;
  /** sort comparator — when omitted the column is non-sortable */
  sort?: (a: T, b: T) => number;
  /** column width or min-width — passed as inline style */
  width?: string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  /** sticky table header */
  stickyHeader?: boolean;
  className?: string;
  emptyText?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  onRowClick,
  stickyHeader,
  className,
  emptyText = 'No rows',
}: TableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => col.sort!(a, b) * dir);
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'desc' };
      if (cur.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  }

  const alignCls = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  } as const;

  return (
    <div className={cn('rounded-xl border border-border-subtle overflow-hidden bg-surface shadow-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn('bg-slate-25 border-b border-border-subtle text-xs', stickyHeader && 'sticky top-0 z-10')}>
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const Icon = isSorted
                  ? sort.dir === 'desc' ? ChevronDown : ChevronUp
                  : ChevronsUpDown;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-3 font-semibold text-text-tertiary uppercase tracking-[0.06em]',
                      alignCls[col.align ?? 'left'],
                      col.className,
                    )}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.sort ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors',
                          isSorted ? 'text-text-primary' : 'hover:text-text-secondary',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.header}
                        <Icon size={12} className={cn(!isSorted && 'opacity-50')} />
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-text-tertiary text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group border-b border-border-subtle last:border-b-0',
                    // Zebra striping — every other row picks up a slightly
                    // tinted background so dense tables read easier.
                    idx % 2 === 1 && 'bg-slate-25/60',
                    onRowClick && 'cursor-pointer transition-colors hover:bg-blue-50/60 hover:shadow-[inset_3px_0_0_var(--color-brand-500)]',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-3 text-text-primary',
                        alignCls[col.align ?? 'left'],
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
