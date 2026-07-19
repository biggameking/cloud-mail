#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { recoverAbandonedTemplateAutoUpdateLock } from './devrules-lib/template-auto-update-lock.mjs';

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-auto-update-lock-selftest-'));
  const lock = path.join(root, 'update.lock');
  try {
    assert.equal((await recoverAbandonedTemplateAutoUpdateLock(lock)).recovered, false);
    await fs.writeFile(lock, 'not-json\n');
    assert.equal((await recoverAbandonedTemplateAutoUpdateLock(lock)).recovered, false);
    assert.equal(await fs.readFile(lock, 'utf8'), 'not-json\n');

    const live = { schemaVersion: 2, token: crypto.randomUUID(), pid: process.pid, createdAt: new Date().toISOString() };
    await fs.writeFile(lock, `${JSON.stringify(live)}\n`);
    assert.equal((await recoverAbandonedTemplateAutoUpdateLock(lock)).recovered, false);
    await fs.access(lock);

    const abandoned = { ...live, token: crypto.randomUUID(), pid: 999999 };
    await fs.writeFile(lock, `${JSON.stringify(abandoned)}\n`);
    assert.equal((await recoverAbandonedTemplateAutoUpdateLock(lock)).recovered, true);
    await assert.rejects(fs.access(lock));
    process.stdout.write('template-auto-update lock selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`template-auto-update lock selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
