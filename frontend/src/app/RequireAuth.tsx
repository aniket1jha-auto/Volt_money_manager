import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Logo } from '@/components/ui/Logo';
import type { ReactNode } from 'react';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { workspaces, activeWorkspace } = useWorkspace();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Logo size="xl" withWordmark={false} breathing />
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (workspaces.length > 1 && !activeWorkspace) {
    return <Navigate to="/select-workspace" replace />;
  }

  return <>{children}</>;
}
