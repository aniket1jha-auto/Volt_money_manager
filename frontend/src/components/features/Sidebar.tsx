import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Megaphone,
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  ChevronUp,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const primaryNav: NavItem[] = [
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/analytics/campaigns', icon: BarChart3, label: 'Campaign Analytics' },
  { to: '/analytics/agents', icon: Bot, label: 'Agent Analytics' },
];

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'border-l-[3px]',
          isActive
            ? 'border-blue-500 bg-white/10 text-white'
            : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (!activeWorkspace) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-md',
          'text-left transition-colors',
          'hover:bg-white/5',
        )}
      >
        <div className="h-8 w-8 rounded-md bg-blue-500/20 text-blue-200 flex items-center justify-center shrink-0">
          <Building2 size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
            Workspace
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {activeWorkspace.name}
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-white/50 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-white/50 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border-subtle bg-surface shadow-xl py-1 overflow-hidden">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setActiveWorkspace(w.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left',
                'hover:bg-slate-50 transition-colors',
                w.id === activeWorkspace.id && 'bg-brand-50',
              )}
            >
              <div className="h-7 w-7 rounded bg-brand-50 text-brand-700 flex items-center justify-center">
                <Building2 size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate">{w.name}</div>
                <div className="text-xs text-text-tertiary">{w.industry}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-white truncate">{user.name}</div>
          <div className="text-[11px] text-white/50 capitalize">{user.role}</div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-white/50 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-white/50 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border-subtle bg-surface shadow-xl py-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle">
            <div className="text-sm font-medium text-text-primary truncate">{user.name}</div>
            <div className="text-xs text-text-tertiary truncate">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-slate-50 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-60 flex flex-col bg-brand-900 text-white">
      <div className="px-5 h-16 flex items-center shrink-0 border-b border-white/10">
        <Logo size="md" wordmarkColor="light" intro />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
        {primaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="border-t border-white/10 p-2 space-y-1 shrink-0">
        <WorkspaceSwitcher />
        <UserMenu />
      </div>
    </aside>
  );
}
