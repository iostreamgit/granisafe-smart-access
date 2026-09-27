import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');
const repoRoot = resolve(apiRoot, '../..');

function loadEnvFile(path, { override = false } = {}) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Repo-root .env is the source of truth for local Docker Compose.
// apps/api/.env can override specific keys when present.
loadEnvFile(resolve(repoRoot, '.env'), { override: true });
loadEnvFile(resolve(apiRoot, '.env'), { override: true });

const dash = process.argv.indexOf('--');
const command = dash >= 0 ? process.argv.slice(dash + 1) : process.argv.slice(2);

if (command.length === 0) {
  console.error('Usage: node scripts/with-env.mjs -- <command> [...args]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is missing. Copy .env.example to the repo root .env (or apps/api/.env).',
  );
  process.exit(1);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: true,
  cwd: apiRoot,
});

process.exit(result.status ?? 1);
