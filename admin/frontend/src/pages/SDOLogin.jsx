import { Navigate } from 'react-router-dom';

// Deprecated compatibility component. All user access now goes through /login.
export default function SDOLogin() {
  return <Navigate to="/login" replace />;
}
