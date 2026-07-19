import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function atomicWriteFile(filePath, content, options = {}) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });

  const existingMode = await fs.stat(filePath).then((stat) => stat.mode & 0o777).catch(() => null);
  const mode = options.mode ?? existingMode ?? 0o644;
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, content, { mode });
    await fs.chmod(temporaryPath, mode).catch(() => {});
    try {
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
      await fs.rm(filePath, { force: true });
      await fs.rename(temporaryPath, filePath);
    }
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

export async function withFileLock(lockPath, callback) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const token = crypto.randomUUID();
  let handle;
  try {
    handle = await fs.open(lockPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`another devrules operation holds lock: ${lockPath}`);
    throw error;
  }
  let initialized = false;
  let ownedStat = null;
  try {
    ownedStat = await handle.stat();
    await handle.writeFile(`${JSON.stringify({
      schemaVersion: 2,
      token,
      pid: process.pid,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`);
    initialized = true;
    return await callback();
  } finally {
    await handle?.close().catch(() => {});
    const currentStat = await fs.lstat(lockPath).catch(() => null);
    const currentToken = await fs.readFile(lockPath, 'utf8').then((content) => JSON.parse(content).token).catch(() => '');
    const ownsInode = ownedStat && currentStat && currentStat.dev === ownedStat.dev && currentStat.ino === ownedStat.ino;
    if (ownsInode && (!initialized || currentToken === token)) {
      await fs.rm(lockPath, { force: true }).catch(() => {});
    }
  }
}
