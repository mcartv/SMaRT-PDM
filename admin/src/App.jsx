import { BrowserRouter, Routes, Route, Navigate } from 'react-router';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
// Pages
import AdminLogin from './pages/AdminLogin';
// import ForgotPassword from './pages/ForgotPassword'; // Uncomment when file is ready
import AdminDashboard from './pages/AdminDashboard';
import ApplicationReview from './pages/ApplicationReview';
import DocumentVerification from './pages/DocumentVerification';
import ReportGeneration from './pages/ReportGeneration';
import ScholarMonitoring from './pages/ScholarMonitoring';
import ROAdmin from './pages/ROAdmin';
import PayoutManagement from './pages/PayoutManagement';
import AnnouncementsManagement from './pages/AnnouncementsManagement';
import AdminProfile from './pages/AdminProfile';
import Maintenance from './pages/Maintenance';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root Redirect to Login */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* Auth Route */}
        <Route path="/admin/login" element={<AdminLogin />} />
        {/* <Route path="/admin/forgotpassword" element={<ForgotPassword />} /> */}

        {/* Protected Admin Shell */}
        <Route path="/admin" element={<AdminLayout />}>
          {/* Automatically send /admin to /admin/dashboard */}
          <Route index element={<Navigate to="/admin/dashboard" replace />} />

          {/* Admin Sub-pages */}
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

        {/* Fallback for 404 - Redirects back to login or dashboard */}
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}