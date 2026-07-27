// Tiny fetch wrapper for the Electioneering backend API.
// Base URL via Vite env (VITE_API_URL), defaults to local backend.
// Attaches Authorization Bearer token from localStorage; bounces to /login
// on 401 (except for the login/me endpoints themselves).

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Warn when VITE_API_URL isn't configured so the fallback isn't mistaken for
// intended config — the earlier `undefined/api/...` bug was silent otherwise.
if (!import.meta.env.VITE_API_URL) {
    console.warn(
        `[api] VITE_API_URL is not set — falling back to ${BASE}. ` +
        `Create frontend/.env with VITE_API_URL=<backend-url> to override.`
    );
}

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
        // Prefer the backend's plain-language `message`; never surface raw JSON,
        // status codes, or technical error names to the user.
        let message = '';
        try {
            const j = await res.json();
            if (j && typeof j.message === 'string') message = j.message;
        } catch {
            /* non-JSON body — ignore, fall back below */
        }
        if (!message) {
            message = res.status >= 500
                ? 'Something went wrong. Please try again.'
                : "Couldn't complete that request. Please check your input and try again.";
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
        const err = new Error(message);
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
    updateVoter: (id, data) => request(`/api/voters/${id}`, { method: 'PUT', body: data }),
    bulkVoters: (voters) => request('/api/voters/bulk', { method: 'POST', body: { voters } }),
    deleteVoter: (id) => request(`/api/voters/${id}`, { method: 'DELETE' }),

    // ─── Elections / Form 20 ────────────────────────────────────
    listElections: () => request('/api/elections'),
    getElection: (id) => request(`/api/elections/${id}`),
    createElection: (data) => request('/api/elections', { method: 'POST', body: data }),
    updateElection: (id, data) => request(`/api/elections/${id}`, { method: 'PUT', body: data }),
    deleteElection: (id) => request(`/api/elections/${id}`, { method: 'DELETE' }),
    copyVoters: (targetElectionId, fromElectionId) =>
        request(`/api/elections/${targetElectionId}/copy-voters`, {
            method: 'POST',
            body: { fromElectionId },
        }),
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
    classifyVoters: (assemblyNo, force = false) => {
        const p = new URLSearchParams();
        if (assemblyNo) p.set('assemblyNo', assemblyNo);
        if (force) p.set('force', '1');
        const qs = p.toString();
        return request(`/api/voters/classify${qs ? '?' + qs : ''}`, { method: 'POST' });
    },
    recomputeLeaning: (electionId) =>
        request(`/api/analytics/recompute?electionId=${electionId}&link=1`, { method: 'POST' }),
    boothLeaning: (electionId) =>
        request(`/api/analytics/booth-leaning?electionId=${electionId}`),
    boothDetail: (psId) => request(`/api/analytics/booth/${psId}`),
    geocodeBooths: (electionId, force = false) =>
        request(`/api/analytics/geocode?electionId=${electionId}${force ? '&force=1' : ''}`, { method: 'POST' }),
    analyticsOverview: (electionId) =>
        request(`/api/analytics/overview${electionId ? '?electionId=' + electionId : ''}`),
    strategyBrief: (electionId, candidate) => {
        const p = new URLSearchParams({ electionId });
        if (candidate) p.set('candidate', candidate);
        return request(`/api/analytics/strategy?${p.toString()}`);
    },
    partyAnalytics: (electionId) => request(`/api/analytics/party?electionId=${electionId}`),
    assemblyTimeline: ({ assemblyNo, assemblyName, limit } = {}) => {
        const p = new URLSearchParams();
        if (assemblyNo) p.set('assemblyNo', assemblyNo);
        if (assemblyName) p.set('assemblyName', assemblyName);
        if (limit) p.set('limit', String(limit));
        return request(`/api/analytics/assembly-timeline?${p.toString()}`);
    },
    electionsHierarchy: () => request('/api/analytics/hierarchy'),
    // Booth-wise election: constituencies (deduped across types), a
    // constituency's physical booths, and one booth across every election.
    constituencies: () => request('/api/analytics/constituencies'),
    constituencyBooths: ({ assemblyNo, assemblyName, electionYear, electionType } = {}) => {
        const p = new URLSearchParams();
        if (assemblyNo) p.set('assemblyNo', assemblyNo);
        if (assemblyName) p.set('assemblyName', assemblyName);
        if (electionYear) p.set('electionYear', electionYear);
        if (electionType) p.set('electionType', electionType);
        return request(`/api/analytics/constituency-booths?${p.toString()}`);
    },
    pollingStation: (psId) => request(`/api/analytics/polling-station/${psId}`),

    // ─── Targeting + correlation ───────────────────────────────
    boothTargets: (electionId, ourCandidate) => {
        const p = new URLSearchParams({ electionId });
        if (ourCandidate) p.set('ourCandidate', ourCandidate);
        return request(`/api/analytics/booth-targets?${p.toString()}`);
    },
    turnoutGap: (electionId, ourCandidate) => {
        const p = new URLSearchParams({ electionId });
        if (ourCandidate) p.set('ourCandidate', ourCandidate);
        return request(`/api/analytics/turnout-gap?${p.toString()}`);
    },
    communityLeaning: (electionId, dimension = 'religion') =>
        request(`/api/analytics/community-leaning?electionId=${electionId}&dimension=${dimension}`),
    swing: (electionA, electionB) =>
        request(`/api/analytics/swing?electionA=${electionA}&electionB=${electionB}`),
    reportCard: (electionId, candidate) => {
        const p = new URLSearchParams({ electionId, format: 'json' });
        if (candidate) p.set('candidate', candidate);
        return request(`/api/reports/candidate?${p.toString()}`);
    },

    // ─── Households ────────────────────────────────────────────
    listHouseholds: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/api/households${q ? '?' + q : ''}`);
    },
    getHousehold: (id) => request(`/api/households/${id}`),
    rebuildHouseholds: (assemblyNo) =>
        request(`/api/households/rebuild${assemblyNo ? '?assemblyNo=' + assemblyNo : ''}`, {
            method: 'POST',
        }),

    // ─── Cohorts ───────────────────────────────────────────────
    listCohorts: () => request('/api/cohorts'),
    getCohort: (id) => request(`/api/cohorts/${id}`),
    createCohort: (data) => request('/api/cohorts', { method: 'POST', body: data }),
    updateCohort: (id, data) =>
        request(`/api/cohorts/${id}`, { method: 'PUT', body: data }),
    deleteCohort: (id) => request(`/api/cohorts/${id}`, { method: 'DELETE' }),
    cohortVoters: (id) => request(`/api/cohorts/${id}/voters`),

    // ─── Master data (geography hierarchy + lookup lists) ──────
    masterTree: () => request('/api/master/geography/tree'),
    masterOptions: (key) => request(`/api/master/options/${key}`),
    masterCategories: () => request('/api/master/categories'),
    masterCategory: (key) => request(`/api/master/categories/${key}`),
    // geography CRUD — level ∈ countries | states | parliamentary | assembly
    masterGeoList: (level, params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/api/master/${level}${q ? '?' + q : ''}`);
    },
    masterGeoCreate: (level, data) => request(`/api/master/${level}`, { method: 'POST', body: data }),
    masterGeoUpdate: (level, id, data) => request(`/api/master/${level}/${id}`, { method: 'PUT', body: data }),
    masterGeoDelete: (level, id) => request(`/api/master/${level}/${id}`, { method: 'DELETE' }),
    // category CRUD
    masterCreateCategory: (data) => request('/api/master/categories', { method: 'POST', body: data }),
    masterUpdateCategory: (id, data) => request(`/api/master/categories/${id}`, { method: 'PUT', body: data }),
    masterDeleteCategory: (id) => request(`/api/master/categories/${id}`, { method: 'DELETE' }),
    // option CRUD
    masterCreateOption: (key, data) => request(`/api/master/categories/${key}/options`, { method: 'POST', body: data }),
    masterUpdateOption: (id, data) => request(`/api/master/options/${id}`, { method: 'PUT', body: data }),
    masterDeleteOption: (id) => request(`/api/master/options/${id}`, { method: 'DELETE' }),
    masterSync: () => request('/api/master/sync', { method: 'POST' }),
    // Master booth registry — keyed by UNIQUE_CODE, filtered by PC/AC.
    masterBooths: ({ parlId, asmId, assemblyNo, assemblyName } = {}) => {
        const p = new URLSearchParams();
        if (parlId) p.set('parlId', parlId);
        if (asmId) p.set('asmId', asmId);
        if (assemblyNo) p.set('assemblyNo', assemblyNo);
        if (assemblyName) p.set('assemblyName', assemblyName);
        return request(`/api/master/polling-stations?${p.toString()}`);
    },
    masterBoothCreate: (data) => request('/api/master/polling-stations', { method: 'POST', body: data }),
    masterBoothUpdate: (id, data) => request(`/api/master/polling-stations/${id}`, { method: 'PUT', body: data }),
    masterBoothDelete: (id) => request(`/api/master/polling-stations/${id}`, { method: 'DELETE' }),
    // Bulk booth creation (two-phase, Excel).
    masterBoothsPreview: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return request('/api/master/booths/preview', { method: 'POST', body: fd });
    },
    masterBoothsCommit: (payload) => request('/api/master/booths/commit', { method: 'POST', body: payload }),
    // Surname → caste/category/religion rules (seed blank voter cells at import).
    masterSurnameRules: () => request('/api/master/surname-rules'),
    masterSurnameRuleCreate: (data) => request('/api/master/surname-rules', { method: 'POST', body: data }),
    masterSurnameRuleUpdate: (id, data) => request(`/api/master/surname-rules/${id}`, { method: 'PUT', body: data }),
    masterSurnameRuleDelete: (id) => request(`/api/master/surname-rules/${id}`, { method: 'DELETE' }),
    masterSurnameRulesBulk: (rules) => request('/api/master/surname-rules/bulk', { method: 'POST', body: { rules } }),
};

// Direct download URLs (use as href / window.open) — only for PUBLIC endpoints
// (no Authorization header is sent by the browser for plain anchors).
export const downloadUrls = {
    voterTemplate: (sample = false, format = '', electionId = null) => {
        const p = new URLSearchParams();
        if (format) p.set('format', format);
        if (sample) p.set('sample', '1');
        if (electionId != null) p.set('electionId', String(electionId));
        const qs = p.toString();
        return `${BASE}/api/templates/voter${qs ? '?' + qs : ''}`;
    },
    form20Template: (sample = false, format = '', electionId = null) => {
        const p = new URLSearchParams();
        if (format) p.set('format', format);
        if (sample) p.set('sample', '1');
        if (electionId != null) p.set('electionId', String(electionId));
        const qs = p.toString();
        return `${BASE}/api/templates/form20${qs ? '?' + qs : ''}`;
    },
    // Booth-creation sheet, seeded with the chosen PC/AC (id + names).
    boothTemplate: ({ sample = false, format = '', pcId, acId, pcName, acName } = {}) => {
        const p = new URLSearchParams();
        if (format) p.set('format', format);
        if (sample) p.set('sample', '1');
        if (pcId != null) p.set('pcId', String(pcId));
        if (acId != null) p.set('acId', String(acId));
        if (pcName) p.set('pcName', pcName);
        if (acName) p.set('acName', acName);
        const qs = p.toString();
        return `${BASE}/api/templates/booths${qs ? '?' + qs : ''}`;
    },
};

// Authenticated blob download. Triggers browser save with the given filename.
export async function downloadBlob(path, filename, { method = 'GET', body } = {}) {
    const token = (() => {
        try { return localStorage.getItem('auth_token'); } catch { return null; }
    })();
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(isForm ? {} : body != null ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: isForm ? body : body == null ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
        let message = '';
        try {
            const j = await res.json();
            if (j && typeof j.message === 'string') message = j.message;
        } catch {
            /* ignore non-JSON body */
        }
        const err = new Error(message || "Couldn't download that file. Please try again.");
        err.status = res.status;
        throw err;
    }
    const blob = await res.blob();
    // try Content-Disposition for filename
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="?([^"]+)"?/.exec(cd);
    const finalName = m?.[1] || filename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return blob;
}

export { BASE as API_BASE };
