import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const FULL_NAV = [
  { to: '/', label: 'Home', end: true, roles: ['admin', 'data_operator'] },
  { to: '/voter-detail', label: 'Voter Detail', roles: ['admin', 'data_operator'] },
  { to: '/form-20', label: 'Form 20', roles: ['admin', 'data_operator'] },
  { to: '/segment', label: 'Segment', roles: ['admin'] },
  { to: '/analytics', label: 'Analytics', roles: ['admin'] },
];

const ROLE_LABEL = {
  admin: 'Admin',
  data_operator: 'Data Operator',
};

function initials(name) {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = FULL_NAV.filter((n) => !user || n.roles.includes(user.role));

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <div className="logo-mark">E</div>
          <span>Electioneering</span>
        </Link>
        {user && (
          <nav className="nav">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="header-spacer" />
        {user ? (
          <div className="user" style={{ gap: 12 }}>
            <div className="user-meta">
              <div className="user-name">{user.username}</div>
              <span className="user-role">{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>
            <div className="avatar">{initials(user.username)}</div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-sm"
              style={{ marginLeft: 4 }}
              title="Sign out"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-sm">Sign in</Link>
        )}
      </div>
    </header>
  );
}
