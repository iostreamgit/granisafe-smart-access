import { useEffect, useState } from 'react';
import styles from './LiveClock.module.css';

type LiveClockProps = {
  variant?: 'light' | 'dark';
  className?: string;
};

function formatNow(now: Date) {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  return { time, date };
}

export function LiveClock({ variant = 'light', className }: LiveClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { time, date } = formatNow(now);

  return (
    <time
      className={[styles.clock, styles[variant], className].filter(Boolean).join(' ')}
      dateTime={now.toISOString()}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.time}>{time}</span>
      <span className={styles.date}>{date}</span>
    </time>
  );
}
