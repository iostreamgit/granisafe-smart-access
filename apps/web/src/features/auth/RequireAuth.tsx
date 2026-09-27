import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth-store';

export function RequireAuth() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!bootstrapped) {
    return <div style={{ padding: '2rem', color: '#a7b7ae' }}>Loading session…</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
