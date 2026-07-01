import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { FullLoader } from '../ui/Loader.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullLoader />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="border border-slate-300 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-950">Access denied</h2>
        <p className="mt-1 text-sm text-slate-600">
          This page requires the {roles.join(' / ')} role. Your role: <strong>{user.role}</strong>.
        </p>
      </div>
    );
  }
  return children;
}
