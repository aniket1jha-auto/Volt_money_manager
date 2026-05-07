import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/features/Sidebar';

export function AppLayout() {
  return (
    <div className="relative min-h-screen bg-bg overflow-hidden">
      {/* Soft ambient brand gradient — barely-there, fixed to the viewport */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top right, rgba(0, 186, 242, 0.06), transparent 55%), radial-gradient(ellipse at bottom left, rgba(31, 79, 191, 0.05), transparent 55%)',
        }}
      />
      <Sidebar />
      <main className="relative ml-60 min-h-screen">
        <div className="mx-auto max-w-[1400px] px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
