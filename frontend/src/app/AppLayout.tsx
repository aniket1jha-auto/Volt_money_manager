import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/features/Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-[1400px] px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
