import { Route, Routes } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import HomePage from './routes/HomePage.jsx';
import VoterDetailPage from './routes/VoterDetailPage.jsx';
import Form20Page from './routes/Form20Page.jsx';
import AnalyticsPage from './routes/AnalyticsPage.jsx';
import SegmentPage from './routes/SegmentPage.jsx';
import LoginPage from './routes/LoginPage.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route
          path="/voter-detail"
          element={
            <ProtectedRoute roles={['admin', 'data_operator']}>
              <VoterDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/form-20"
          element={
            <ProtectedRoute roles={['admin', 'data_operator']}>
              <Form20Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute roles={['admin']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/segment"
          element={
            <ProtectedRoute roles={['admin']}>
              <SegmentPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
