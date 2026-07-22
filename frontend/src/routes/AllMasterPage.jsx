import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadUrls, downloadBlob } from '../lib/api.js';
import Modal from '../components/ui/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

// ─────────────────────────────────────────────────────────────────────────
// /all-master — single console to manage every piece of reference data:
//   • Geography: Country → State → Parliamentary → Assembly (cascading tree)
//   • Lists: generic lookup categories (election type, party, religion, …)
// All CRUD happens here; the rest of the app reads these as dropdowns.
// ─────────────────────────────────────────────────────────────────────────

const btn = 'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition';
const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const input = 'w-full rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500';

function IconBtn({ title, onClick, children, danger }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-sm p-1 text-slate-400 transition hover:bg-slate-100 ${danger ? 'hover:text-rose-600' : 'hover:text-slate-800'}`}
    >
      {children}
    </button>
  );
}
const PencilIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const TrashIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>);
const DownloadIcon = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>);
const UploadGlyph = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>);

// ─── Geography ────────────────────────────────────────────────────────────

// Field spec per hierarchy level: which inputs a create/edit form shows and
// how a row is labelled.
const LEVELS = {
  countries: {
    label: 'Country',
    fields: [{ k: 'name', ph: 'Name', req: true }, { k: 'code', ph: 'Code (IN)', req: true, w: 'w-24' }],
    render: (i) => `${i.name} · ${i.code}`,
  },
  states: {
    label: 'State',
    fields: [{ k: 'name', ph: 'Name', req: true }, { k: 'code', ph: 'Code', w: 'w-24' }],
    render: (i) => i.name + (i.code ? ` · ${i.code}` : ''),
  },
  parliamentary: {
    label: 'Parliamentary',
    fields: [{ k: 'number', ph: 'No.', req: true, w: 'w-20' }, { k: 'name', ph: 'Name', req: true }, { k: 'seatType', ph: 'GEN/SC/ST', w: 'w-24' }],
    render: (i) => `${i.number} — ${i.name}${i.seatType ? ` (${i.seatType})` : ''}`,
  },
  assembly: {
    label: 'Assembly',
    fields: [{ k: 'number', ph: 'No.', req: true, w: 'w-20' }, { k: 'name', ph: 'Name', req: true }, { k: 'seatType', ph: 'GEN/SC/ST', w: 'w-24' }],
    render: (i) => `${i.number} — ${i.name}${i.seatType ? ` (${i.seatType})` : ''}`,
  },
};

function InlineForm({ level, initial, parentField, parentId, onDone }) {
  const spec = LEVELS[level];
  const { show } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => {
    const f = {};
    for (const fld of spec.fields) f[fld.k] = initial?.[fld.k] ?? '';
    return f;
  });
  const editing = !!initial;
  const mut = useMutation({
    mutationFn: (payload) =>
      editing ? api.masterGeoUpdate(level, initial.id, payload) : api.masterGeoCreate(level, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-geo', level] });
      qc.invalidateQueries({ queryKey: ['master-tree'] });
      show(editing ? `${spec.label} updated` : `${spec.label} added`, 'success');
      onDone();
    },
    onError: (e) => show(e.message, 'error'),
  });

  function submit(e) {
    e.preventDefault();
    for (const fld of spec.fields) if (fld.req && !String(form[fld.k]).trim()) return show(`${fld.ph} required`, 'error');
    const payload = { ...form };
    if (parentField && !editing) payload[parentField] = parentId;
    mut.mutate(payload);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 bg-slate-50 p-2">
      {spec.fields.map((fld) => (
        <input
          key={fld.k}
          className={`${input} ${fld.w ?? 'flex-1 min-w-[80px]'}`}
          placeholder={fld.ph}
          value={form[fld.k]}
          onChange={(e) => setForm((s) => ({ ...s, [fld.k]: e.target.value }))}
        />
      ))}
      <button type="submit" className={btnPrimary} disabled={mut.isPending}>{editing ? 'Save' : 'Add'}</button>
      {editing && <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>}
    </form>
  );
}

function GeoColumn({ level, parentField, parentId, selectedId, onSelect }) {
  const spec = LEVELS[level];
  const { show } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(false);

  const enabled = parentField ? parentId != null : true;
  const listQ = useQuery({
    queryKey: ['master-geo', level, parentId ?? 'root'],
    queryFn: () => api.masterGeoList(level, parentField && parentId ? { [parentFieldQuery(level)]: parentId } : {}),
    enabled,
  });
  const del = useMutation({
    mutationFn: (id) => api.masterGeoDelete(level, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-geo', level] });
      qc.invalidateQueries({ queryKey: ['master-tree'] });
      show(`${spec.label} deleted`, 'success');
    },
    onError: (e) => show(e.message, 'error'),
  });

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-sm border border-slate-300 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{spec.label}</span>
        <span className="text-[11px] text-slate-400">{items.length}</span>
      </div>
      <div className="max-h-[70vh] min-h-[480px] flex-1 overflow-y-auto">
        {!enabled && <div className="p-3 text-xs text-slate-400">Select a {LEVELS[parentLevel(level)]?.label.toLowerCase()} first</div>}
        {enabled && listQ.isLoading && <div className="p-3 text-xs text-slate-400">Loading…</div>}
        {enabled && !listQ.isLoading && items.length === 0 && <div className="p-3 text-xs text-slate-400">No entries yet</div>}
        {items.map((it) =>
          editId === it.id ? (
            <InlineForm key={it.id} level={level} initial={it} onDone={() => setEditId(null)} />
          ) : (
            <div
              key={it.id}
              className={`group flex items-center gap-1 border-b border-slate-100 px-2 py-1.5 text-sm ${selectedId === it.id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect && onSelect(it.id)}>
                {spec.render(it)}
              </button>
              <span className="opacity-0 group-hover:opacity-100">
                <IconBtn title="Edit" onClick={() => setEditId(it.id)}><PencilIcon /></IconBtn>
                <IconBtn title="Delete" danger onClick={async () => { if (await confirm({ title: 'Delete entry?', message: `Delete ${spec.render(it)}?`, confirmText: 'Delete' })) del.mutate(it.id); }}><TrashIcon /></IconBtn>
              </span>
            </div>
          ),
        )}
      </div>
      {enabled && (adding ? (
        <InlineForm level={level} parentField={parentField} parentId={parentId} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="border-t border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50" onClick={() => setAdding(true)}>
          + Add {spec.label}
        </button>
      ))}
    </div>
  );
}
// Map hierarchy level → the query param naming its parent, and its parent level.
function parentFieldQuery(level) {
  return { states: 'countryId', parliamentary: 'stateId', assembly: 'parlId' }[level];
}
function parentLevel(level) {
  return { states: 'countries', parliamentary: 'states', assembly: 'parliamentary' }[level];
}

function GeographyTab() {
  const [countryId, setCountryId] = useState(null);
  const [stateId, setStateId] = useState(null);
  const [parlId, setParlId] = useState(null);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Cascading hierarchy. Pick a country to reveal its states, then constituencies. Edits here feed the election &amp; voter dropdowns.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        <GeoColumn level="countries" selectedId={countryId} onSelect={(id) => { setCountryId(id); setStateId(null); setParlId(null); }} />
        <GeoColumn level="states" parentField="countryId" parentId={countryId} selectedId={stateId} onSelect={(id) => { setStateId(id); setParlId(null); }} />
        <GeoColumn level="parliamentary" parentField="stateId" parentId={stateId} selectedId={parlId} onSelect={(id) => setParlId(id)} />
        <GeoColumn level="assembly" parentField="parlId" parentId={parlId} />
      </div>
    </div>
  );
}

// ─── Lists (generic lookup categories) ─────────────────────────────────────

function OptionRow({ optionId, categoryKey, option }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(option.label);
  const [code, setCode] = useState(option.code ?? '');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['master-category', categoryKey] });

  const save = useMutation({
    mutationFn: (data) => api.masterUpdateOption(optionId, data),
    onSuccess: () => { invalidate(); show('Option updated', 'success'); setEditing(false); },
    onError: (e) => show(e.message, 'error'),
  });
  const del = useMutation({
    mutationFn: () => api.masterDeleteOption(optionId),
    onSuccess: () => { invalidate(); show('Option deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });
  const toggle = useMutation({
    mutationFn: () => api.masterUpdateOption(optionId, { active: !option.active }),
    onSuccess: invalidate,
    onError: (e) => show(e.message, 'error'),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <input className={`${input} flex-1`} value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className={`${input} w-28`} placeholder="code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className={btnPrimary} onClick={() => save.mutate({ label, code: code || null })} disabled={save.isPending}>Save</button>
        <button className={btnGhost} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }
  return (
    <div className={`group flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm ${option.active ? 'text-slate-800' : 'text-slate-400'}`}>
      <span className="min-w-0 flex-1 truncate">{option.label}{option.code ? <span className="ml-2 text-xs text-slate-400">{option.code}</span> : null}</span>
      <button
        type="button"
        onClick={() => toggle.mutate()}
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${option.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
      >
        {option.active ? 'Active' : 'Hidden'}
      </button>
      <span className="opacity-0 group-hover:opacity-100">
        <IconBtn title="Edit" onClick={() => setEditing(true)}><PencilIcon /></IconBtn>
        <IconBtn title="Delete" danger onClick={async () => { if (await confirm({ title: 'Delete option?', message: `Delete "${option.label}"?`, confirmText: 'Delete' })) del.mutate(); }}><TrashIcon /></IconBtn>
      </span>
    </div>
  );
}

function ListsTab() {
  const { show } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [activeKey, setActiveKey] = useState(null);
  const [newOpt, setNewOpt] = useState('');
  const [newCat, setNewCat] = useState(null); // { key, label } while adding

  const catsQ = useQuery({ queryKey: ['master-categories'], queryFn: () => api.masterCategories() });
  const cats = catsQ.data?.items ?? [];
  const key = activeKey ?? cats[0]?.key ?? null;

  const catQ = useQuery({
    queryKey: ['master-category', key],
    queryFn: () => api.masterCategory(key),
    enabled: !!key,
  });

  const addOpt = useMutation({
    mutationFn: (label) => api.masterCreateOption(key, { label }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master-category', key] }); qc.invalidateQueries({ queryKey: ['master-categories'] }); setNewOpt(''); show('Option added', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });
  const addCat = useMutation({
    mutationFn: (data) => api.masterCreateCategory(data),
    onSuccess: (created) => { qc.invalidateQueries({ queryKey: ['master-categories'] }); setNewCat(null); setActiveKey(created.key); show('List created', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });
  const delCat = useMutation({
    mutationFn: (id) => api.masterDeleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master-categories'] }); setActiveKey(null); show('List deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  return (
    <div className="flex gap-4">
      {/* Category sidebar */}
      <div className="w-60 shrink-0 rounded-sm border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lists</div>
        <div className="max-h-[72vh] overflow-y-auto">
          {cats.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm ${key === c.key ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span className="truncate">{c.label}</span>
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-500">{c._count?.options ?? 0}</span>
            </button>
          ))}
        </div>
        {newCat ? (
          <div className="space-y-1.5 border-t border-slate-200 bg-slate-50 p-2">
            <input className={input} placeholder="List name (e.g. Manifesto Topic)" value={newCat.label}
              onChange={(e) => setNewCat({ ...newCat, label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') })} />
            <div className="flex gap-1.5">
              <button className={btnPrimary} disabled={!newCat.key || addCat.isPending} onClick={() => addCat.mutate({ key: newCat.key, label: newCat.label })}>Create</button>
              <button className={btnGhost} onClick={() => setNewCat(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="w-full border-t border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50" onClick={() => setNewCat({ key: '', label: '' })}>
            + New list
          </button>
        )}
      </div>

      {/* Options panel */}
      <div className="min-w-0 flex-1 rounded-sm border border-slate-300 bg-white">
        {!key && <div className="p-6 text-sm text-slate-400">No lists yet — create one.</div>}
        {key && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div>
                <div className="text-sm font-semibold text-slate-900">{catQ.data?.label ?? key}</div>
                <div className="text-[11px] text-slate-400">key: {key}{catQ.data?.system ? ' · system' : ''}</div>
              </div>
              {catQ.data && !catQ.data.system && (
                <button className={`${btnGhost} text-rose-600`} onClick={async () => { if (await confirm({ title: 'Delete list?', message: `Delete the "${catQ.data.label}" list and all its options?`, confirmText: 'Delete list' })) delCat.mutate(catQ.data.id); }}>Delete list</button>
              )}
            </div>
            <div className="max-h-[64vh] min-h-[420px] overflow-y-auto">
              {catQ.isLoading && <div className="p-4 text-sm text-slate-400">Loading…</div>}
              {(catQ.data?.options ?? []).map((o) => (
                <OptionRow key={o.id} optionId={o.id} categoryKey={key} option={o} />
              ))}
              {catQ.data && catQ.data.options.length === 0 && <div className="p-4 text-sm text-slate-400">No options yet.</div>}
            </div>
            <form
              className="flex items-center gap-1.5 border-t border-slate-200 bg-slate-50 p-2"
              onSubmit={(e) => { e.preventDefault(); if (newOpt.trim()) addOpt.mutate(newOpt.trim()); }}
            >
              <input className={`${input} flex-1`} placeholder={`Add to ${catQ.data?.label ?? 'list'}…`} value={newOpt} onChange={(e) => setNewOpt(e.target.value)} />
              <button type="submit" className={btnPrimary} disabled={!newOpt.trim() || addOpt.isPending}>Add</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Elections (create → get ID for the sheets) ─────────────────────────────

// Inline edit of an existing election — cascading State → Parliamentary →
// Assembly dropdowns plus a Type dropdown, mirroring the "New election" form.
// Geography selections are pre-filled by matching the election's stored
// names/numbers against the master lists.
function ElectionEditForm({ election, onDone }) {
  const { show } = useToast();
  const qc = useQueryClient();

  // Same cascading geography + type sources as the create form.
  const statesQ = useQuery({ queryKey: ['master-geo', 'states', 'root'], queryFn: () => api.masterGeoList('states') });
  const [stateId, setStateId] = useState('');
  const parlQ = useQuery({ queryKey: ['master-geo', 'parliamentary', stateId], queryFn: () => api.masterGeoList('parliamentary', { stateId }), enabled: !!stateId });
  const [parlId, setParlId] = useState('');
  const asmQ = useQuery({ queryKey: ['master-geo', 'assembly', parlId], queryFn: () => api.masterGeoList('assembly', { parlId }), enabled: !!parlId });
  const [asmId, setAsmId] = useState('');
  const typesQ = useQuery({ queryKey: ['master-options', 'election_type'], queryFn: () => api.masterOptions('election_type') });
  const [electionType, setElectionType] = useState(election.electionType ?? '');
  const [year, setYear] = useState(election.electionYear != null ? String(election.electionYear) : '');
  const [electors, setElectors] = useState(election.totalElectors != null ? String(election.totalElectors) : '');

  // Pre-select each level from the election's stored values once its list loads.
  useEffect(() => {
    if (stateId || !statesQ.data) return;
    const s = (statesQ.data.items ?? []).find((x) => x.name === election.state);
    if (s) setStateId(String(s.id));
  }, [statesQ.data, stateId, election.state]);
  useEffect(() => {
    if (!stateId || parlId || !parlQ.data) return;
    const p = (parlQ.data.items ?? []).find(
      (x) => x.name === election.parlName && String(x.number) === String(election.parlNo),
    );
    if (p) setParlId(String(p.id));
  }, [parlQ.data, stateId, parlId, election.parlName, election.parlNo]);
  useEffect(() => {
    if (!parlId || asmId || !asmQ.data) return;
    const a = (asmQ.data.items ?? []).find(
      (x) => x.name === election.assemblyName && String(x.number) === String(election.assemblyNo),
    );
    if (a) setAsmId(String(a.id));
  }, [asmQ.data, parlId, asmId, election.assemblyName, election.assemblyNo]);

  const save = useMutation({
    mutationFn: () => {
      const state = (statesQ.data?.items ?? []).find((s) => String(s.id) === String(stateId));
      const parl = (parlQ.data?.items ?? []).find((p) => String(p.id) === String(parlId));
      const asm = (asmQ.data?.items ?? []).find((a) => String(a.id) === String(asmId));
      if (!state || !parl || !asm || !electionType || !year) {
        throw new Error('Pick state, parliamentary, assembly, type and year');
      }
      return api.updateElection(election.id, {
        state: state.name,
        parlNo: String(parl.number), parlName: parl.name, parlSeatType: parl.seatType || undefined,
        assemblyNo: String(asm.number), assemblyName: asm.name, assemblySeatType: asm.seatType || undefined,
        electionType,
        electionYear: year ? Number(year) : undefined,
        totalElectors: electors ? Number(electors) : undefined,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['elections'] }); show(`Election #${election.id} updated`, 'success'); onDone(); },
    onError: (e) => show(e.message, 'error'),
  });

  const unmatched = statesQ.data && !stateId; // geography not found in master lists

  return (
    <tr className="border-t border-slate-100 bg-slate-50">
      <td className="px-3 py-2 align-top font-mono text-xs text-slate-500">#{election.id}</td>
      <td className="px-3 py-2" colSpan={6}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className={input} value={stateId} onChange={(e) => { setStateId(e.target.value); setParlId(''); setAsmId(''); }}>
            <option value="">State…</option>
            {(statesQ.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={input} value={parlId} disabled={!stateId} onChange={(e) => { setParlId(e.target.value); setAsmId(''); }}>
            <option value="">Parliamentary…</option>
            {(parlQ.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.number} — {p.name}</option>)}
          </select>
          <select className={input} value={asmId} disabled={!parlId} onChange={(e) => setAsmId(e.target.value)}>
            <option value="">Assembly…</option>
            {(asmQ.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
          <select className={input} value={electionType} onChange={(e) => setElectionType(e.target.value)}>
            <option value="">Type…</option>
            {(typesQ.data?.options ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
          </select>
          <input className={input} type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className={input} type="number" placeholder="Total electors" value={electors} onChange={(e) => setElectors(e.target.value)} />
        </div>
        {unmatched && (
          <p className="mt-1.5 text-xs text-amber-700">
            This election’s geography ({election.state} · {election.parlName} · {election.assemblyName}) isn’t in Master → Geography yet. Add it there, or pick the closest match above.
          </p>
        )}
        <div className="mt-2 flex gap-1.5">
          <button className={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</button>
          <button className={btnGhost} onClick={onDone}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function ElectionRow({ election, onDelete }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  if (editing) return <ElectionEditForm election={election} onDone={() => setEditing(false)} />;
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">
        <button
          type="button"
          title="Copy ID"
          onClick={() => { navigator.clipboard?.writeText(String(election.id)); show(`Copied election ID ${election.id}`, 'success'); }}
          className="rounded-sm bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800 hover:bg-slate-200"
        >
          #{election.id} ⧉
        </button>
      </td>
      <td className="px-3 py-2 text-slate-800">{election.assemblyNo}-{election.assemblyName}</td>
      <td className="px-3 py-2 text-slate-600">{election.electionYear ?? '—'}</td>
      <td className="px-3 py-2 text-slate-600">{election.electionType}</td>
      <td className="px-3 py-2 text-slate-600">{election.state}</td>
      <td className="px-3 py-2 text-slate-600">{election._count?.booths ?? 0}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <a
            href={downloadUrls.voterTemplate(false, '', election.id)}
            className={`${btnGhost} px-2 py-1`}
            title={`Download voters sheet (Election ID ${election.id} pre-filled)`}
          >
            <DownloadIcon /> Voters
          </a>
          <a
            href={downloadUrls.form20Template(false, '', election.id)}
            className={`${btnGhost} px-2 py-1`}
            title={`Download Form 20 sheet (Election ID ${election.id} pre-filled)`}
          >
            <DownloadIcon /> Form 20
          </a>
          <IconBtn title="Edit election" onClick={() => setEditing(true)}><PencilIcon /></IconBtn>
          <IconBtn title="Delete election" danger onClick={async () => { if (await confirm({ title: 'Delete election?', message: `Delete election #${election.id} (${election.assemblyName})? This removes its booths & results.`, confirmText: 'Delete' })) onDelete(election.id); }}><TrashIcon /></IconBtn>
        </div>
      </td>
    </tr>
  );
}

function ElectionsTab() {
  const { show } = useToast();
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ['elections'], queryFn: () => api.listElections() });
  const elections = listQ.data?.items ?? [];

  // Cascading geography + year/type for a new election.
  const statesQ = useQuery({ queryKey: ['master-geo', 'states', 'root'], queryFn: () => api.masterGeoList('states') });
  const [stateId, setStateId] = useState('');
  const parlQ = useQuery({ queryKey: ['master-geo', 'parliamentary', stateId], queryFn: () => api.masterGeoList('parliamentary', { stateId }), enabled: !!stateId });
  const [parlId, setParlId] = useState('');
  const asmQ = useQuery({ queryKey: ['master-geo', 'assembly', parlId], queryFn: () => api.masterGeoList('assembly', { parlId }), enabled: !!parlId });
  const [asmId, setAsmId] = useState('');
  const typesQ = useQuery({ queryKey: ['master-options', 'election_type'], queryFn: () => api.masterOptions('election_type') });
  const [electionType, setElectionType] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [electors, setElectors] = useState('');

  const create = useMutation({
    mutationFn: () => {
      const state = (statesQ.data?.items ?? []).find((s) => String(s.id) === String(stateId));
      const parl = (parlQ.data?.items ?? []).find((p) => String(p.id) === String(parlId));
      const asm = (asmQ.data?.items ?? []).find((a) => String(a.id) === String(asmId));
      if (!state || !parl || !asm || !electionType || !year) throw new Error('Pick state, parliamentary, assembly, type and year');
      return api.createElection({
        state: state.name,
        parlNo: parl.number, parlName: parl.name, parlSeatType: parl.seatType || undefined,
        assemblyNo: asm.number, assemblyName: asm.name, assemblySeatType: asm.seatType || undefined,
        electionType, electionYear: Number(year),
        totalElectors: electors ? Number(electors) : undefined,
      });
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ['elections'] });
      show(`Election #${e.id} created — use this ID in your sheets`, 'success');
      setAsmId('');
    },
    onError: (e) => show(e.message, 'error'),
  });
  const del = useMutation({
    mutationFn: (id) => api.deleteElection(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['elections'] }); show('Election deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Create an election here, then paste its <strong>ID</strong> into the <code>Election ID</code> column of your voter and Form 20 sheets.
      </p>

      {/* New election */}
      <div className="rounded-sm border border-slate-300 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">New election</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <select className={input} value={stateId} onChange={(e) => { setStateId(e.target.value); setParlId(''); setAsmId(''); }}>
            <option value="">State…</option>
            {(statesQ.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={input} value={parlId} disabled={!stateId} onChange={(e) => { setParlId(e.target.value); setAsmId(''); }}>
            <option value="">Parliamentary…</option>
            {(parlQ.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.number} — {p.name}</option>)}
          </select>
          <select className={input} value={asmId} disabled={!parlId} onChange={(e) => setAsmId(e.target.value)}>
            <option value="">Assembly…</option>
            {(asmQ.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
          <select className={input} value={electionType} onChange={(e) => setElectionType(e.target.value)}>
            <option value="">Type…</option>
            {(typesQ.data?.options ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
          </select>
          <input className={input} type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className={input} type="number" placeholder="Total electors" value={electors} onChange={(e) => setElectors(e.target.value)} />
        </div>
        <div className="mt-3">
          <button className={btnPrimary} onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create election'}
          </button>
        </div>
      </div>

      {/* Existing elections */}
      <div className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th><th className="px-3 py-2">Constituency</th><th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Type</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Booths</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {elections.map((e) => (
              <ElectionRow key={e.id} election={e} onDelete={(id) => del.mutate(id)} />
            ))}
            {elections.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No elections yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Candidate party / alliance mapping (per election) ──────────────────────

function CandidateMapRow({ electionId, candidate, partyOpts, allianceOpts }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const [party, setParty] = useState(candidate.party ?? '');
  const [alliance, setAlliance] = useState(candidate.alliance ?? '');
  const dirty = party !== (candidate.party ?? '') || alliance !== (candidate.alliance ?? '');
  const save = useMutation({
    mutationFn: () => api.updateCandidate(electionId, candidate.id, { party: party || null, alliance: alliance || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['election', String(electionId)] }); show('Saved', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 text-slate-800">{candidate.name}</td>
      <td className="px-3 py-2">
        <select className={input} value={party} onChange={(e) => setParty(e.target.value)}>
          <option value="">—</option>
          {partyOpts.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select className={input} value={alliance} onChange={(e) => setAlliance(e.target.value)}>
          <option value="">—</option>
          {allianceOpts.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <button className={btnPrimary} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</button>
      </td>
    </tr>
  );
}

function CandidatesTab() {
  const electionsQ = useQuery({ queryKey: ['elections'], queryFn: () => api.listElections() });
  const elections = electionsQ.data?.items ?? [];
  const [electionId, setElectionId] = useState('');
  const detailQ = useQuery({ queryKey: ['election', electionId], queryFn: () => api.getElection(electionId), enabled: !!electionId });
  const partyQ = useQuery({ queryKey: ['master-options', 'party'], queryFn: () => api.masterOptions('party') });
  const allianceQ = useQuery({ queryKey: ['master-options', 'alliance'], queryFn: () => api.masterOptions('alliance') });
  const candidates = detailQ.data?.candidates ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Map each candidate's <strong>party</strong> and <strong>alliance</strong> for a given election. Candidates appear here after you upload that election's Form 20.
      </p>
      <select className={`${input} max-w-sm`} value={electionId} onChange={(e) => setElectionId(e.target.value)}>
        <option value="">Select an election…</option>
        {elections.map((e) => <option key={e.id} value={e.id}>#{e.id} · {e.assemblyNo}-{e.assemblyName} · {e.electionYear ?? '—'}</option>)}
      </select>

      {electionId && (
        <div className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Candidate</th><th className="px-3 py-2 w-48">Party</th><th className="px-3 py-2 w-48">Alliance</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateMapRow key={c.id} electionId={electionId} candidate={c} partyOpts={partyQ.data?.options ?? []} allianceOpts={allianceQ.data?.options ?? []} />
              ))}
              {detailQ.data && candidates.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No candidates yet — upload this election's Form 20 first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Master booths (one stable row per physical booth, keyed by UNIQUE_CODE) ─

// Editable booth attributes (from the creation sheet). `code` (UNIQUE_CODE) is
// handled separately — required on create, immutable afterwards.
const BOOTH_FIELDS = [
  { k: 'partNumber', ph: 'Part number' },
  { k: 'boothName', ph: 'Booth name', wide: true },
  { k: 'pollingStationName', ph: 'Polling station name', wide: true },
  { k: 'mainTown', ph: 'Main town' },
  { k: 'postOffice', ph: 'Post office' },
  { k: 'policeStation', ph: 'Police station' },
  { k: 'block', ph: 'Block' },
  { k: 'subdivision', ph: 'Subdivision' },
  { k: 'district', ph: 'District' },
  { k: 'pinCode', ph: 'Pin code' },
];
const BOOTH_SHEET_COLS = BOOTH_FIELDS.map((f) => f.k);

function BoothForm({ parlId, asmId, boothKey, initial, onDone }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const editing = !!initial;
  const [code, setCode] = useState(initial?.code ?? '');
  const [form, setForm] = useState(() => {
    const f = {};
    for (const fld of BOOTH_FIELDS) f[fld.k] = initial?.[fld.k] ?? '';
    return f;
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = {};
      for (const fld of BOOTH_FIELDS) {
        const v = String(form[fld.k] ?? '').trim();
        payload[fld.k] = v === '' ? undefined : v;
      }
      if (editing) return api.masterBoothUpdate(initial.id, payload);
      return api.masterBoothCreate({
        ...payload,
        code: code.trim(),
        parliamentaryConstituencyId: Number(parlId),
        assemblyConstituencyId: asmId ? Number(asmId) : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-booths', boothKey] });
      show(editing ? 'Booth updated' : 'Booth added', 'success');
      onDone();
    },
    onError: (e) => show(e.message, 'error'),
  });

  function submit(e) {
    e.preventDefault();
    if (!editing && !code.trim()) return show('UNIQUE_CODE is required', 'error');
    if (!String(form.boothName).trim() && !String(form.pollingStationName).trim()) {
      return show('Give the booth a name', 'error');
    }
    mut.mutate();
  }

  return (
    <form onSubmit={submit} className="border border-slate-300 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-900">{editing ? 'Edit booth' : 'New booth'}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <input
          className={`${input} ${editing ? 'bg-slate-100 text-slate-500' : ''}`}
          placeholder="UNIQUE_CODE *"
          value={editing ? initial.code : code}
          readOnly={editing}
          title={editing ? 'UNIQUE_CODE is immutable' : undefined}
          onChange={(e) => setCode(e.target.value)}
        />
        {BOOTH_FIELDS.map((fld) => (
          <input
            key={fld.k}
            className={`${input} ${fld.wide ? 'col-span-2' : ''}`}
            placeholder={fld.ph}
            value={form[fld.k]}
            onChange={(e) => setForm((s) => ({ ...s, [fld.k]: e.target.value }))}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <button type="submit" className={btnPrimary} disabled={mut.isPending}>{editing ? 'Save' : 'Add booth'}</button>
        <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function BoothRow({ station, parlId, asmId, boothKey }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const inUse = (station.electionsCount ?? 0) > 0;

  const del = useMutation({
    mutationFn: () => api.masterBoothDelete(station.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master-booths', boothKey] }); show('Booth deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-slate-50">
        <td className="px-3 py-2" colSpan={5}>
          <BoothForm parlId={parlId} asmId={asmId} boothKey={boothKey} initial={station} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  const displayName = station.boothName || station.name || station.pollingStationName || '—';
  const location = [station.mainTown, station.block, station.district, station.pinCode]
    .filter(Boolean).join(' · ') || '—';

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800">{displayName}</div>
        <div className="font-mono text-[11px] text-slate-400">{station.code}</div>
      </td>
      <td className="px-3 py-2 text-center text-slate-600">{station.partNumber ?? '—'}</td>
      <td className="px-3 py-2 text-slate-600">{location}</td>
      <td className="px-3 py-2 text-center">
        {inUse
          ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{station.electionsCount}</span>
          : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700" title="Not used by any election yet">unused</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {inUse && (
            <Link to={`/elections/booths/station/${station.id}`} className={`${btnGhost} px-2 py-1`} title="Open booth analytics">View</Link>
          )}
          <IconBtn title="Edit booth" onClick={() => setEditing(true)}><PencilIcon /></IconBtn>
          <IconBtn
            title={inUse ? 'In use — cannot delete' : 'Delete booth'}
            danger
            onClick={async () => {
              if (inUse) { show(`This booth is used in ${station.electionsCount} election${station.electionsCount === 1 ? '' : 's'} — remove it from those results first.`, 'error'); return; }
              if (await confirm({ title: 'Delete booth?', message: `Delete booth "${displayName}" (${station.code})?`, confirmText: 'Delete' })) del.mutate();
            }}
          >
            <TrashIcon />
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

// Two-phase bulk-upload preview shown in a modal: parsed rows + per-row flags.
function BoothUploadModal({ preview, parlId, asmId, boothKey, onClose }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const rows = preview?.rows ?? [];
  const validRows = rows.filter((r) => Object.keys(r.__errors ?? {}).length === 0);

  const commit = useMutation({
    mutationFn: () => api.masterBoothsCommit({
      parlId: Number(parlId),
      asmId: asmId ? Number(asmId) : undefined,
      rows: validRows.map((r) => {
        const out = { code: r.code };
        for (const k of BOOTH_SHEET_COLS) if (r[k]) out[k] = r[k];
        return out;
      }),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['master-booths', boothKey] });
      show(`${res.created} created · ${res.updated} updated`, 'success');
      onClose();
    },
    onError: (e) => show(e.message, 'error'),
  });

  return (
    <Modal
      open={!!preview}
      onClose={onClose}
      size="xl"
      title={`Review booths — ${preview?.fileName ?? ''}`}
      footer={(
        <>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={validRows.length === 0 || commit.isPending} onClick={() => commit.mutate()}>
            {commit.isPending ? 'Saving…' : `Commit ${validRows.length} booth${validRows.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        <span className="text-slate-600"><strong className="text-slate-900">{preview?.totalRows ?? 0}</strong> rows</span>
        <span className="text-emerald-700">{preview?.createCount ?? 0} new</span>
        <span className="text-sky-700">{preview?.updateCount ?? 0} update</span>
        {preview?.errorCount > 0 && <span className="text-rose-700">{preview.errorCount} error{preview.errorCount === 1 ? '' : 's'} (skipped)</span>}
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-sm border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">UNIQUE_CODE</th>
              <th className="px-2 py-1.5">Booth name</th>
              <th className="px-2 py-1.5">Part</th>
              <th className="px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const err = Object.values(r.__errors ?? {})[0];
              return (
                <tr key={i} className={`border-t border-slate-100 ${err ? 'bg-rose-50' : ''}`}>
                  <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1 font-mono text-[12px] text-slate-700">{r.code || '—'}</td>
                  <td className="px-2 py-1 text-slate-700">{r.boothName || r.pollingStationName || '—'}</td>
                  <td className="px-2 py-1 text-slate-500">{r.partNumber || '—'}</td>
                  <td className="px-2 py-1">
                    {err
                      ? <span className="text-rose-700">{err}</span>
                      : r.__exists
                        ? <span className="text-sky-700">update</span>
                        : <span className="text-emerald-700">new</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function BoothsTab() {
  const { show } = useToast();
  // Cascading geography to pick the constituency (same source as the Elections tab).
  const statesQ = useQuery({ queryKey: ['master-geo', 'states', 'root'], queryFn: () => api.masterGeoList('states') });
  const [stateId, setStateId] = useState('');
  const parlQ = useQuery({ queryKey: ['master-geo', 'parliamentary', stateId], queryFn: () => api.masterGeoList('parliamentary', { stateId }), enabled: !!stateId });
  const [parlId, setParlId] = useState('');
  const asmQ = useQuery({ queryKey: ['master-geo', 'assembly', parlId], queryFn: () => api.masterGeoList('assembly', { parlId }), enabled: !!parlId });
  const [asmId, setAsmId] = useState('');
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const parl = (parlQ.data?.items ?? []).find((p) => String(p.id) === String(parlId));
  const asm = (asmQ.data?.items ?? []).find((a) => String(a.id) === String(asmId));
  // Booths belong to a PC (AC optional — UTs with no assembly). The list/query
  // key is scoped by both so switching constituency refetches cleanly.
  const boothKey = `${parlId || ''}:${asmId || ''}`;

  const boothsQ = useQuery({
    queryKey: ['master-booths', boothKey],
    queryFn: () => api.masterBooths({ parlId, asmId: asmId || undefined }),
    enabled: !!parlId,
  });
  const booths = boothsQ.data?.items ?? [];
  const unused = booths.filter((b) => (b.electionsCount ?? 0) === 0).length;

  const previewM = useMutation({
    mutationFn: (file) => api.masterBoothsPreview(file),
    onSuccess: (data) => setPreview(data),
    onError: (e) => show(e.message, 'error'),
  });

  async function exportBooths() {
    try {
      const p = new URLSearchParams();
      if (parlId) p.set('parlId', parlId);
      if (asmId) p.set('asmId', asmId);
      await downloadBlob(`/api/master/booths/export?${p.toString()}`, 'booths_export.xlsx');
    } catch (e) {
      show(e.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        The master booth registry — one stable row per physical booth, keyed by your immutable <strong>UNIQUE_CODE</strong>. Create booths here (single-add or bulk Excel); Form 20 and voter imports only ever look them up by code. Pick a constituency (AC optional for UTs) to begin.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select className={input} value={stateId} onChange={(e) => { setStateId(e.target.value); setParlId(''); setAsmId(''); }}>
          <option value="">State…</option>
          {(statesQ.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={input} value={parlId} disabled={!stateId} onChange={(e) => { setParlId(e.target.value); setAsmId(''); }}>
          <option value="">Parliamentary…</option>
          {(parlQ.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.number} — {p.name}</option>)}
        </select>
        <select className={input} value={asmId} disabled={!parlId} onChange={(e) => setAsmId(e.target.value)}>
          <option value="">Assembly (optional)…</option>
          {(asmQ.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
        </select>
      </div>

      {!parl && <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">Pick a parliamentary constituency to manage its booths.</div>}

      {parl && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              <strong className="text-slate-900">{booths.length}</strong> booths in {parl.number}-{parl.name}{asm ? ` · ${asm.number}-${asm.name}` : ''}
              {unused > 0 && <span className="ml-2 text-amber-700">· {unused} unused</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href={downloadUrls.boothTemplate({ pcId: parlId, acId: asmId, pcName: parl ? `${parl.number} — ${parl.name}` : '', acName: asm ? `${asm.number} — ${asm.name}` : '' })}
                className={`${btnGhost} px-2 py-1`}
                title="Download a booth sheet seeded with this constituency"
              >
                <DownloadIcon /> Template
              </a>
              <button className={`${btnGhost} px-2 py-1`} onClick={() => fileRef.current?.click()} disabled={previewM.isPending}>
                <UploadGlyph /> {previewM.isPending ? 'Parsing…' : 'Upload'}
              </button>
              <button className={`${btnGhost} px-2 py-1`} onClick={exportBooths}>
                <DownloadIcon /> Export
              </button>
              {!adding && <button className={btnPrimary} onClick={() => setAdding(true)}>+ Add booth</button>}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv,.tsv,.ods"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) previewM.mutate(f); e.target.value = ''; }}
          />

          {adding && <BoothForm parlId={parlId} asmId={asmId} boothKey={boothKey} onDone={() => setAdding(false)} />}

          <div className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Booth</th>
                  <th className="px-3 py-2 text-center">Part</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-center">Elections</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {boothsQ.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
                {!boothsQ.isLoading && booths.map((b) => (
                  <BoothRow key={b.id} station={b} parlId={parlId} asmId={asmId} boothKey={boothKey} />
                ))}
                {!boothsQ.isLoading && booths.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No booths yet — add one, or upload a booth sheet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {preview && (
        <BoothUploadModal
          preview={preview}
          parlId={parlId}
          asmId={asmId}
          boothKey={boothKey}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ─── Surname rules (surname → caste / category / religion) ──────────────────

// Parse a pasted table into rules. Accepts tab- or comma-separated rows, drops a
// leading serial (S.No) column and a header row, maps: surname, caste, category,
// religion (extra columns ignored). Handles the "S.No | Surname | Group" shape.
function parseSurnameBulk(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
    if (cells.length > 2 && /^\d+$/.test(cells[0])) cells = cells.slice(1); // drop S.No
    const [surname, caste, category, religion] = cells;
    if (!surname) continue;
    const low = surname.toLowerCase();
    if (low === 'surname' || low === 's.no' || low === 'sno') continue; // header
    out.push({ surname, caste: caste || undefined, category: category || undefined, religion: religion || undefined });
  }
  return out;
}

function SurnameRuleRow({ rule }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ caste: rule.caste ?? '', category: rule.category ?? '', religion: rule.religion ?? '' });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['surname-rules'] });

  const save = useMutation({
    mutationFn: () => api.masterSurnameRuleUpdate(rule.id, {
      caste: form.caste.trim() || null, category: form.category.trim() || null, religion: form.religion.trim() || null,
    }),
    onSuccess: () => { invalidate(); show('Rule updated', 'success'); setEditing(false); },
    onError: (e) => show(e.message, 'error'),
  });
  const toggle = useMutation({
    mutationFn: () => api.masterSurnameRuleUpdate(rule.id, { active: !rule.active }),
    onSuccess: invalidate,
    onError: (e) => show(e.message, 'error'),
  });
  const del = useMutation({
    mutationFn: () => api.masterSurnameRuleDelete(rule.id),
    onSuccess: () => { invalidate(); show('Rule deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-slate-50">
        <td className="px-3 py-2 font-mono text-xs text-slate-700">{rule.surname}</td>
        <td className="px-2 py-2"><input className={input} value={form.caste} onChange={(e) => setForm((s) => ({ ...s, caste: e.target.value }))} placeholder="Caste" /></td>
        <td className="px-2 py-2"><input className={input} value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} placeholder="Category" /></td>
        <td className="px-2 py-2"><input className={input} value={form.religion} onChange={(e) => setForm((s) => ({ ...s, religion: e.target.value }))} placeholder="Religion" /></td>
        <td className="px-3 py-2 text-right">
          <button className={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
          <button className={`${btnGhost} ml-1`} onClick={() => setEditing(false)}>Cancel</button>
        </td>
      </tr>
    );
  }
  return (
    <tr className={`group border-t border-slate-100 ${rule.active ? '' : 'opacity-50'}`}>
      <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">{rule.surname}</td>
      <td className="px-3 py-2 text-slate-700">{rule.caste || <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2 text-slate-700">{rule.category || <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2 text-slate-700">{rule.religion || <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => toggle.mutate()}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rule.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
          >
            {rule.active ? 'Active' : 'Off'}
          </button>
          <IconBtn title="Edit" onClick={() => setEditing(true)}><PencilIcon /></IconBtn>
          <IconBtn title="Delete" danger onClick={async () => { if (await confirm({ title: 'Delete rule?', message: `Delete the rule for "${rule.surname}"?`, confirmText: 'Delete' })) del.mutate(); }}><TrashIcon /></IconBtn>
        </div>
      </td>
    </tr>
  );
}

function SurnamesTab() {
  const { show } = useToast();
  const qc = useQueryClient();
  const [nf, setNf] = useState({ surname: '', caste: '', category: '', religion: '' });
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [q, setQ] = useState('');

  const rulesQ = useQuery({ queryKey: ['surname-rules'], queryFn: () => api.masterSurnameRules() });
  const rules = rulesQ.data?.items ?? [];
  const filtered = q ? rules.filter((r) => r.surname.toLowerCase().includes(q.toLowerCase())) : rules;

  const add = useMutation({
    mutationFn: () => api.masterSurnameRuleCreate({
      surname: nf.surname.trim(), caste: nf.caste.trim() || null, category: nf.category.trim() || null, religion: nf.religion.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surname-rules'] }); setNf({ surname: '', caste: '', category: '', religion: '' }); show('Rule added', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });
  const bulkM = useMutation({
    mutationFn: () => api.masterSurnameRulesBulk(parseSurnameBulk(bulk)),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['surname-rules'] }); setBulk(''); setShowBulk(false); show(`${res.created} added · ${res.updated} updated`, 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  const parsedCount = parseSurnameBulk(bulk).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Map a <strong>surname</strong> (voter's last name) to a caste, category and/or religion. On voter import, any <strong>blank</strong> caste/category/religion cell is seeded from the matching rule (case-insensitive); filled cells are kept, and surnames with no rule are left blank.
      </p>

      {/* Add single rule */}
      <div className="rounded-sm border border-slate-300 bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-900">New rule</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className={input} placeholder="Surname *" value={nf.surname} onChange={(e) => setNf((s) => ({ ...s, surname: e.target.value }))} />
          <input className={input} placeholder="Caste" value={nf.caste} onChange={(e) => setNf((s) => ({ ...s, caste: e.target.value }))} />
          <input className={input} placeholder="Category" value={nf.category} onChange={(e) => setNf((s) => ({ ...s, category: e.target.value }))} />
          <input className={input} placeholder="Religion" value={nf.religion} onChange={(e) => setNf((s) => ({ ...s, religion: e.target.value }))} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button className={btnPrimary} disabled={!nf.surname.trim() || add.isPending} onClick={() => add.mutate()}>Add rule</button>
          <button className={btnGhost} onClick={() => setShowBulk((v) => !v)}>{showBulk ? 'Hide bulk paste' : 'Bulk paste…'}</button>
        </div>
        {showBulk && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="mb-1 text-xs text-slate-500">
              Paste rows from Excel — columns: <code>Surname</code>, <code>Caste</code>, <code>Category</code>, <code>Religion</code> (a leading S.No column and a header row are ignored). Existing surnames are updated.
            </div>
            <textarea
              className={`${input} h-36 font-mono text-xs`}
              placeholder={'Barreto\tBamonn / Chardo\nCosta\tChardo\nMascarenhas\tBamonn'}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <button className={btnPrimary} disabled={parsedCount === 0 || bulkM.isPending} onClick={() => bulkM.mutate()}>
                {bulkM.isPending ? 'Importing…' : `Import ${parsedCount} rule${parsedCount === 1 ? '' : 's'}`}
              </button>
              <button className={btnGhost} onClick={() => setBulk('')}>Clear</button>
            </div>
          </div>
        )}
      </div>

      {/* Rules table */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-slate-600"><strong className="text-slate-900">{rules.length}</strong> rule{rules.length === 1 ? '' : 's'}</div>
        <input className={`${input} max-w-xs`} placeholder="Search surname…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Surname</th>
              <th className="px-3 py-2">Caste</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Religion</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rulesQ.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!rulesQ.isLoading && filtered.map((r) => <SurnameRuleRow key={r.id} rule={r} />)}
            {!rulesQ.isLoading && filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">{q ? 'No matches.' : 'No rules yet — add one or bulk-paste your surname table.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page shell ─────────────────────────────────────────────────────────────

export default function AllMasterPage() {
  const { show } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('geography');

  const sync = useMutation({
    mutationFn: () => api.masterSync(),
    onSuccess: (r) => {
      qc.invalidateQueries();
      const s = r?.summary ?? {};
      show(`Synced from data — +${s.states ?? 0} states, +${s.assembly ?? 0} assemblies, +${s.options ?? 0} options`, 'success');
    },
    onError: (e) => show(e.message, 'error'),
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Master Data</h1>
          <p className="mt-0.5 text-sm text-slate-500">One place to manage every reference list the app uses.</p>
        </div>
        <button className={btnGhost} onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? 'Syncing…' : 'Sync from existing data'}
        </button>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-300">
        {[['geography', 'Geography'], ['elections', 'Elections'], ['booths', 'Booths'], ['candidates', 'Candidates'], ['surnames', 'Surname Rules'], ['lists', 'Lookup Lists']].map(([id, lbl]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'geography' && <GeographyTab />}
      {tab === 'elections' && <ElectionsTab />}
      {tab === 'booths' && <BoothsTab />}
      {tab === 'candidates' && <CandidatesTab />}
      {tab === 'surnames' && <SurnamesTab />}
      {tab === 'lists' && <ListsTab />}
    </div>
  );
}
