import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error('.env not found at repo root');
  process.exit(1);
}

let text = readFileSync(envPath, 'utf8');
const original = text;

text = text.replace(/^POSTGRES_PORT=.*$/m, 'POSTGRES_PORT=5433');
text = text.replace(
  /^DATABASE_URL=postgresql:\/\/([^@]+)@localhost:\d+\/(.+)$/m,
  'DATABASE_URL=postgresql://$1@localhost:5433/$2',
);

if (!/^POSTGRES_PORT=/m.test(text)) {
  text += '\nPOSTGRES_PORT=5433\n';
}
if (!/^DATABASE_URL=/m.test(text)) {
  text +=
    '\nDATABASE_URL=postgresql://granisafe:granisafe@localhost:5433/granisafe_smart_access\n';
}

if (text !== original) {
  writeFileSync(envPath, text, 'utf8');
  console.log('Updated root .env Postgres port to 5433');
} else {
  console.log('Root .env already points Postgres at 5433');
}
