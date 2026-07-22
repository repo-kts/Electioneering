import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../ui/Modal.jsx';
import { Spinner } from '../ui/Loader.jsx';

// Edit one voter's stable identity + address/geography + demographics, keyed by
// the constant EPIC. Per-election booth/roll placement is not here — it belongs
// to BoothVoter and is corrected by re-uploading that election's roll.

const inp = 'w-full rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500';
const lbl = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

// [key, label, kind]. kind: text | number | gender | community
const FIELDS = [
  ['firstName', 'First name', 'text'],
  ['lastName', 'Last name', 'text'],
  ['relationType', 'Relation', 'text'],
  ['relFirstName', 'Relative first', 'text'],
  ['relLastName', 'Relative last', 'text'],
  ['age', 'Age', 'number'],
  ['gender', 'Gender', 'gender'],
  ['mobile', 'Mobile', 'text'],
  ['mainTown', 'Main town', 'text'],
  ['ward', 'Ward', 'text'],
  ['postOffice', 'Post office', 'text'],
  ['policeStation', 'Police station', 'text'],
  ['panchayat', 'Panchayat', 'text'],
  ['block', 'Block', 'text'],
  ['tehsil', 'Tehsil', 'text'],
  ['district', 'District', 'text'],
  ['pinCode', 'Pin code', 'text'],
  ['caste', 'Caste', 'text'],
  ['community', 'Community', 'community'],
  ['category', 'Category', 'text'],
  ['religion', 'Religion', 'text'],
  ['occupation', 'Occupation', 'text'],
  ['language', 'Language', 'text'],
];

export default function EditVoterForm({ voter, onClose }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => {
    const f = {};
    for (const [k] of FIELDS) f[k] = voter[k] ?? '';
    return f;
  });

  const save = useMutation({
    mutationFn: (data) => api.updateVoter(voter.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['voters', 'list'] });
      show('Voter updated', 'success');
      onClose();
    },
    onError: (e) => show(e.message || 'Update failed', 'error'),
  });

  function submit(e) {
    e.preventDefault();
    // Send only changed fields (empty string → clear).
    const data = {};
    for (const [k] of FIELDS) {
      const cur = String(voter[k] ?? '');
      if (String(form[k] ?? '') !== cur) data[k] = k === 'age' ? Number(form[k]) : form[k];
    }
    if (Object.keys(data).length === 0) { onClose(); return; }
    save.mutate(data);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={(
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">Edit voter</span>
          <span className="text-[11px] font-normal text-slate-400">EPIC {voter.epic} · identity is fixed, details editable</span>
        </span>
      )}
    >
      <form onSubmit={submit}>
        <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {FIELDS.map(([k, label, kind]) => (
            <label key={k} className="block">
              <span className={lbl}>{label}</span>
              {kind === 'gender' ? (
                <select className={inp} value={form[k]} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}>
                  <option value="">—</option>
                  {['Male', 'Female', 'Other'].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : kind === 'community' ? (
                <select className={inp} value={form[k]} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}>
                  <option value="">—</option>
                  {['Gen', 'OBC', 'SC', 'ST'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  className={inp}
                  type={kind === 'number' ? 'number' : 'text'}
                  value={form[k]}
                  onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={save.isPending} className="inline-flex items-center gap-2 rounded-sm bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {save.isPending && <Spinner size={14} />}
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
