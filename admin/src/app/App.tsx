import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import AdminLogin from './components/admin/AdminLogin';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import ApplicationReview from './components/admin/ApplicationReview';
import DocumentVerification from './components/admin/DocumentVerification';
import ReportGeneration from './components/admin/ReportGeneration';
import ScholarMonitoring from './components/admin/ScholarMonitoring';
import ROAdmin from './components/admin/ROAdmin';
import PayoutManagement from './components/admin/PayoutManagement';
import AnnouncementsManagement from './components/admin/AnnouncementsManagement';
import AdminProfile from './components/admin/AdminProfile';
import Maintenance from './components/admin/Maintenance';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="applications" element={<ApplicationReview />} />
          <Route path="applications/:id" element={<DocumentVerification />} />
          <Route path="scholars" element={<ScholarMonitoring />} />
          <Route path="obligations" element={<ROAdmin />} />
          <Route path="payout" element={<PayoutManagement />} />
          <Route path="reports" element={<ReportGeneration />} />
          <Route path="announcements" element={<AnnouncementsManagement />} />
          <Route path="adminprofile" element={<AdminProfile />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
