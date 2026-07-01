import { validationChecks } from '../../data/history.js';
import Card from '../ui/Card.jsx';

const STATUS_LABEL = { ok: 'Pass', warn: 'Review', fail: 'Fail' };
const STATUS_GLYPH = { ok: '✓', warn: '!', fail: '✕' };
const ICON_CLS = {
  ok: 'bg-emerald-100 text-emerald-700',
  warn: 'bg-amber-100 text-amber-700',
  fail: 'bg-rose-100 text-rose-700',
};
const STATUS_CLS = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  fail: 'text-rose-600',
};

export default function ValidationCard() {
  return (
    <Card>
      <Card.Head title="Validation checks" subtitle="What we check before saving" />
      <Card.Body>
        <div className="space-y-2">
          {validationChecks.map((c) => (
            <div className="flex items-start gap-3" key={c.id}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ICON_CLS[c.status]}`}>
                {STATUS_GLYPH[c.status]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700">{c.rule}</div>
                <div className="text-xs text-slate-400">{c.detail}</div>
              </div>
              <div className={`text-xs font-semibold ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
