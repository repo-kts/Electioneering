import { Route, Routes } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import HomePage from './routes/HomePage.jsx';
import VoterDetailPage from './routes/VoterDetailPage.jsx';
import Form20Page from './routes/Form20Page.jsx';
import AnalyticsPage from './routes/AnalyticsPage.jsx';
import SegmentPage from './routes/SegmentPage.jsx';

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voter-detail" element={<VoterDetailPage />} />
        <Route path="/form-20" element={<Form20Page />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/segment" element={<SegmentPage />} />
      </Routes>
    </>
  );
}
