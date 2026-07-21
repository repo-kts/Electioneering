import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadUrls } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

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
                <IconBtn title="Delete" danger onClick={() => { if (confirm(`Delete ${spec.render(it)}?`)) del.mutate(it.id); }}><TrashIcon /></IconBtn>
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
        <IconBtn title="Delete" danger onClick={() => { if (confirm(`Delete "${option.label}"?`)) del.mutate(); }}><TrashIcon /></IconBtn>
      </span>
    </div>
  );
}

function ListsTab() {
  const { show } = useToast();
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
                <button className={`${btnGhost} text-rose-600`} onClick={() => { if (confirm(`Delete the "${catQ.data.label}" list and all its options?`)) delCat.mutate(catQ.data.id); }}>Delete list</button>
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
          <IconBtn title="Delete election" danger onClick={() => { if (confirm(`Delete election #${election.id} (${election.assemblyName})? This removes its booths & results.`)) onDelete(election.id); }}><TrashIcon /></IconBtn>
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

// ─── Booths (physical polling-station registry, per constituency) ───────────

// Editable attributes of a physical booth. `name` drives the dedup `code`, so
// it's shown but renaming is display-only (code stays fixed once created).
const BOOTH_FIELDS = [
  { k: 'name', ph: 'Booth / polling-station name', req: true, wide: true },
  { k: 'ward', ph: 'Ward no.' },
  { k: 'cityVillage', ph: 'City / Village' },
  { k: 'tolaMohalla', ph: 'Tola / Mohalla' },
  { k: 'postOffice', ph: 'Post office' },
  { k: 'policeStation', ph: 'Police station' },
  { k: 'address', ph: 'Address', wide: true },
  { k: 'latitude', ph: 'Latitude', num: true },
  { k: 'longitude', ph: 'Longitude', num: true },
];

function BoothForm({ assemblyNo, assemblyName, initial, onDone }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const editing = !!initial;
  const [form, setForm] = useState(() => {
    const f = {};
    for (const fld of BOOTH_FIELDS) f[fld.k] = initial?.[fld.k] ?? '';
    return f;
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = { assemblyNo, assemblyName };
      for (const fld of BOOTH_FIELDS) {
        const v = String(form[fld.k] ?? '').trim();
        if (fld.num) payload[fld.k] = v === '' ? undefined : Number(v);
        else payload[fld.k] = v === '' ? undefined : v;
      }
      return editing ? api.masterBoothUpdate(initial.id, payload) : api.masterBoothCreate(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-booths', assemblyNo, assemblyName] });
      show(editing ? 'Booth updated' : 'Booth added', 'success');
      onDone();
    },
    onError: (e) => show(e.message, 'error'),
  });

  function submit(e) {
    e.preventDefault();
    if (!String(form.name).trim()) return show('Booth name is required', 'error');
    mut.mutate();
  }

  return (
    <form onSubmit={submit} className="border border-slate-300 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-900">{editing ? `Edit booth` : 'New booth'}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {BOOTH_FIELDS.map((fld) => (
          <input
            key={fld.k}
            className={`${input} ${fld.wide ? 'col-span-2' : ''}`}
            placeholder={fld.ph + (fld.req ? ' *' : '')}
            type={fld.num ? 'number' : 'text'}
            step={fld.num ? 'any' : undefined}
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

function BoothRow({ station, assemblyNo, assemblyName }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const inUse = (station.electionsCount ?? 0) > 0;
  const hasCoords = station.latitude != null && station.longitude != null;

  const del = useMutation({
    mutationFn: () => api.masterBoothDelete(station.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master-booths', assemblyNo, assemblyName] }); show('Booth deleted', 'success'); },
    onError: (e) => show(e.message, 'error'),
  });

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-slate-50">
        <td className="px-3 py-2" colSpan={6}>
          <BoothForm assemblyNo={assemblyNo} assemblyName={assemblyName} initial={station} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  const location = [station.ward && `Ward ${station.ward}`, station.cityVillage, station.tolaMohalla]
    .filter(Boolean).join(' · ') || '—';

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800">{station.name ?? '—'}</div>
        <div className="font-mono text-[11px] text-slate-400">{station.code}</div>
      </td>
      <td className="px-3 py-2 text-slate-600">{location}</td>
      <td className="px-3 py-2 text-center">
        {hasCoords
          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Geo</span>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {inUse
          ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{station.electionsCount}</span>
          : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700" title="Not used by any Form 20 yet">orphan</span>}
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
            onClick={() => {
              if (inUse) { show(`This booth is used in ${station.electionsCount} election${station.electionsCount === 1 ? '' : 's'} — remove it from Form 20 first.`, 'error'); return; }
              if (confirm(`Delete booth "${station.name}"? This is an unused physical station.`)) del.mutate();
            }}
          >
            <TrashIcon />
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function BoothsTab() {
  // Cascading geography to pick the constituency (same source as the Elections tab).
  const statesQ = useQuery({ queryKey: ['master-geo', 'states', 'root'], queryFn: () => api.masterGeoList('states') });
  const [stateId, setStateId] = useState('');
  const parlQ = useQuery({ queryKey: ['master-geo', 'parliamentary', stateId], queryFn: () => api.masterGeoList('parliamentary', { stateId }), enabled: !!stateId });
  const [parlId, setParlId] = useState('');
  const asmQ = useQuery({ queryKey: ['master-geo', 'assembly', parlId], queryFn: () => api.masterGeoList('assembly', { parlId }), enabled: !!parlId });
  const [asmId, setAsmId] = useState('');
  const [adding, setAdding] = useState(false);

  const asm = (asmQ.data?.items ?? []).find((a) => String(a.id) === String(asmId));
  const assemblyNo = asm ? String(asm.number) : undefined;
  const assemblyName = asm ? asm.name : undefined;

  const boothsQ = useQuery({
    queryKey: ['master-booths', assemblyNo, assemblyName],
    queryFn: () => api.masterBooths({ assemblyNo, assemblyName }),
    enabled: !!assemblyNo && !!assemblyName,
  });
  const booths = boothsQ.data?.items ?? [];
  const orphans = booths.filter((b) => (b.electionsCount ?? 0) === 0).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        The physical booth (polling-station) registry for a constituency — shared across every election held there. Editing a booth's name/address/coordinates updates it everywhere. Booths used in a Form 20 are protected; unused (orphan) booths can be deleted.
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
          <option value="">Constituency…</option>
          {(asmQ.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
        </select>
      </div>

      {!asm && <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">Pick a constituency to manage its booths.</div>}

      {asm && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              <strong className="text-slate-900">{booths.length}</strong> booths in {assemblyNo}-{assemblyName}
              {orphans > 0 && <span className="ml-2 text-amber-700">· {orphans} orphan{orphans === 1 ? '' : 's'}</span>}
            </div>
            {!adding && <button className={btnPrimary} onClick={() => setAdding(true)}>+ Add booth</button>}
          </div>

          {adding && <BoothForm assemblyNo={assemblyNo} assemblyName={assemblyName} onDone={() => setAdding(false)} />}

          <div className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Booth</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-center">Coords</th>
                  <th className="px-3 py-2 text-center">Elections</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {boothsQ.isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
                {!boothsQ.isLoading && booths.map((b) => (
                  <BoothRow key={b.id} station={b} assemblyNo={assemblyNo} assemblyName={assemblyName} />
                ))}
                {!boothsQ.isLoading && booths.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No booths yet — add one, or upload this constituency's Form 20.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
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
        {[['geography', 'Geography'], ['elections', 'Elections'], ['booths', 'Booths'], ['candidates', 'Candidates'], ['lists', 'Lookup Lists']].map(([id, lbl]) => (
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
      {tab === 'lists' && <ListsTab />}
    </div>
  );
}
