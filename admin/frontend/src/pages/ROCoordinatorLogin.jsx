// SMaRT-PDM: Return of Obligations — ROCoordinator Login (admin frontend page); loads data, handles page actions, and renders the admin view.
import { Navigate } from 'react-router-dom';

// Deprecated compatibility component. All user access now goes through /login.
export default function ROCoordinatorLogin() {
  return <Navigate to="/login" replace />;
}
