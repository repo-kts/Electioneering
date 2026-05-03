import { NavLink, Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <div className="logo-mark">E</div>
          <span>Electioneering</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/voter-detail">Voter Detail</NavLink>
          <NavLink to="/form-20">Form 20</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
        </nav>
        <div className="header-spacer" />
        <div className="user">
          <div className="user-meta">
            <div className="user-name">R. Khanna</div>
            <span className="user-role">Officer · Level 2</span>
          </div>
          <div className="avatar">RK</div>
        </div>
      </div>
    </header>
  );
}
