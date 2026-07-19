import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from './safe-files.mjs';

export function expectedFileAfter(content, mode = undefined) {
  const payload = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  return {
    present: true,
    type: 'file',
    hash: `sha256:${crypto.createHash('sha256').update(payload).digest('hex')}`,
    ...(mode === undefined ? {} : { mode }),
  };
}

export function expectedAbsentAfter() {
  return {
    present: false,
    type: 'absent',
    hash: `sha256:${crypto.createHash('sha256').update('absent').digest('hex')}`,
    mode: null,
  };
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function readFileWithRetry(filePath, encoding = null, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return encoding ? await fs.readFile(filePath, encoding) : await fs.readFile(filePath);
    } catch (error) {
      lastError = error;
      if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === attempts - 1) break;
      await sleep(75 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function readText(filePath, fallback = '') {
  try {
    return await readFileWithRetry(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

export async function writeText(filePath, content, apply, actions, reason) {
  const currentMode = await fs.stat(filePath).then((stat) => stat.mode & 0o7777).catch(() => 0o644);
  const expectedAfter = expectedFileAfter(content, currentMode);
  if (!apply) {
    actions.push({ action: 'write', path: filePath, reason, mode: 'dry-run', expectedAfter });
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteFile(filePath, content);
  actions.push({ action: 'write', path: filePath, reason, mode: 'applied', expectedAfter });
}

export async function writeTextIfChanged(filePath, content, apply, actions, reason) {
  const current = await readText(filePath, null);
  if (current === content) {
    actions.push({ action: 'skip', path: filePath, reason: 'already current' });
    return false;
  }
  await writeText(filePath, content, apply, actions, reason);
  return true;
}

export async function ensureMissingText(filePath, content, apply, actions, reason) {
  if (await pathExists(filePath)) {
    actions.push({ action: 'skip', path: filePath, reason: 'already exists' });
    return false;
  }
  await writeText(filePath, content, apply, actions, reason);
  return true;
}

export async function listDirs(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

export async function listFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function normalizeRel(filePath) {
  return String(filePath).replace(/\\/g, '/').split(path.sep).join('/');
}

export function isSubPath(parentRel, childRel) {
  const parent = normalizeRel(parentRel).replace(/\/$/, '');
  const child = normalizeRel(childRel).replace(/\/$/, '');
  return child !== parent && child.startsWith(`${parent}/`);
}
