import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="shell" style={{ padding: 24 }}>
        Loading…
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="shell" style={{ padding: 24 }}>
        <h2>Access denied</h2>
        <p style={{ color: 'var(--text-2)' }}>
          This page requires the {roles.join(' / ')} role. Your role: <strong>{user.role}</strong>.
        </p>
      </div>
    );
  }
  return children;
}
