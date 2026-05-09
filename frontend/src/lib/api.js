// Tiny fetch wrapper for the Electioneering backend API.
// Base URL via Vite env (VITE_API_URL), defaults to local backend.
// Attaches Authorization Bearer token from localStorage; bounces to /login
// on 401 (except for the login/me endpoints themselves).

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const NO_REDIRECT_PATHS = new Set(['/api/auth/login', '/api/auth/me']);

function getAuthToken() {
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const isForm = body instanceof FormData;
  const token = getAuthToken();
  const finalHeaders = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: finalHeaders,
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
    if (res.status === 401 && !NO_REDIRECT_PATHS.has(path)) {
      try {
        localStorage.removeItem('auth_token');
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }
    const err = new Error(`${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ─── Auth ───────────────────────────────────────────────────
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),
  listUsers: () => request('/api/auth/users'),
  createUser: (data) => request('/api/auth/users', { method: 'POST', body: data }),
  updateUser: (id, data) =>
    request(`/api/auth/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id) => request(`/api/auth/users/${id}`, { method: 'DELETE' }),

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
