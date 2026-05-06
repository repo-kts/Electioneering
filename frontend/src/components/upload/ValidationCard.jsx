import { validationChecks } from '../../data/history.js';
import Card from '../ui/Card.jsx';

const STATUS_LABEL = { ok: 'Pass', warn: 'Review', fail: 'Fail' };
const STATUS_GLYPH = { ok: '✓', warn: '!', fail: '✕' };

export default function ValidationCard() {
  return (
    <Card>
      <Card.Head title="Validation checks" subtitle="What we check before saving" />
      <Card.Body>
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
      </Card.Body>
    </Card>
  );
}
