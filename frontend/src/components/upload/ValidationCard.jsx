import { validationChecks } from '../../data/history.js';

const STATUS_LABEL = { ok: 'Pass', warn: 'Review', fail: 'Fail' };
const STATUS_GLYPH = { ok: '✓', warn: '!', fail: '✕' };

export default function ValidationCard() {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Validation checks</h2>
          <p>What we check before saving</p>
        </div>
      </div>
      <div className="card-body">
        <div className="validation-list">
          {validationChecks.map((c) => (
            <div className="validation-item" key={c.id}>
              <div className={`v-icon ${c.status}`}>{STATUS_GLYPH[c.status]}</div>
              <div>
                <div className="v-rule">{c.rule}</div>
                <div className="v-detail">{c.detail}</div>
              </div>
              <div className={`v-status ${c.status}`}>{STATUS_LABEL[c.status]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
