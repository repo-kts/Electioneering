import { useEffect, useRef, useState } from 'react';
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

function ChevDown() {
  return (
    <svg className="chev" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const items = FULL_NAV.filter((n) => !user || n.roles.includes(user.role));

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function handleDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDoc);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDoc);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
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
          <div className="user-menu-wrap" ref={wrapRef}>
            <button
              type="button"
              className={`user-trigger ${open ? 'open' : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <div className="user-meta">
                <div className="user-name">{user.username}</div>
                <span className="user-role">{ROLE_LABEL[user.role] ?? user.role}</span>
              </div>
              <div className="avatar">{initials(user.username)}</div>
              <ChevDown />
            </button>
            {open && (
              <div className="user-menu" role="menu">
                <div className="user-menu-head">
                  <div className="name">{user.username}</div>
                  <span className={`role-tag role-${user.role}`}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
                <button
                  type="button"
                  className="user-menu-item danger"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-sm">Sign in</Link>
        )}
      </div>
    </header>
  );
}
