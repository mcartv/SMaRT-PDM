// SMaRT-PDM: Admin Login — Admin Login (admin frontend page); loads data, handles page actions, and renders the admin view.
import { Navigate } from 'react-router-dom';

// Compatibility route for old Admin login links. Authentication lives at /login.
export default function AdminLogin() {
  return <Navigate to="/login" replace />;
}
