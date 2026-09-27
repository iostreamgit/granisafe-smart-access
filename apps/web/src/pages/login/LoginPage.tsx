import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@granisafe/shared';
import { LiveClock } from '../../components/LiveClock';
import { ApiError } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  const [email, setEmail] = useState('admin@granisafe.local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (accessToken) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPane} aria-label="Brand">
        <div className={styles.brandGlow} aria-hidden />
        <div className={styles.brandGrid} aria-hidden />
        <div className={styles.brandContent}>
          <img
            className={styles.logo}
            src="/brand/gss-logo.png"
            alt="Grani Safe Solution"
            width={320}
            height={160}
          />
          <h1 className={styles.brandTitle}>{APP_NAME}</h1>
          <p className={styles.brandLead}>
            Secure gate entry with live PPE checks, attendance, and role-based control.
          </p>
          <LiveClock variant="dark" className={styles.brandClock} />
        </div>
      </section>

      <section className={styles.formPane}>
        <form className={styles.form} onSubmit={onSubmit}>
          <h2 className={styles.formTitle}>Sign in</h2>
          <p className={styles.formLead}>Use your Granisafe workspace credentials.</p>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className={styles.hint}>
            Demo: admin / guard / supervisor / hr / employee @granisafe.local —{' '}
            <code>Password123!</code>
          </p>
        </form>
      </section>
    </main>
  );
}
