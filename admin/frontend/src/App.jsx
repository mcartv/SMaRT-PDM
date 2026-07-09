import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- LAYOUTS ---
import AdminLayout from './components/layout/AdminLayout';
import SDOLayout from './components/layout/SDOLayout';
import PDLayout from './components/layout/PDLayout';
import GuidanceLayout from './components/layout/GuidanceLayout';

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
import Maintenance from './pages/maintenance/Maintenance';
import AdminMessages from './pages/AdminMessages';
import ProfilePhotoQueue from './pages/ProfilePhotoQueue';
import EndorsementSlipDetail from './pages/EndorsementSlipDetail';
import EndorsementVerification from './pages/EndorsementVerification';
import PDLogin from './pages/PDLogin';
import GuidanceLogin from './pages/GuidanceLogin';
import PDDashboard from './pages/PDDashboard';
import GuidanceDashboard from './pages/GuidanceDashboard';
import PDMaintenance from './pages/PDMaintenance';
import GuidanceMaintenance from './pages/GuidanceMaintenance';
import AllEndorsementsTracker from './pages/AllEndorsementsTracker';
import EndorsementQueue from './pages/EndorsementQueue';

// --- LANDING ---
import SmartPDMLanding from './pages/SmartPDMLanding';

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
  const token = sessionStorage.getItem(storageKey);

  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

const RoleHome = () => {
  return <Navigate to="/admin/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />

        {/* Public Landing Page */}
        <Route path="/landing" element={<SmartPDMLanding />} />
        <Route path="/endorsement/verify/:token" element={<EndorsementVerification />} />

        {/* Public Routes */}


        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
        <Route path="/pd/login" element={<PDLogin />} />
        <Route path="/guidance/login" element={<GuidanceLogin />} />
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
          <Route index element={<RoleHome />} />

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
          <Route
            path="endorsements/:slipId"
            element={<EndorsementSlipDetail tokenStorageKey="adminToken" />}
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
          <Route path="profile-photos" element={<ProfilePhotoQueue />} />
          <Route path="profile-photos/:reviewId" element={<ProfilePhotoQueue />} />
          <Route path="adminprofile" element={<AdminProfile />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Route>

        {/* --- PROTECTED PD PANEL --- */}
        <Route
          path="/pd"
          element={
            <ProtectedRoute storageKey="pdToken" redirectTo="/pd/login">
              <PDLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PDDashboard />} />
          <Route
            path="queue"
            element={
              <EndorsementQueue
                queueKey="pd"
                tokenStorageKey="pdToken"
                profileStorageKey="pdProfile"
                detailBasePath="/pd/endorsements"
              />
            }
          />
          <Route
            path="tracker"
            element={
              <AllEndorsementsTracker
                tokenStorageKey="pdToken"
                detailBasePath="/pd/endorsements"
                title="Program Director Applicant Tracker"
                subtitle="View all applicants and confirm where each endorsement slip currently sits."
              />
            }
          />
          <Route
            path="endorsements/:slipId"
            element={<EndorsementSlipDetail tokenStorageKey="pdToken" />}
          />
          <Route
            path="reports"
            element={
              <ReportGeneration
                tokenStorageKey="pdToken"
                allowedReportTypes={['pd']}
                defaultReportType="pd"
              />
            }
          />
          <Route path="maintenance" element={<PDMaintenance />} />
        </Route>

        {/* --- PROTECTED GUIDANCE PANEL --- */}
        <Route
          path="/guidance"
          element={
            <ProtectedRoute storageKey="guidanceToken" redirectTo="/guidance/login">
              <GuidanceLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<GuidanceDashboard />} />
          <Route
            path="queue"
            element={
              <EndorsementQueue
                queueKey="guidance"
                tokenStorageKey="guidanceToken"
                profileStorageKey="guidanceProfile"
                detailBasePath="/guidance/endorsements"
              />
            }
          />
          <Route
            path="tracker"
            element={
              <AllEndorsementsTracker
                tokenStorageKey="guidanceToken"
                detailBasePath="/guidance/endorsements"
                title="Guidance Applicant Tracker"
                subtitle="View all applicants and identify which office currently handles each endorsement."
              />
            }
          />
          <Route
            path="endorsements/:slipId"
            element={<EndorsementSlipDetail tokenStorageKey="guidanceToken" />}
          />
          <Route
            path="reports"
            element={
              <ReportGeneration
                tokenStorageKey="guidanceToken"
                allowedReportTypes={['guidance']}
                defaultReportType="guidance"
              />
            }
          />
          <Route path="maintenance" element={<GuidanceMaintenance />} />
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
          <Route
            path="queue"
            element={
              <EndorsementQueue
                queueKey="sdo"
                tokenStorageKey="sdoToken"
                profileStorageKey="sdoProfile"
                detailBasePath="/sdo/endorsements"
              />
            }
          />
          <Route
            path="tracker"
            element={
              <AllEndorsementsTracker
                tokenStorageKey="sdoToken"
                detailBasePath="/sdo/endorsements"
                title="SDO Applicant Tracker"
                subtitle="View every applicant and see how far each endorsement has progressed."
              />
            }
          />
          <Route
            path="endorsements/:slipId"
            element={<EndorsementSlipDetail tokenStorageKey="sdoToken" />}
          />
          <Route
            path="reports"
            element={
              <ReportGeneration
                tokenStorageKey="sdoToken"
                allowedReportTypes={['sdo']}
                defaultReportType="sdo"
              />
            }
          />
          <Route path="scholars" element={<SDOScholarList />} />
          <Route path="profile" element={<SDOProfile />} />
          <Route path="maintenance" element={<SDOMaintenance />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
