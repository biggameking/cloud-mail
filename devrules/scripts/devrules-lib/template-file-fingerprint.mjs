import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function fileFingerprint(filePath) {
  const stat = await fs.lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return { exists: false, regular: false, kind: 'missing', hash: '', content: null, mode: null };
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return {
      exists: true,
      regular: false,
      kind: stat.isSymbolicLink() ? 'symbolic link' : stat.isDirectory() ? 'directory' : 'non-regular file',
      hash: '',
      content: null,
      mode: stat.mode & 0o777,
    };
  }
  const content = await fs.readFile(filePath);
  return {
    exists: true,
    regular: true,
    kind: 'regular file',
    hash: hash(content),
    content,
    mode: stat.mode & 0o777,
  };
}

export function fingerprintMatches(actual, expected) {
  if (actual.exists !== expected.exists) return false;
  if (!actual.exists) return true;
  return actual.regular && expected.regular !== false && actual.hash === expected.hash;
}
