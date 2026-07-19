import fs from 'node:fs/promises';

function processState(pid) {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'absent' : 'unknown';
  }
}

function validOwner(value) {
  return value?.schemaVersion === 2
    && Number.isInteger(value.pid)
    && value.pid > 0
    && typeof value.token === 'string'
    && /^[0-9a-f-]{16,}$/i.test(value.token)
    && typeof value.createdAt === 'string'
    && Number.isFinite(Date.parse(value.createdAt));
}

export async function recoverAbandonedFileLock(lockPath) {
  let before;
  let owner;
  try {
    before = await fs.lstat(lockPath);
    if (!before.isFile() || before.isSymbolicLink()) return { recovered: false, reason: 'lock is not a regular file' };
    owner = JSON.parse(await fs.readFile(lockPath, 'utf8'));
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { recovered: false, reason: 'lock is absent' }
      : { recovered: false, reason: 'lock ownership is unreadable or invalid' };
  }
  if (!validOwner(owner)) return { recovered: false, reason: 'lock ownership is invalid' };
  const state = processState(owner.pid);
  if (state !== 'absent') return { recovered: false, reason: `lock owner process is ${state}` };

  const [current, currentOwner] = await Promise.all([
    fs.lstat(lockPath).catch(() => null),
    fs.readFile(lockPath, 'utf8').then((content) => JSON.parse(content)).catch(() => null),
  ]);
  const sameInode = current && current.isFile() && !current.isSymbolicLink()
    && current.dev === before.dev && current.ino === before.ino;
  if (!sameInode || currentOwner?.token !== owner.token) {
    return { recovered: false, reason: 'lock ownership changed during abandoned-owner verification' };
  }
  await fs.rm(lockPath);
  return { recovered: true, pid: owner.pid, token: owner.token };
}

export const recoverAbandonedTemplateAutoUpdateLock = recoverAbandonedFileLock;
