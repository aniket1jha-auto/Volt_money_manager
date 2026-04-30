import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/Card';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function SelectWorkspace() {
  const { workspaces, setActiveWorkspace } = useWorkspace();
  const navigate = useNavigate();

  function pick(id: string) {
    setActiveWorkspace(id);
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo size="md" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">
            Choose a workspace
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            You belong to multiple workspaces. Pick one to continue.
          </p>
        </div>

        <div className="space-y-3">
          {workspaces.map((w) => (
            <Card
              key={w.id}
              interactive
              padding="md"
              onClick={() => pick(w.id)}
              className="flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-md bg-brand-50 flex items-center justify-center text-brand-700">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-text-primary truncate">
                  {w.name}
                </div>
                <div className="text-xs text-text-tertiary">
                  {w.industry} · {w.region}
                </div>
              </div>
              <ChevronRight size={18} className="text-text-tertiary" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
