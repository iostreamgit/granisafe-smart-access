import { useEffect, useState } from 'react';
import { ApiError, apiGet, apiSend } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from '../phase8/Phase8Pages.module.css';

type SettingsView = {
  gateOpenMs: number;
  accessCooldownSeconds: number;
  defaultLateGraceMinutes: number;
  evidenceRetentionDays: number;
  failClosed: boolean;
  ppeThresholds: {
    helmet: number;
    safetyVest: number;
    uniform: number;
  };
};

export function SettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [form, setForm] = useState<SettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!accessToken) return;
      try {
        setError(null);
        setForm(await apiGet<SettingsView>('/api/v1/settings', accessToken));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load settings');
      }
    })();
  }, [accessToken]);

  async function onSave() {
    if (!accessToken || !form) return;
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      const updated = await apiSend<SettingsView>('PUT', '/api/v1/settings', accessToken, {
        gateOpenMs: form.gateOpenMs,
        accessCooldownSeconds: form.accessCooldownSeconds,
        defaultLateGraceMinutes: form.defaultLateGraceMinutes,
        evidenceRetentionDays: form.evidenceRetentionDays,
        failClosed: form.failClosed,
        ppeThresholds: form.ppeThresholds,
      });
      if (updated) setForm(updated);
      setSaved('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  }

  if (!form) {
    return (
      <div className={styles.page}>
        <h2>Settings</h2>
        {error ? <p className={styles.error}>{error}</p> : <p className={styles.meta}>Loading…</p>}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Settings</h2>
          <p className={styles.lede}>
            Gate timing, access cooldown, grace minutes, retention, and PPE thresholds.
          </p>
        </div>
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void onSave()}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {saved ? <p className={styles.ok}>{saved}</p> : null}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="gateOpenMs">Gate open (ms)</label>
          <input
            id="gateOpenMs"
            type="number"
            value={form.gateOpenMs}
            onChange={(e) => setForm({ ...form, gateOpenMs: Number(e.target.value) })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="cooldown">Access cooldown (seconds)</label>
          <input
            id="cooldown"
            type="number"
            value={form.accessCooldownSeconds}
            onChange={(e) => setForm({ ...form, accessCooldownSeconds: Number(e.target.value) })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="grace">Default late grace (minutes)</label>
          <input
            id="grace"
            type="number"
            value={form.defaultLateGraceMinutes}
            onChange={(e) => setForm({ ...form, defaultLateGraceMinutes: Number(e.target.value) })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="retention">Evidence retention (days)</label>
          <input
            id="retention"
            type="number"
            value={form.evidenceRetentionDays}
            onChange={(e) => setForm({ ...form, evidenceRetentionDays: Number(e.target.value) })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="helmet">Helmet min confidence</label>
          <input
            id="helmet"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={form.ppeThresholds.helmet}
            onChange={(e) =>
              setForm({
                ...form,
                ppeThresholds: { ...form.ppeThresholds, helmet: Number(e.target.value) },
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="vest">Safety vest min confidence</label>
          <input
            id="vest"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={form.ppeThresholds.safetyVest}
            onChange={(e) =>
              setForm({
                ...form,
                ppeThresholds: {
                  ...form.ppeThresholds,
                  safetyVest: Number(e.target.value),
                },
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="uniform">Uniform min confidence</label>
          <input
            id="uniform"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={form.ppeThresholds.uniform}
            onChange={(e) =>
              setForm({
                ...form,
                ppeThresholds: { ...form.ppeThresholds, uniform: Number(e.target.value) },
              })
            }
          />
        </div>
      </div>

      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={form.failClosed}
          onChange={(e) => setForm({ ...form, failClosed: e.target.checked })}
        />
        Fail closed when AI is unavailable
      </label>
    </div>
  );
}
