// SMaRT-PDM: Guidance Login — Guidance Login (admin frontend page); loads data, handles page actions, and renders the admin view.
import { Navigate } from 'react-router-dom';

// Deprecated compatibility component. All user access now goes through /login.
export default function GuidanceLogin() {
  return <Navigate to="/login" replace />;
}
