import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { registerPartyColors } from '../elections/helpers.js';
import { FullLoader } from '../ui/Loader.jsx';

const SECTIONS = [
    {
        title: 'Data Entry',
        items: [
            { to: '/voters', label: 'Voters', roles: ['admin', 'data_operator'] },
            { to: '/form-20', label: 'Vote Segment', roles: ['admin', 'data_operator'] },
        ],
    },
    {
        title: 'Insights',
        items: [
            { to: '/elections/assembly', label: 'Assembly Election', roles: ['admin'] },
            { to: '/elections/lok-sabha', label: 'General Election', roles: ['admin'] },
            { to: '/elections/booths', label: 'Booth wise votes', roles: ['admin'] },
            { to: '/households', label: 'Households', roles: ['admin'] },
            { to: '/segment', label: 'Voter search', roles: ['admin'] },
        ],
    },
    {
        title: 'Administration',
        items: [
            { to: '/all-master', label: 'Master Data', roles: ['admin'] },
        ],
    },
];

const ROLE_LABEL = { admin: 'Admin', data_operator: 'Data Operator' };

function initials(name = '') {
    return name.split(/[\s_]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}

function Sidebar({ user, onLogout, onNavigate }) {
    const sections = SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((i) => !user || i.roles.includes(user.role)),
    })).filter((s) => s.items.length);

    return (
        <aside className="flex h-dvh w-[248px] shrink-0 flex-col border-r border-slate-300 bg-[#f7f5f0]">
            <div className="border-b border-slate-300 px-5 py-5">
                <div className="text-[15px] font-semibold text-slate-950">Electioneering</div>
                <div className="mt-1 text-xs text-slate-500">Field operations desk</div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
                {sections.map((sec) => (
                    <div key={sec.title} className="mb-7">
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {sec.title}
                        </div>
                        <div>
                            {sec.items.map((it) => (
                                <NavLink
                                    key={it.to}
                                    to={it.to}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `relative block border-l px-3 py-2 text-sm transition ${isActive ? 'border-slate-950 bg-white text-slate-950' : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-white/60 hover:text-slate-950'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <span className={isActive ? 'font-semibold' : ''}>{it.label}</span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {user && (
                <div className="border-t border-slate-300 p-3">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900 text-xs font-semibold text-white">
                            {initials(user.username)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">{user.username}</div>
                            <div className="text-xs text-slate-400">{ROLE_LABEL[user.role] ?? user.role}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onLogout}
                            title="Sign out"
                            className="rounded-sm p-1.5 text-slate-500 transition hover:bg-white hover:text-rose-700"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default function ShellLayout() {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Load admin-chosen party colours once per session so partyColor() themes
    // every chart/badge/treemap from master data. /api/master is auth-only, so
    // this is safe for both roles; BJP/INC keep their built-in fallback colours.
    const partyColorsQ = useQuery({
        queryKey: ['master-options', 'party'],
        queryFn: () => api.masterOptions('party'),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });
    useEffect(() => {
        if (partyColorsQ.data?.options) registerPartyColors(partyColorsQ.data.options);
    }, [partyColorsQ.data]);

    if (loading) return <FullLoader label="Loading…" />;
    if (!user) return <Navigate to="/login" replace />;

    function handleLogout() {
        logout();
        navigate('/login', { replace: true });
    }

    return (
        <div className="flex h-dvh overflow-hidden bg-[#f7f5f0]">
            {/* Desktop sidebar */}
            <div className="hidden shrink-0 md:block">
                <Sidebar user={user} onLogout={handleLogout} />
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full">
                        <Sidebar user={user} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
                    </div>
                </div>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {/* Mobile top bar */}
                <div className="flex items-center gap-3 border-b border-slate-300 bg-[#f7f5f0] px-4 py-3 md:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-slate-600"
                    >
                        ☰
                    </button>
                    <span className="font-semibold text-slate-800">Electioneering</span>
                </div>

                <main className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
