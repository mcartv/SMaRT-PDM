// SMaRT-PDM: Department Portal Login — Department Portal Login (admin frontend page); loads data, handles page actions, and renders the admin view.
import { Navigate } from 'react-router-dom';

// Deprecated compatibility component. All user access now goes through /login.
export default function DepartmentPortalLogin() {
  return <Navigate to="/login" replace />;
}
