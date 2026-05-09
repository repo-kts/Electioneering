import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Card from '../components/ui/Card.jsx';
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

  return (
    <div className="shell" style={{ maxWidth: 420, marginTop: 80 }}>
      <Card>
        <Card.Head
          title="Sign in"
          subtitle="Internal access only. Use the credentials assigned to you."
        />
        <Card.Body>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="form20-header-row">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Username
              </span>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="form20-header-row">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error.message || 'Login failed'}</div>
            )}
            <Button type="submit" variant="primary" disabled={busy} leadingIcon={busy ? <Spinner size={12} /> : undefined}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              Default seeded users: <code>admin / admin123</code>,{' '}
              <code>operator / operator123</code>. Change these in production.
            </div>
          </form>
        </Card.Body>
      </Card>
    </div>
  );
}
