import { Navigate, Route, Routes } from 'react-router-dom';
import ShellLayout from './components/layout/AppShell.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './routes/LoginPage.jsx';
import VoterDetailPage from './routes/VoterDetailPage.jsx';
import Form20Page from './routes/Form20Page.jsx';
import SegmentPage from './routes/SegmentPage.jsx';
import GeographyExplorer from './routes/GeographyExplorer.jsx';
import ElectionOverviewPage from './routes/ElectionOverviewPage.jsx';
import BoothDetailPage from './routes/BoothDetailPage.jsx';
import CandidateReportPage from './routes/CandidateReportPage.jsx';
import StrategyPage from './routes/StrategyPage.jsx';
import PartyAnalyticsPage from './routes/PartyAnalyticsPage.jsx';
import AssemblyTimelinePage from './routes/AssemblyTimelinePage.jsx';
import HouseholdsPage from './routes/HouseholdsPage.jsx';
import AllMasterPage from './routes/AllMasterPage.jsx';

// Landing — send admins to the results explorer, operators to data entry.
function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/elections/assembly' : '/voters'} replace />;
}

const DATA_ROLES = ['admin', 'data_operator'];
const ADMIN = ['admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ShellLayout />}>
        <Route path="/" element={<RoleRedirect />} />

        {/* Data entry */}
        <Route path="/voters" element={<ProtectedRoute roles={DATA_ROLES}><VoterDetailPage /></ProtectedRoute>} />
        <Route path="/form-20" element={<ProtectedRoute roles={DATA_ROLES}><Form20Page /></ProtectedRoute>} />

        {/* Results & insights — three entry points, then per-constituency drill-down */}
        <Route path="/elections/assembly" element={<ProtectedRoute roles={ADMIN}><GeographyExplorer title="Assembly Election" subtitle="Drill from state to seat to constituency. Open one to see its results across every year — switch years from the dropdown inside." matchType="Assembly Election" /></ProtectedRoute>} />
        <Route path="/elections/lok-sabha" element={<ProtectedRoute roles={ADMIN}><GeographyExplorer title="Lok Sabha Election" subtitle="Drill from state to parliamentary seat. Open one to see its results across every year — switch years from the dropdown inside." matchType="Lok Sabha Election" /></ProtectedRoute>} />
        <Route path="/elections/booths" element={<ProtectedRoute roles={ADMIN}><GeographyExplorer title="Booth wise election" subtitle="Drill to a constituency to jump straight into its booth-by-booth results. Choose any year from the dropdown once inside." boothMode /></ProtectedRoute>} />
        <Route path="/elections/:id" element={<ProtectedRoute roles={ADMIN}><ElectionOverviewPage /></ProtectedRoute>} />
        <Route path="/elections/:id/booth/:psId" element={<ProtectedRoute roles={ADMIN}><BoothDetailPage /></ProtectedRoute>} />
        <Route path="/elections/:id/candidate/:name" element={<ProtectedRoute roles={ADMIN}><CandidateReportPage /></ProtectedRoute>} />
        <Route path="/elections/:id/strategy" element={<ProtectedRoute roles={ADMIN}><StrategyPage /></ProtectedRoute>} />
        <Route path="/elections/:id/parties" element={<ProtectedRoute roles={ADMIN}><PartyAnalyticsPage /></ProtectedRoute>} />
        <Route path="/elections/:id/timeline" element={<ProtectedRoute roles={ADMIN}><AssemblyTimelinePage /></ProtectedRoute>} />
        <Route path="/households" element={<ProtectedRoute roles={ADMIN}><HouseholdsPage /></ProtectedRoute>} />
        <Route path="/segment" element={<ProtectedRoute roles={ADMIN}><SegmentPage /></ProtectedRoute>} />
        <Route path="/all-master" element={<ProtectedRoute roles={ADMIN}><AllMasterPage /></ProtectedRoute>} />

        {/* Back-compat redirects for old paths */}
        <Route path="/voter-detail" element={<Navigate to="/voters" replace />} />
        <Route path="/elections" element={<Navigate to="/elections/assembly" replace />} />
        <Route path="/analytics" element={<Navigate to="/elections/assembly" replace />} />
        <Route path="/targeting" element={<Navigate to="/elections/assembly" replace />} />

        <Route path="*" element={<RoleRedirect />} />
      </Route>
    </Routes>
  );
}
