import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Button from '../components/ui/Button.jsx';
import { Spinner } from '../components/ui/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const loginM = useMutation({
    mutationFn: ({ u, p }) => login(u.trim(), p),
    onSuccess: () => navigate(next, { replace: true }),
  });
  const busy = loginM.isPending;
  const error = loginM.error;

  function handleSubmit(e) {
    e.preventDefault();
    loginM.mutate({ u: username, p: password });
  }

  const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-4">
      <div className="w-full max-w-sm border border-slate-300 bg-white p-7">
        <div className="mb-8 border-b border-slate-200 pb-5">
          <div className="text-lg font-semibold text-slate-950">Electioneering</div>
          <div className="mt-1 text-xs text-slate-500">Field operations desk</div>
        </div>
        <h1 className="text-xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Internal access only. Use your assigned credentials.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Username</span>
            <input type="text" autoFocus autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="text-sm text-rose-600">{error.message || 'Login failed'}</div>}
          <Button type="submit" variant="primary" disabled={busy} leadingIcon={busy ? <Spinner size={12} /> : undefined}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="mt-1 border-t border-slate-200 pt-3 text-xs text-slate-500">
            Seeded users: <code className="bg-[#f7f5f0] px-1 text-slate-700">admin / admin123</code>,{' '}
            <code className="bg-[#f7f5f0] px-1 text-slate-700">operator / operator123</code>
          </div>
        </form>
      </div>
    </div>
  );
}
