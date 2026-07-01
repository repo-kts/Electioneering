import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { API_BASE } from '../../lib/api.js';

const VOTER_FIELDS = [
  ['firstName', 'text *', 'SAHIL'],
  ['lastName', 'text *', 'SAXENA'],
  ['relFirstName', 'text *', 'SANJAY'],
  ['relLastName', 'text *', 'KUMAR'],
  ['age', 'number 18..120 *', '23'],
  ['gender', 'Male / Female / Other *', 'Male'],
  ['epic', '/^[A-Z]{3}\\d{7}$/ *', 'TGK3378866'],
  ['mobile', '/^[6-9]\\d{9}$/', '9876543210'],
  ['state', 'text *', 'Bihar'],
  ['parlNo', 'text *', '29'],
  ['parlName', 'text *', 'Nalanda'],
  ['assemblyNo', 'text *', '172'],
  ['assemblyName', 'text *', 'Biharsharif'],
  ['pollingStationName', 'text *', 'Madarasa Ajijiya'],
  ['partNumber', 'text *', '381'],
  ['partName', 'text', 'Madarasa Ajijaya Dakshini Bhag'],
  ['partSerial', 'text *', '283'],
  ['community', 'text (caste / sub-caste tag)', 'Kayastha'],
  ['occupation', 'text', 'Teacher'],
  ['language', 'text', 'Hindi'],
];

const FORM20_FIELDS = [
  ['serial', 'number *', '1'],
  ['pollingStation', 'text', 'Madarasa Ajijiya'],
  ['<candidate name>', 'one number column per candidate', '369'],
  ['rejected', 'number', '0'],
  ['nota', 'number', '13'],
  ['total', 'number (auto-calc)', '508'],
  ['tendered', 'number', '0'],
];

const VOTER_NOTES = (
  <>
    <strong>Headers must match exactly</strong> (case-insensitive). EPIC and
    duplicate-EPIC rows are skipped on import. Mobile, partName and pollingDate
    are optional. Supported file types: <code>.xlsx .xlsm .xlsb .xls .ods .fods .csv .tsv</code>.
  </>
);

const FORM20_NOTES = (
  <>
    Each candidate gets its own column — header text becomes the candidate name
    in the database. <code>serial</code> is the polling-station number. The
    election header (state, parl, assembly, total electors) is filled in the
    preview screen before commit. Supported file types:{' '}
    <code>.xlsx .xlsm .xlsb .xls .ods .fods .csv .tsv</code>.
  </>
);

export default function FormatCard({ kind = 'voter' }) {
  const isForm20 = kind === 'form20';
  const fields = isForm20 ? FORM20_FIELDS : VOTER_FIELDS;
  const title = isForm20 ? 'Form 20 file format' : 'Voter file format';
  const notes = isForm20 ? FORM20_NOTES : VOTER_NOTES;
  const slug = isForm20 ? 'form20' : 'voter';

  function download(format, sample = false) {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (sample) params.set('sample', '1');
    const qs = params.toString();
    const url = `${API_BASE}/api/templates/${slug}${qs ? '?' + qs : ''}`;
    window.open(url, '_blank');
  }

  return (
    <Card>
      <Card.Head
        title={title}
        subtitle="Download a template, fill it, and upload the same file. Admin upload updates the database directly."
      />
      <Card.Body>
        <div className="mb-3 text-sm leading-relaxed text-slate-600">{notes}</div>

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
