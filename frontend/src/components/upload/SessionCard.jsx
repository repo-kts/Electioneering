import { session } from '../../data/history.js';

export default function SessionCard() {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Your session</h2>
          <p>Active sign-in details</p>
        </div>
      </div>
      <div className="card-body">
        <div className="session-list">
          <div className="session-row">
            <div className="session-key">User</div>
            <div className="session-val">{session.user}</div>
          </div>
          <div className="session-row">
            <div className="session-key">Role</div>
            <div className="session-val">
              {session.role} <span className="badge-tag">Active</span>
            </div>
          </div>
          <div className="session-row">
            <div className="session-key">Region</div>
            <div className="session-val">{session.region}</div>
          </div>
          <div className="session-row">
            <div className="session-key">Permissions</div>
            <div className="session-val">{session.permissions}</div>
          </div>
          <div className="session-row">
            <div className="session-key">Session expires</div>
            <div className="session-val tnum">{session.expires}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
