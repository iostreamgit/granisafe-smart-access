import { spawnSync } from 'node:child_process';

const probe =
  process.platform === 'win32'
    ? spawnSync('where', ['k6'], { encoding: 'utf8', shell: true })
    : spawnSync('command', ['-v', 'k6'], { encoding: 'utf8', shell: true });

if (probe.status !== 0) {
  console.error(
    'k6 not found — install from https://k6.io then re-run pnpm test:perf',
  );
  process.exit(0);
}

const result = spawnSync('k6', ['run', 'perf/k6-smoke.js'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
