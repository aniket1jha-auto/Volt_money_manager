import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Workspace } from '@/types';
import { getWorkspaces } from '@/lib/api';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'volt.activeWorkspace';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      return;
    }
    let cancelled = false;
    getWorkspaces(user.id).then((rows) => {
      if (cancelled) return;
      setWorkspaces(rows);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && rows.some((w) => w.id === stored)) {
        setActiveId(stored);
      } else if (rows.length === 1) {
        setActiveId(rows[0].id);
        localStorage.setItem(STORAGE_KEY, rows[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace: workspaces.find((w) => w.id === activeId) ?? null,
      setActiveWorkspace: (id: string) => {
        if (workspaces.some((w) => w.id === id)) {
          setActiveId(id);
          localStorage.setItem(STORAGE_KEY, id);
        }
      },
    }),
    [workspaces, activeId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
