import { Navigate } from 'react-router-dom';

// Compatibility route for old Admin login links. Authentication lives at /login.
export default function AdminLogin() {
  return <Navigate to="/login" replace />;
}
