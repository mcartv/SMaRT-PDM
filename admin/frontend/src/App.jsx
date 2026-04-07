import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
// --- LAYOUTS ---
import AdminLayout from './components/layout/AdminLayout';
// --- PAGES ---
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import ApplicationReview from './pages/ApplicationReview';
import DocumentVerification from './pages/DocumentVerification';
import ReportGeneration from './pages/ReportGeneration';
import ScholarMonitoring from './pages/ScholarMonitoring';
import ScholarshipOpenings from './pages/ScholarshipOpenings';
import ROAdmin from './pages/ROAdmin';
import PayoutManagement from './pages/PayoutManagement';
import AnnouncementsManagement from './pages/AnnouncementsManagement';
import AdminProfile from './pages/AdminProfile';
import Maintenance from './pages/Maintenance';
import SDOLogin from './pages/SDOLogin';
import SDODashboard from './pages/SDODashboard';
import SDOScholarList from './pages/SDOScholarList';
import SDOLayout from './components/layout/SDOLayout';

/**
 * PROTECTED ROUTE WRAPPER
 * This prevents users from accessing the dashboard if they aren't logged in.
 */
const ProtectedRoute = ({ children, storageKey, redirectTo }) => {
  const token = localStorage.getItem(storageKey);
  if (!token) return <Navigate to={redirectTo} replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect Root to Login */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* Public Auth Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} /> {/* <--- Added this */}
        <Route path="/sdo/login" element={<SDOLogin />} />

        {/* --- PROTECTED ADMIN PANEL --- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute storageKey="adminToken" redirectTo="/admin/login">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Send /admin directly to dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Admin Sub-pages */}
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="applications" element={<ApplicationReview />} />
          <Route path="applications/:id/documents" element={<DocumentVerification />} />
          <Route path="scholars" element={<ScholarMonitoring />} />
          <Route path="openings" element={<ScholarshipOpenings />} />
          <Route path="obligations" element={<ROAdmin />} />
          <Route path="payout" element={<PayoutManagement />} />
          <Route path="reports" element={<ReportGeneration />} />
          <Route path="announcements" element={<AnnouncementsManagement />} />
          <Route path="adminprofile" element={<AdminProfile />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Route>

        <Route
          path="/sdo"
          element={
            <ProtectedRoute storageKey="sdoToken" redirectTo="/sdo/login">
              <SDOLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SDODashboard />} />
          <Route path="scholars" element={<SDOScholarList />} />
        </Route>

        {/* Fallback 404 */}
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
