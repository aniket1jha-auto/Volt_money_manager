import { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Coins,
  Clock,
  CalendarDays,
  Users,
  Mail,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { User } from '@/types';
import { getCurrentUser } from '@/lib/api';
import { PageHeader } from '@/components/features/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';

export default function Settings() {
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const toast = useToast();

  const [team, setTeam] = useState<User[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [simulateError, setSimulateError] = useState(() => {
    try { return localStorage.getItem('volt.simulateError') === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!activeWorkspace || !user) return;
    let cancelled = false;
    setTeam(null);
    setError(null);
    // For v1 the team is just the current user. The endpoint shape is
    // GET /workspaces/:id/members → User[].
    getCurrentUser(user.id)
      .then((u) => {
        if (cancelled) return;
        setTeam(u ? [u] : []);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
      });
    return () => { cancelled = true; };
  }, [activeWorkspace, user, reloadTick]);

  function toggleSimulateError(on: boolean) {
    setSimulateError(on);
    try {
      if (on) localStorage.setItem('volt.simulateError', '1');
      else localStorage.removeItem('volt.simulateError');
    } catch { /* ignore */ }
    toast.push({
      tone: on ? 'warning' : 'info',
      title: on ? 'Mock API failures: ON' : 'Mock API failures: OFF',
      description: on
        ? 'Every API call will reject. Visit any page to see error states.'
        : 'API calls will succeed normally again.',
    });
  }

  if (!activeWorkspace || !user) return null;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Workspace details, team, and developer toggles."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Workspace info */}
        <section className="lg:col-span-2">
          <SectionHeader title="Workspace" />
          <Card padding="lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-14 w-14 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Building2 size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-text-primary">
                  {activeWorkspace.name}
                </h3>
                <p className="text-sm text-text-tertiary mt-0.5">
                  {activeWorkspace.industry}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field icon={MapPin} label="Region" value={activeWorkspace.region} />
              <Field icon={Coins} label="Currency" value={activeWorkspace.currency} />
              <Field icon={Clock} label="Timezone" value={activeWorkspace.timezone} />
              <Field
                icon={CalendarDays}
                label="Created"
                value={formatDate(activeWorkspace.createdAt, activeWorkspace)}
              />
              <Field icon={ShieldCheck} label="Workspace ID" value={activeWorkspace.id} mono />
            </dl>
          </Card>
        </section>

        {/* Account card */}
        <section>
          <SectionHeader title="Your account" />
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-text-primary truncate">{user.name}</div>
                <div className="text-xs text-text-tertiary truncate">{user.email}</div>
              </div>
            </div>
            <Badge tone="brand" size="md" className="capitalize mb-4">
              {user.role}
            </Badge>
            <Button variant="secondary" size="sm" fullWidth onClick={logout}>
              Sign out
            </Button>
          </Card>
        </section>

        {/* Team */}
        <section className="lg:col-span-3">
          <SectionHeader
            title="Team"
            description="People in this workspace. Adding teammates is read-only in v1."
          />
          {error ? (
            <ErrorState
              title="Could not load team"
              onRetry={() => setReloadTick((t) => t + 1)}
            />
          ) : team === null ? (
            <Card padding="md">
              <Skeleton className="h-12 w-full" />
            </Card>
          ) : team.length === 0 ? (
            <Card padding="lg" className="flex flex-col items-center text-center py-12">
              <Users size={20} className="text-text-tertiary mb-2" />
              <p className="text-sm text-text-tertiary">No teammates yet.</p>
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full text-sm">
                <thead className="border-b border-border-subtle bg-slate-25">
                  <tr>
                    <Th>Member</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                            {initials(m.name)}
                          </div>
                          <div className="font-medium text-text-primary">{m.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-text-secondary">
                          <Mail size={13} className="text-text-tertiary" />
                          {m.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="brand" className="capitalize">{m.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.id === user.id && (
                          <span className="text-xs text-text-tertiary">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        {/* Developer toggles */}
        <section className="lg:col-span-3">
          <SectionHeader
            title="Developer"
            description="Switches that help reviewers stress-test the UI mock."
          />
          <Card padding="lg" className="border-warning-500/30 bg-warning-50/40">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-warning-50 text-warning-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-text-primary">
                  Simulate API failures
                </h4>
                <p className="text-xs text-text-tertiary mt-1 mb-3 max-w-2xl">
                  When ON, every mock API call rejects with an error.
                  Visit any page to see its error state and retry button.
                  This is the only side-effect of the toggle — happy-path
                  data is unchanged.
                </p>
                <Checkbox
                  id="simulate-error"
                  checked={simulateError}
                  onChange={(e) => toggleSimulateError(e.target.checked)}
                  label={simulateError ? 'Failures are ON' : 'Off'}
                />
              </div>
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-text-tertiary mt-1">{description}</p>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-text-tertiary mt-1 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">
          {label}
        </div>
        <div className={
          mono
            ? 'font-mono text-xs text-text-primary tabular truncate'
            : 'text-sm font-medium text-text-primary truncate'
        }>
          {value}
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
      {children}
    </th>
  );
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}
