// Tiny fetch wrapper for the Electioneering backend API.
// Base URL via Vite env (VITE_API_URL), defaults to local backend.

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
    body: isForm ? body : body == null ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j.message || j.error || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    const err = new Error(`${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ─── Voters ─────────────────────────────────────────────────
  listVoters: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/voters${q ? '?' + q : ''}`);
  },
  createVoter: (data) => request('/api/voters', { method: 'POST', body: data }),
  bulkVoters: (voters) => request('/api/voters/bulk', { method: 'POST', body: { voters } }),
  deleteVoter: (id) => request(`/api/voters/${id}`, { method: 'DELETE' }),

  // ─── Elections / Form 20 ────────────────────────────────────
  listElections: () => request('/api/elections'),
  getElection: (id) => request(`/api/elections/${id}`),
  createElection: (data) => request('/api/elections', { method: 'POST', body: data }),
  updateElection: (id, data) => request(`/api/elections/${id}`, { method: 'PUT', body: data }),
  addCandidate: (id, data) =>
    request(`/api/elections/${id}/candidates`, { method: 'POST', body: data }),
  updateCandidate: (id, cid, data) =>
    request(`/api/elections/${id}/candidates/${cid}`, { method: 'PUT', body: data }),
  deleteCandidate: (id, cid) =>
    request(`/api/elections/${id}/candidates/${cid}`, { method: 'DELETE' }),
  saveForm20: (id, rows) =>
    request(`/api/elections/${id}/form20`, { method: 'PUT', body: { rows } }),

  // ─── Uploads ────────────────────────────────────────────────
  previewUpload: (file, kind) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/api/uploads/preview?kind=${kind}`, { method: 'POST', body: fd });
  },
  commitVoters: (payload) =>
    request('/api/uploads/voters/commit', { method: 'POST', body: payload }),
  commitForm20: (payload) =>
    request('/api/uploads/form20/commit', { method: 'POST', body: payload }),
  uploadHistory: () => request('/api/uploads/history'),

  // ─── Segmentation + analytics ──────────────────────────────
  segment: (criteria) =>
    request('/api/voters/segment', { method: 'POST', body: criteria }),
  recomputeLeaning: (electionId) =>
    request(`/api/analytics/recompute?electionId=${electionId}&link=1`, { method: 'POST' }),
  boothLeaning: (electionId) =>
    request(`/api/analytics/booth-leaning?electionId=${electionId}`),

  // ─── Cohorts ───────────────────────────────────────────────
  listCohorts: () => request('/api/cohorts'),
  getCohort: (id) => request(`/api/cohorts/${id}`),
  createCohort: (data) => request('/api/cohorts', { method: 'POST', body: data }),
  updateCohort: (id, data) =>
    request(`/api/cohorts/${id}`, { method: 'PUT', body: data }),
  deleteCohort: (id) => request(`/api/cohorts/${id}`, { method: 'DELETE' }),
  cohortVoters: (id) => request(`/api/cohorts/${id}/voters`),
};

// Direct download URLs (use as href / window.open)
export const downloadUrls = {
  cohortExport: (id) => `${BASE}/api/cohorts/${id}/export`,
  segmentExport: () => `${BASE}/api/cohorts/preview-export`, // POST
};

export { BASE as API_BASE };
