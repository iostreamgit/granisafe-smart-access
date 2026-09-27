import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './auth-store';

type Props = {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
};

export function RequirePermission({ permission, anyOf, children }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const allowed = permission ? hasPermission(permission) : anyOf ? hasAnyPermission(anyOf) : true;

  if (!allowed) {
    return <Navigate to="/app/profile" replace />;
  }

  return children;
}
