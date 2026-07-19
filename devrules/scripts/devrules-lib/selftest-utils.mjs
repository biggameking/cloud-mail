import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export function createRunExpectFailureJson(run) {
  return async function runExpectFailureJson(command, args, options = {}) {
    let failure;
    try {
      await run(command, args, options);
    } catch (error) {
      failure = error;
    }
    assert(failure, `expected command to fail: ${command} ${args.join(' ')}`);
    assert.equal(failure.code, 1, 'blocked sync commands must return exit code 1');
    return JSON.parse(failure.stdout);
  };
}

export async function exists(filePath) {
  return fs.stat(filePath).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
