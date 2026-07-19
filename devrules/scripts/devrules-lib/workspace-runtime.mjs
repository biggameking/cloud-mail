import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function normalizePortablePath(value) {
  return String(value).replace(/\\/g, '/').split(path.sep).join('/');
}

function slugIdentifier(value, fallback = 'workspace') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function shortHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 8);
}

function workspaceLabel(workspacePath) {
  const normalized = normalizePortablePath(workspacePath).replace(/[\\/]+$/g, '');
  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  return segments.at(-1) || 'workspace';
}

function workspaceIdFor(deviceId, workspacePath) {
  const normalizedPath = normalizePortablePath(workspacePath);
  return `${deviceId}-${slugIdentifier(workspaceLabel(normalizedPath))}-${shortHash(normalizedPath)}`;
}

export function safeRealpath(filePath) {
  try {
    return normalizePortablePath(realpathSync(filePath));
  } catch {
    return normalizePortablePath(path.resolve(filePath));
  }
}

export function createWorkspaceRegistryInfo(root, options) {
  const resolvedRoot = path.resolve(root);
  const normalizedRoot = normalizePortablePath(resolvedRoot);
  const devrulesPath = normalizePortablePath(path.join(resolvedRoot, 'devrules'));
  const templatePath = normalizePortablePath(options.templateRoot);
  const templateRealpath = normalizePortablePath(options.templateRealpath || safeRealpath(options.templateRoot));
  const workspaceDevrulesRealpath = existsSync(devrulesPath) ? safeRealpath(devrulesPath) : '';

  return {
    deviceId: options.deviceId,
    workspaceId: workspaceIdFor(options.deviceId, normalizedRoot),
    label: path.basename(resolvedRoot) || 'workspace',
    path: normalizedRoot,
    templateBinding: {
      templateId: options.templateId,
      path: templatePath,
      realpath: templateRealpath,
    },
    devrulesPath,
    devrulesRealpath: workspaceDevrulesRealpath,
    isTemplateWorkspace: workspaceDevrulesRealpath === templateRealpath,
    lastSeen: options.lastSeen,
  };
}

export function legacyWorkspaceFromRoot(deviceId, workspaceRoot, fallback = {}) {
  const normalizedRoot = normalizePortablePath(workspaceRoot);
  const trimmedRoot = normalizedRoot.replace(/[\\/]+$/g, '');
  return {
    deviceId,
    workspaceId: workspaceIdFor(deviceId, trimmedRoot),
    label: workspaceLabel(trimmedRoot),
    path: trimmedRoot,
    devrulesPath: fallback.devrulesPath || `${trimmedRoot}/devrules`,
    devrulesRealpath: fallback.devrulesRealpath || '',
    isTemplateWorkspace: fallback.isTemplateWorkspace === true,
    lastSeen: fallback.lastSeen || new Date().toISOString(),
  };
}

export function addWorkspaceRoot(rootsByPath, root) {
  if (!root) return;
  const normalized = normalizePortablePath(path.resolve(String(root))).replace(/[\\/]+$/g, '');
  if (normalized) rootsByPath.set(normalized, normalized);
}

export async function workspaceRootStatus(root) {
  try {
    const stat = await fs.stat(root);
    return stat.isDirectory()
      ? { root, available: true, reason: '' }
      : { root, available: false, reason: 'not a directory' };
  } catch (error) {
    return { root, available: false, reason: error.code || error.message };
  }
}

export function resolveWorkspaceConfigRoot(rootValue, templateRoot) {
  if (!rootValue) return '';
  const value = String(rootValue);
  return path.isAbsolute(value) ? value : path.resolve(templateRoot, value);
}

export function workspaceUsesTemplate(workspace, options) {
  if (!workspace) return false;
  const binding = workspace.templateBinding && typeof workspace.templateBinding === 'object'
    && !Array.isArray(workspace.templateBinding) ? workspace.templateBinding : null;
  if (binding) {
    const bindingTemplateId = String(binding.templateId || '').trim();
    const bindingPath = binding.realpath || binding.path;
    const identityMatches = Boolean(options.templateId && bindingTemplateId === options.templateId);
    return Boolean(identityMatches && bindingPath && safeRealpath(bindingPath) === options.templateRealpath);
  }

  const workspacePath = workspace.path || workspace.workspacePath || '';
  const devrulesPath = workspace.devrulesPath || (workspacePath ? path.join(workspacePath, 'devrules') : '');
  const devrulesRealpath = workspace.devrulesRealpath
    ? safeRealpath(workspace.devrulesRealpath)
    : devrulesPath ? safeRealpath(devrulesPath) : '';
  return Boolean(devrulesRealpath && options.templateRealpath && devrulesRealpath === options.templateRealpath);
}
