import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label, HelperText } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') ?? '/';

  const [email, setEmail] = useState('admin@voltmoney.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(decodeURIComponent(returnTo), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* Left — brand panel */}
      <div className="hidden lg:flex relative overflow-hidden border-r border-border-subtle">
        {/* Soft diagonal base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #EFF8FE 0%, #F8FAFD 45%, #ECF0FA 100%)',
          }}
        />

        {/* Atmospheric color orbs — cyan top-left, navy bottom-right */}
        <div
          className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-70"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0, 186, 242, 0.45) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-60"
          style={{
            background:
              'radial-gradient(circle at center, rgba(31, 79, 191, 0.35) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-30"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0, 41, 112, 0.25) 0%, transparent 70%)',
          }}
        />

        {/* Subtle dot grid for texture */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #002970 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Centerpiece — logo with halo */}
        <div className="relative flex flex-col items-center justify-center p-12 w-full">
          <div className="relative">
            <div
              className="absolute -inset-12 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(0, 186, 242, 0.30) 0%, transparent 70%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <Logo size="hero" withWordmark={false} intro />
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-12 text-xs text-text-tertiary tabular">
          Volt Voice · v0.1 · Internal preview
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <Logo size="md" intro />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary">Sign in</h2>
            <p className="text-sm text-text-tertiary mt-1">
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@voltmoney.in"
                leftIcon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="password" required>Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={Boolean(error)}
              />
              {error && <HelperText error>{error}</HelperText>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-secondary">
                <input type="checkbox" className="h-4 w-4 rounded border-border-medium" />
                Remember me
              </label>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </a>
            </div>

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-xs text-text-tertiary">
            This is an internal preview. Any non-empty credentials sign you in
            as the demo workspace admin.
          </p>
        </div>
      </div>
    </div>
  );
}
