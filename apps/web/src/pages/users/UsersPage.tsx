import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from './UsersPage.module.css';

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  isActive: boolean;
};

export function UsersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    void apiGet<UserRow[]>('/api/v1/users', accessToken)
      .then(setUsers)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load users');
      });
  }, [accessToken]);

  return (
    <div className={styles.page}>
      <h2>Users & Roles</h2>
      <p>Admin-only directory of portal accounts.</p>
      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.fullName}</td>
              <td>{user.email}</td>
              <td>{user.roles.join(', ')}</td>
              <td>{user.isActive ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
