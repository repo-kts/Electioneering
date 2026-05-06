import { NavLink, Link } from 'react-router-dom';
import { session } from '../../data/history.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/voter-detail', label: 'Voter Detail' },
  { to: '/form-20', label: 'Form 20' },
  { to: '/analytics', label: 'Analytics' },
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <div className="logo-mark">E</div>
          <span>Electioneering</span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-spacer" />
        <div className="user">
          <div className="user-meta">
            <div className="user-name">{session.user}</div>
            <span className="user-role">{session.role}</span>
          </div>
          <div className="avatar">{initials(session.user)}</div>
        </div>
      </div>
    </header>
  );
}
