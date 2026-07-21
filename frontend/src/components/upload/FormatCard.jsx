import { useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { API_BASE } from '../../lib/api.js';

// Per-row voter columns. The election is created in Master Data; its ID goes in
// the Election ID column. Election identity fields are NOT repeated per row.
const VOTER_FIELDS = [
  ['Election ID', 'number * (from Master Data → Elections)', '1'],
  ['Name', 'text *', 'Sebastiao Xavier Fernandes'],
  ['Relation', 'Father / Husband', 'Father'],
  ['Father Name', 'text', 'Xavier Fernandes'],
  ['EPIC Number', '/^[A-Z]{3}\\d{7}$/ *', 'TRW0273011'],
  ['age', 'number 18..120 *', '78'],
  ['gender', 'Male / Female / Other *', 'Male'],
  ['mobile', '/^[6-9]\\d{9}$/', '9876543210'],
  ['Part Number', 'number * (= Form 20 PS #)', '1'],
  ['Booth Name', 'text (booth’s own name)', 'Booth 1 — Room A'],
  ['Polling Station Name', 'text (building)', 'Govt Primary School, Tiracol'],
  ['House Number', 'text', '3'],
  ['Section No / Section Name', 'text', '1 / Near Church'],
  ['Main Town … Pin Code', 'text (geography)', 'TIRACOL … 403524'],
  ['Caste / Community / Category', 'text', 'Gen'],
  ['Religion / Occupation / Language', 'text', 'Christian'],
];

const FORM20_FIELDS = [
  ['electionId', 'number * (from Master Data → Elections)', '1'],
  ['serial', 'number * (= booth / PS #)', '1'],
  ['<candidate name>', 'one number column per candidate', '369'],
  ['rejected', 'number', '0'],
  ['nota', 'number', '13'],
  ['total', 'number (auto-calc)', '508'],
  ['tendered', 'number', '0'],
];

const VOTER_NOTES = (
  <>
    First create the election in <strong>Master Data → Elections</strong> and put
    its <strong>ID in the Election ID column</strong> (same value for every row).
    <strong> EPIC is the identity</strong> — a new EPIC is created, an existing
    one is <strong>updated</strong>. <strong>Part Number</strong> maps the voter
    to that election's booth (must equal the Form 20 PS #). Supported:{' '}
    <code>.xlsx .xlsm .xlsb .xls .ods .fods .csv .tsv</code>.
  </>
);

const FORM20_NOTES = (
  <>
    Put the <strong>Election ID</strong> (from Master Data → Elections) in every
    row. <code>serial</code> is the booth number — the booth name &amp; polling
    station come from the voter roll (matched by this serial), so they aren't in
    this sheet. Each candidate gets its own column — the header becomes the
    candidate name. Candidate <strong>party &amp; alliance</strong> are mapped
    afterwards in <strong>Master Data → Candidates</strong>. Supported:{' '}
    <code>.xlsx .xlsm .xlsb .xls .ods .fods .csv .tsv</code>.
  </>
);

export default function FormatCard({ kind = 'voter' }) {
  const isForm20 = kind === 'form20';
  const fields = isForm20 ? FORM20_FIELDS : VOTER_FIELDS;
  const title = isForm20 ? 'Form 20 file format' : 'Voter file format';
  const notes = isForm20 ? FORM20_NOTES : VOTER_NOTES;
  const slug = isForm20 ? 'form20' : 'voter';

  // Form 20 template is tailored to the candidate names (one column each).
  const [candidates, setCandidates] = useState('');

  function download(format, sample = false) {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (sample) params.set('sample', '1');
    if (isForm20) {
      const list = candidates.split(',').map((c) => c.trim()).filter(Boolean);
      if (list.length) params.set('candidates', list.join(','));
    }
    const qs = params.toString();
    window.open(`${API_BASE}/api/templates/${slug}${qs ? '?' + qs : ''}`, '_blank');
  }

  return (
    <Card>
      <Card.Head
        title={title}
        subtitle="Set the requirements, download the template, fill it, and upload the same file."
      />
      <Card.Body>
        <div className="mb-3 text-sm leading-relaxed text-slate-600">{notes}</div>

        {/* Form 20 sample is tailored to the candidate names (one column each). */}
        {isForm20 && (
          <div className="mb-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Candidate names (comma-separated) — one column each</span>
              <input
                className="w-full rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                placeholder="e.g. Tukaram Parab, Ramakant Khalap, Shripad Naik"
                value={candidates}
                onChange={(e) => setCandidates(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => download()}>Download blank .xlsx</Button>
          <Button onClick={() => download('', true)}>Sample .xlsx</Button>
          <Button onClick={() => download('csv')}>Blank .csv</Button>
          <Button onClick={() => download('csv', true)}>Sample .csv</Button>
        </div>

        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full text-sm">
            <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Column</th>
                <th className="px-3 py-2 font-medium">Type / format</th>
                <th className="px-3 py-2 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(([col, type, ex]) => (
                <tr key={col} className="border-t border-slate-200">
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-700">{col}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{type}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          * Required · Rows that fail validation are skipped on import (count returned in the upload response).
        </div>
      </Card.Body>
    </Card>
  );
}
