import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@granisafe/shared';
import { LiveClock } from '../../components/LiveClock';
import { ApiError } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from './LoginPage.module.css';

const FEATURES = [
  'Live PPE gate checks',
  'Attendance & audit trail',
  'Role-based access control',
] as const;

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  const [email, setEmail] = useState('admin@granisafe.local');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
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
        <div className={styles.brandAtmosphere} aria-hidden>
          <span className={styles.orbA} />
          <span className={styles.orbB} />
          <span className={styles.orbC} />
          <div className={styles.brandGrid} />
          <div className={styles.brandSheen} />
        </div>

        <div className={styles.brandContent}>
          <div className={styles.logoWrap}>
            <img
              className={styles.logo}
              src="/brand/granisafe-mark.png"
              alt="Grani Safe Solution"
              width={1024}
              height={1024}
              decoding="async"
              fetchPriority="high"
            />
          </div>

          <p className={styles.brandEyebrow}>Grani Safe Solution</p>
          <h1 className={styles.brandTitle}>{APP_NAME}</h1>
          <p className={styles.brandLead}>
            Secure gate entry with live PPE checks, attendance, and role-based control.
          </p>

          <ul className={styles.featureList}>
            {FEATURES.map((item, index) => (
              <li key={item} style={{ ['--i' as string]: index }}>
                <span className={styles.featureDot} aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <LiveClock variant="dark" className={styles.brandClock} />
        </div>
      </section>

      <section className={styles.formPane}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.formHeader}>
            <p className={styles.formKicker}>Workspace access</p>
            <h2 className={styles.formTitle}>Sign in</h2>
            <p className={styles.formLead}>Enter your Granisafe credentials to continue.</p>
          </div>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <div className={styles.passwordRow}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={submitting}>
            <span className={styles.submitSheen} aria-hidden />
            <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
          </button>

          <p className={styles.hint}>
            Demo accounts: admin, guard, supervisor, hr, employee @granisafe.local —{' '}
            <code>Password123!</code>
          </p>
        </form>
      </section>
    </main>
  );
}
