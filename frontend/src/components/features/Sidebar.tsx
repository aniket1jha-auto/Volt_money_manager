import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Megaphone,
  BarChart3,
  Users,
  ChevronDown,
  ChevronUp,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/audiences', icon: Users, label: 'Audience list' },
    ],
  },
];

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-gradient-to-r from-blue-50 to-brand-50/40 text-brand-700 shadow-[inset_0_0_0_1px_rgba(31,79,191,0.08)]'
            : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Brand-blue accent stripe on the left edge of the active item */}
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-brand-500 to-blue-500"
            />
          )}
          <Icon
            size={18}
            className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-brand-700' : 'text-text-tertiary group-hover:text-text-secondary',
            )}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
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
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-text-primary truncate">{user.name}</div>
          <div className="text-[11px] text-text-tertiary capitalize">{user.role}</div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-text-tertiary shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-text-tertiary shrink-0" />
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
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-60 flex flex-col bg-surface border-r border-border-subtle">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center shrink-0">
        <Logo size="md" wordmarkColor="dark" intro />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 flex flex-col">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? 'mt-5' : ''}>
            {section.heading && (
              <div className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                {section.heading}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle p-2 shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}
