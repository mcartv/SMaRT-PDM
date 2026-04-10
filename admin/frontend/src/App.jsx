import { BrowserRouter, Routes, Route, Navigate } from 'react-router';

// --- LAYOUTS ---
import AdminLayout from './components/layout/AdminLayout';
import SDOLayout from './components/layout/SDOLayout';

// --- ADMIN PAGES ---
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import ApplicationReview from './pages/ApplicationReview';
import OpeningApplications from './pages/OpeningApplications';
import DocumentVerification from './pages/DocumentVerification';
import ReportGeneration from './pages/ReportGeneration';
import ScholarMonitoring from './pages/ScholarMonitoring';
import RenewalReview from './pages/RenewalReview';
import RenewalDocumentVerification from './pages/RenewalDocumentVerification';
import ScholarshipOpenings from './pages/ScholarshipOpenings';
import ROAdmin from './pages/ROAdmin';
import PayoutManagement from './pages/PayoutManagement';
import AnnouncementsManagement from './pages/AnnouncementsManagement';
import AdminProfile from './pages/AdminProfile';
import Maintenance from './pages/Maintenance';
import AdminMessages from './pages/AdminMessages';
import SupportTickets from './pages/SupportTickets';

// --- SDO PAGES ---
import SDOLogin from './pages/SDOLogin';
import SDODashboard from './pages/SDODashboard';
import SDOScholarList from './pages/SDOScholarList';
import SDOProfile from './pages/SDOProfile';
import SDOMaintenance from './pages/SDOMaintenance';

/**
 * PROTECTED ROUTE WRAPPER
 * Prevents access to protected pages without the proper token.
 */
const ProtectedRoute = ({ children, storageKey, redirectTo }) => {
  const token = localStorage.getItem(storageKey);

  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* Public Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
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
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<AdminDashboard />} />

          {/* Applications */}
          <Route path="applications" element={<ApplicationReview />} />
          <Route
            path="openings/:openingId/applications"
            element={<OpeningApplications />}
          />
          <Route
            path="applications/:id/documents"
            element={<DocumentVerification />}
          />

          {/* Other Admin Pages */}
          <Route path="scholars" element={<ScholarMonitoring />} />
          <Route path="renewals" element={<RenewalReview />} />
          <Route
            path="renewals/:id"
            element={<RenewalDocumentVerification />}
          />
          <Route path="openings" element={<ScholarshipOpenings />} />
          <Route path="obligations" element={<ROAdmin />} />
          <Route path="payout" element={<PayoutManagement />} />
          <Route path="reports" element={<ReportGeneration />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="announcements" element={<AnnouncementsManagement />} />
          <Route path="support-tickets" element={<SupportTickets />} />
          <Route path="adminprofile" element={<AdminProfile />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Route>

        {/* --- PROTECTED SDO PANEL --- */}
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
          <Route path="profile" element={<SDOProfile />} />
          <Route path="maintenance" element={<SDOMaintenance />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}