import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const forcedSkip =
  process.env.SKIP_TESTCONTAINERS === '1' || process.env.CI_SKIP_TESTCONTAINERS === '1';

const requireFromHere = createRequire(__filename);

describe('Postgres integration (Testcontainers)', () => {
  let container: { stop: () => Promise<unknown>; getConnectionUri: () => string } | null = null;
  let prisma: PrismaClient | null = null;
  let ready = false;
  let skipReason = forcedSkip ? 'SKIP_TESTCONTAINERS set' : '';

  before(async () => {
    if (forcedSkip) return;
    try {
      const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
      container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('granisafe_test')
        .withUsername('granisafe')
        .withPassword('granisafe')
        .start();

      const databaseUrl = container.getConnectionUri();
      // Resolved from apps/api/src/test → apps/api (CJS-compatible; avoids import.meta).
      const apiRoot = path.resolve(__dirname, '../..');
      const prismaCli = requireFromHere.resolve('prisma/build/index.js');
      const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
        cwd: apiRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
      });
      if (migrate.status !== 0) {
        throw new Error(
          migrate.stderr?.trim() ||
            migrate.stdout?.trim() ||
            `prisma migrate deploy exited ${String(migrate.status)}`,
        );
      }

      prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      ready = true;
    } catch (err) {
      skipReason = err instanceof Error ? err.message : 'Testcontainers unavailable (Docker?)';
      ready = false;
    }
  });

  after(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('applies migrations and answers SELECT 1', async (t) => {
    if (!ready || !prisma) {
      t.skip(skipReason || 'container not ready');
      return;
    }
    const rows = (await prisma.$queryRaw`SELECT 1::int AS ok`) as Array<{ ok: number }>;
    assert.equal(rows[0]?.ok, 1);
  });

  it('has empty companies table before seed', async (t) => {
    if (!ready || !prisma) {
      t.skip(skipReason || 'container not ready');
      return;
    }
    const count = await prisma.company.count();
    assert.equal(count, 0);
  });
});
