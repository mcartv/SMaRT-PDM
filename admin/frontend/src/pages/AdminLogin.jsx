import { Navigate } from 'react-router-dom';

// Deprecated compatibility component. All user access now goes through /login.
export default function AdminLogin() {
  return <Navigate to="/login" replace />;
}
