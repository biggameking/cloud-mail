import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  mapWithConcurrency,
  normalizeRel,
  nowIso,
  writeTextIfChanged,
} from './fs-actions.mjs';
import { findGitRepos } from './repo-discovery.mjs';
import {
  createWorkspaceRegistryInfo,
  legacyWorkspaceFromRoot,
} from './workspace-runtime.mjs';

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function currentDeviceId() {
  const raw = process.env.DEVRULES_DEVICE_ID || process.env.COMPUTERNAME || os.hostname() || 'unknown-device';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unknown-device';
}

function workspaceRegistryInfo(root, context) {
  return createWorkspaceRegistryInfo(root, {
    deviceId: currentDeviceId(),
    templateId: context.templateId,
    templateRoot: context.templateRoot,
    templateRealpath: context.templateRealpath,
    lastSeen: nowIso(),
  });
}

export function workspaceRecordsForDevice(device) {
  const byKey = new Map();
  const deviceId = device?.deviceId || 'unknown-device';
  for (const root of device?.workspaceRoots || []) {
    const workspace = legacyWorkspaceFromRoot(deviceId, root, { lastSeen: device.lastUpdated || device.lastSeen });
    byKey.set(`${workspace.deviceId}:${workspace.workspaceId}`, workspace);
  }
  for (const workspace of device?.workspaces || []) {
    if (!workspace?.workspaceId && !workspace?.path) continue;
    const enriched = {
      ...legacyWorkspaceFromRoot(deviceId, workspace.path || workspace.workspacePath || '', workspace),
      ...workspace,
      deviceId: workspace.deviceId || deviceId,
    };
    if (enriched.workspaceId) byKey.set(`${enriched.deviceId}:${enriched.workspaceId}`, enriched);
  }
  return [...byKey.values()].sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')));
}

function normalizeDeviceRegistryItem(device) {
  if (!device?.deviceId) return device;
  return {
    ...device,
    workspaceRoots: uniqueSorted(device.workspaceRoots || []),
    workspaces: workspaceRecordsForDevice(device),
  };
}

function buildDeviceRegistry(root, context) {
  const user = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return process.env.USERNAME || '';
    }
  })();
  const deviceId = currentDeviceId();
  const workspace = workspaceRegistryInfo(root, context);
  return {
    schemaVersion: 1,
    lastUpdated: nowIso(),
    devices: [
      {
        deviceId,
        hostname: os.hostname(),
        computerName: process.env.COMPUTERNAME || os.hostname(),
        user,
        platform: {
          type: os.type(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
        },
        workspaceRoots: [normalizeRel(root)],
        workspaces: [workspace],
        skillRoots: context.defaultSkillRoots().map((item) => ({
          surface: item.surface,
          path: normalizeRel(item.root),
          exists: existsSync(item.root),
        })),
      },
    ],
  };
}

function projectRegistryEntry(status, eligibility, deviceId, workspace, lastSeen) {
  const compliant = eligibility.eligible;
  return {
    name: status.name,
    path: normalizeRel(status.repo),
    deviceId,
    workspaceId: workspace.workspaceId,
    workspacePath: workspace.path,
    readinessGroup: compliant ? 'compliant' : 'needsReview',
    devrulesStatus: compliant ? 'compliant' : 'needsReview',
    maturityLevel: status.maturityLevel,
    sourceRoots: status.sourceRoots,
    hasAgents: status.hasAgents,
    hasClaude: status.hasClaude,
    hasDevRulesInstance: status.hasDevRulesInstance,
    reasons: compliant ? [] : eligibility.reasons,
    lastSeen,
  };
}

async function buildProjectsRegistry(root, context) {
  const repos = await findGitRepos(root, false);
  const lastSeen = nowIso();
  const deviceId = currentDeviceId();
  const workspace = workspaceRegistryInfo(root, context);
  const projects = await mapWithConcurrency(repos, context.scanConcurrency, async (repo) => {
    const status = await context.scanRepo(repo);
    const eligibility = context.syncTemplateEligibility(status);
    return projectRegistryEntry(status, eligibility, deviceId, workspace, lastSeen);
  });
  const compliant = projects.filter((project) => project.devrulesStatus === 'compliant').length;
  const needsReview = projects.length - compliant;
  return {
    schemaVersion: 1,
    lastUpdated: lastSeen,
    root: normalizeRel(root),
    workspaceId: workspace.workspaceId,
    workspacePath: workspace.path,
    workspaces: [workspace],
    deviceId,
    summary: {
      total: projects.length,
      devices: 1,
      workspaces: 1,
      compliant,
      needsReview,
      alreadyReady: compliant,
      readyToApply: 0,
    },
    projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function buildRegistry(root, context) {
  const resolvedRoot = path.resolve(root);
  const devices = buildDeviceRegistry(resolvedRoot, context);
  const projects = await buildProjectsRegistry(resolvedRoot, context);
  const skills = await context.buildSkillsRegistry();
  return {
    root: normalizeRel(resolvedRoot),
    devices,
    projects,
    skills,
  };
}

function stripRegistryTimestamps(value) {
  if (Array.isArray(value)) return value.map((item) => stripRegistryTimestamps(item));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'lastUpdated' || key === 'lastSeen') continue;
    result[key] = stripRegistryTimestamps(item);
  }
  return result;
}

function mergeDeviceRegistry(existing, current) {
  const byId = new Map();
  for (const item of existing?.devices || []) {
    if (item?.deviceId) byId.set(item.deviceId, normalizeDeviceRegistryItem(item));
  }
  for (const item of current.devices || []) {
    if (!item?.deviceId) continue;
    const currentItem = normalizeDeviceRegistryItem(item);
    const existingItem = byId.get(currentItem.deviceId);
    if (!existingItem) {
      byId.set(currentItem.deviceId, currentItem);
      continue;
    }
    const workspacesById = new Map();
    for (const workspace of existingItem.workspaces || []) {
      if (workspace?.workspaceId) workspacesById.set(workspace.workspaceId, { ...workspace, deviceId: workspace.deviceId || currentItem.deviceId });
    }
    for (const workspace of currentItem.workspaces || []) {
      if (workspace?.workspaceId) workspacesById.set(workspace.workspaceId, { ...workspace, deviceId: workspace.deviceId || currentItem.deviceId });
    }
    byId.set(currentItem.deviceId, {
      ...existingItem,
      ...currentItem,
      workspaceRoots: uniqueSorted([...(existingItem.workspaceRoots || []), ...(currentItem.workspaceRoots || [])]),
      workspaces: [...workspacesById.values()].sort((a, b) => String(a.path || '').localeCompare(String(b.path || ''))),
    });
  }
  return {
    schemaVersion: 1,
    lastUpdated: current.lastUpdated,
    devices: [...byId.values()].sort((a, b) => String(a.deviceId).localeCompare(String(b.deviceId))),
  };
}

function projectRegistryKey(project) {
  return `${project.deviceId || 'unknown'}:${project.workspaceId || 'legacy'}:${String(project.name || project.path || '').toLowerCase()}`;
}

function projectRegistrySummary(projects) {
  const compliant = projects.filter((project) => project.devrulesStatus === 'compliant').length;
  const needsReview = projects.length - compliant;
  return {
    total: projects.length,
    devices: uniqueSorted(projects.map((project) => project.deviceId).filter(Boolean)).length,
    workspaces: uniqueSorted(projects.map((project) => project.workspaceId).filter(Boolean)).length,
    compliant,
    needsReview,
    alreadyReady: compliant,
    readyToApply: 0,
  };
}

function projectBelongsToWorkspace(project, current) {
  if (!project || !current) return false;
  if (project.workspaceId && current.workspaceId) return project.workspaceId === current.workspaceId;
  if (project.workspaceId) return false;
  if (project.deviceId !== current.deviceId) return false;
  const projectPath = normalizeRel(project.path || '');
  const rootPath = normalizeRel(current.root || '').replace(/\/$/, '');
  return Boolean(rootPath) && (projectPath === rootPath || projectPath.startsWith(`${rootPath}/`));
}

function projectWorkspaceCandidates(existing, current) {
  const candidates = new Map();
  const projects = [...(existing?.projects || []), ...(current.projects || [])];
  const addWorkspace = (workspace) => {
    if (!workspace?.workspaceId && !workspace?.path) return;
    const deviceId = workspace.deviceId || current.deviceId || existing?.deviceId || 'unknown-device';
    const normalized = {
      ...legacyWorkspaceFromRoot(deviceId, workspace.path || workspace.workspacePath || '', workspace),
      ...workspace,
      deviceId,
    };
    candidates.set(`${normalized.deviceId}:${normalized.workspaceId}`, normalized);
  };
  const workspaceHasProject = (workspace) => {
    const workspacePath = normalizeRel(workspace?.path || workspace?.workspacePath || '').replace(/[\\/]+$/g, '');
    const workspaceDevice = workspace?.deviceId || current.deviceId || existing?.deviceId;
    if (!workspacePath || !workspaceDevice) return false;
    return projects.some((project) => {
      if (project.deviceId !== workspaceDevice) return false;
      const projectPath = normalizeRel(project.path || '');
      return projectPath === workspacePath || projectPath.startsWith(`${workspacePath}/`);
    });
  };

  for (const workspace of [...(existing?.workspaces || []), ...(current.workspaces || [])]) {
    if (workspaceHasProject(workspace)) addWorkspace(workspace);
  }

  const roots = uniqueSorted([
    ...(existing?.roots || []),
    existing?.root,
    ...(current.roots || []),
    current.root,
  ].filter(Boolean));
  for (const project of projects) {
    const deviceId = project.deviceId;
    if (!deviceId) continue;
    const projectPath = normalizeRel(project.path || '');
    for (const root of roots) {
      const workspacePath = normalizeRel(root).replace(/[\\/]+$/g, '');
      if (!workspacePath || (projectPath !== workspacePath && !projectPath.startsWith(`${workspacePath}/`))) continue;
      const workspace = legacyWorkspaceFromRoot(deviceId, root);
      candidates.set(`${workspace.deviceId}:${workspace.workspaceId}`, workspace);
    }
  }
  return [...candidates.values()].sort((a, b) => String(b.path || '').length - String(a.path || '').length);
}

function hydrateProjectWorkspace(project, candidates) {
  if (!project || project.workspaceId) return project;
  const projectPath = normalizeRel(project.path || '');
  const match = candidates.find((workspace) => {
    if (workspace.deviceId !== project.deviceId) return false;
    const workspacePath = normalizeRel(workspace.path || '').replace(/[\\/]+$/g, '');
    return Boolean(workspacePath) && (projectPath === workspacePath || projectPath.startsWith(`${workspacePath}/`));
  });
  if (!match) return project;
  return {
    ...project,
    workspaceId: match.workspaceId,
    workspacePath: match.path,
  };
}

function mergeProjectRegistry(existing, current) {
  const byKey = new Map();
  const replaceCurrentWorkspace = current.workspaceId && current.projects.length > 0;
  const workspaceCandidates = projectWorkspaceCandidates(existing, current);
  for (const item of existing?.projects || []) {
    const hydrated = hydrateProjectWorkspace(item, workspaceCandidates);
    if (replaceCurrentWorkspace && projectBelongsToWorkspace(hydrated, current)) continue;
    const key = projectRegistryKey(hydrated);
    if (key.trim() !== ':') byKey.set(key, hydrated);
  }
  for (const item of current.projects || []) {
    const hydrated = hydrateProjectWorkspace(item, workspaceCandidates);
    const key = projectRegistryKey(hydrated);
    if (key.trim() !== ':') byKey.set(key, hydrated);
  }
  const projects = [...byKey.values()].sort((a, b) => {
    const deviceCompare = String(a.deviceId || '').localeCompare(String(b.deviceId || ''));
    return deviceCompare || String(a.name || '').localeCompare(String(b.name || ''));
  });
  const roots = uniqueSorted([
    ...(existing?.roots || []),
    existing?.root,
    ...(current.roots || []),
    current.root,
  ].filter(Boolean));
  const workspacesById = new Map();
  for (const workspace of workspaceCandidates) {
    if (workspace?.workspaceId) workspacesById.set(`${workspace.deviceId || ''}:${workspace.workspaceId}`, workspace);
  }
  return {
    schemaVersion: 1,
    lastUpdated: current.lastUpdated,
    root: current.root,
    roots,
    deviceId: current.deviceId,
    workspaceId: current.workspaceId,
    workspacePath: current.workspacePath,
    workspaces: [...workspacesById.values()].sort((a, b) => String(a.path || '').localeCompare(String(b.path || ''))),
    summary: projectRegistrySummary(projects),
    projects,
  };
}

async function stableRegistryJsonValue(filePath, nextValue, expectedType, expectedId) {
  const existingValue = await readRegistryAuthorityRecord(filePath, expectedType, expectedId);
  if (!existingValue) return nextValue;
  const existingStable = JSON.stringify(stripRegistryTimestamps(existingValue));
  const nextStable = JSON.stringify(stripRegistryTimestamps(nextValue));
  if (existingStable === nextStable) return existingValue;
  return nextValue;
}

export function registryRecordId(value) {
  const raw = String(value || '').trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
  const suffix = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8);
  return `${slug}-${suffix}`;
}

export async function readRegistryAuthorityRecord(filePath, expectedType, expectedId = '') {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`invalid registry authority record ${filePath}: cannot read (${error?.message || error})`);
  }
  let payload;
  try {
    payload = JSON.parse(content);
  } catch {
    throw new Error(`invalid registry authority record ${filePath}: malformed JSON`);
  }
  const recordId = registryRecordIdentifier(payload, expectedType);
  const issues = [];
  if (payload?.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (!['active', 'retired'].includes(payload?.status)) issues.push('status must be active or retired');
  if (payload?.recordType !== expectedType) issues.push(`recordType must be ${expectedType}`);
  if (!recordId) issues.push('record ID is missing');
  if (expectedId && recordId !== expectedId) issues.push(`record ID ${recordId} does not match expected ${expectedId}`);
  if (recordId && path.basename(filePath) !== `${registryRecordId(recordId)}.json`) issues.push('filename does not match record ID');
  if (issues.length) throw new Error(`invalid registry authority record ${filePath}: ${issues.join('; ')}`);
  return payload;
}

async function readRegistryRecordPayloads(directory, expectedType) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const payloads = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const payload = await readRegistryAuthorityRecord(path.join(directory, entry.name), expectedType);
    if (payload) payloads.push(payload);
  }
  return payloads;
}

export async function validateRegistryAuthorityRecords(registryDir) {
  await Promise.all([
    readRegistryRecordPayloads(path.join(registryDir, 'device-records'), 'device'),
    readRegistryRecordPayloads(path.join(registryDir, 'workspace-records'), 'workspace'),
  ]);
}

function registryRecordIdentifier(record, type) {
  if (record?.recordId) return String(record.recordId);
  if (type === 'device') return String(record?.device?.deviceId || '');
  return String(record?.projects?.workspaceId || '');
}

function registryRetirementIds(records, type) {
  return new Set(records
    .filter((record) => record?.status === 'retired')
    .map((record) => registryRecordIdentifier(record, type))
    .filter(Boolean));
}

function filterRetiredRegistryView(devices, projects, retiredDeviceIds, retiredWorkspaceIds) {
  const retiredWorkspacePaths = new Set();
  for (const device of devices.devices || []) {
    for (const workspace of device.workspaces || []) {
      if (retiredWorkspaceIds.has(workspace.workspaceId)) retiredWorkspacePaths.add(normalizeRel(workspace.path || ''));
    }
  }
  for (const workspace of projects.workspaces || []) {
    if (retiredWorkspaceIds.has(workspace.workspaceId)) retiredWorkspacePaths.add(normalizeRel(workspace.path || ''));
  }

  const activeDevices = (devices.devices || [])
    .filter((device) => !retiredDeviceIds.has(device.deviceId))
    .map((device) => {
      const workspaces = (device.workspaces || []).filter((workspace) => !retiredWorkspaceIds.has(workspace.workspaceId));
      return {
        ...device,
        workspaces,
        workspaceRoots: uniqueSorted((device.workspaceRoots || [])
          .filter((root) => !retiredWorkspacePaths.has(normalizeRel(root)))),
      };
    });
  const activeWorkspaces = (projects.workspaces || []).filter((workspace) => (
    !retiredDeviceIds.has(workspace.deviceId) && !retiredWorkspaceIds.has(workspace.workspaceId)
  ));
  const activeProjects = (projects.projects || []).filter((project) => (
    !retiredDeviceIds.has(project.deviceId) && !retiredWorkspaceIds.has(project.workspaceId)
  ));
  return {
    devices: {
      ...devices,
      devices: activeDevices,
    },
    projects: {
      ...projects,
      roots: uniqueSorted((projects.roots || []).filter((root) => !retiredWorkspacePaths.has(normalizeRel(root)))),
      workspaces: activeWorkspaces,
      projects: activeProjects,
      summary: projectRegistrySummary(activeProjects),
    },
  };
}

export async function writeRegistryAuthorityRecords(registryDir, registry, apply, actions) {
  const device = registry.devices.devices.find((item) => item.deviceId === registry.projects.deviceId) || registry.devices.devices[0];
  const workspace = registry.projects.workspaces.find((item) => item.workspaceId === registry.projects.workspaceId) || registry.projects.workspaces[0];
  const devicePath = device?.deviceId
    ? path.join(registryDir, 'device-records', `${registryRecordId(device.deviceId)}.json`)
    : '';
  const workspacePath = workspace?.workspaceId
    ? path.join(registryDir, 'workspace-records', `${registryRecordId(workspace.workspaceId)}.json`)
    : '';
  // Revalidate both owned shards before the first planned write so unknown bytes are never regenerated over.
  const [previousDeviceRecord] = await Promise.all([
    devicePath ? readRegistryAuthorityRecord(devicePath, 'device', device.deviceId) : null,
    workspacePath ? readRegistryAuthorityRecord(workspacePath, 'workspace', workspace.workspaceId) : null,
  ]);
  if (device?.deviceId) {
    const previousDevices = previousDeviceRecord?.status === 'active' && previousDeviceRecord.device
      ? { schemaVersion: 1, lastUpdated: previousDeviceRecord.lastSeen, devices: [previousDeviceRecord.device] }
      : { schemaVersion: 1, lastUpdated: registry.projects.lastUpdated, devices: [] };
    const mergedDevices = mergeDeviceRegistry(previousDevices, {
      schemaVersion: 1,
      lastUpdated: registry.projects.lastUpdated,
      devices: [device],
    });
    const mergedDevice = mergedDevices.devices.find((item) => item.deviceId === device.deviceId) || device;
    const payload = {
      schemaVersion: 1,
      status: 'active',
      recordType: 'device',
      recordId: device.deviceId,
      lastSeen: registry.projects.lastUpdated,
      device: mergedDevice,
    };
    const stablePayload = await stableRegistryJsonValue(devicePath, payload, 'device', device.deviceId);
    await writeTextIfChanged(devicePath, `${JSON.stringify(stablePayload, null, 2)}\n`, apply, actions, 'refresh device-owned registry record');
  }
  if (workspace?.workspaceId) {
    const payload = {
      schemaVersion: 1,
      status: 'active',
      recordType: 'workspace',
      recordId: workspace.workspaceId,
      lastSeen: registry.projects.lastUpdated,
      projects: registry.projects,
    };
    const stablePayload = await stableRegistryJsonValue(workspacePath, payload, 'workspace', workspace.workspaceId);
    await writeTextIfChanged(workspacePath, `${JSON.stringify(stablePayload, null, 2)}\n`, apply, actions, 'refresh workspace-owned registry record');
  }
}

export async function mergeRegistryAuthorityRecords(registryDir, currentRegistry, options = {}) {
  const deviceRecords = await readRegistryRecordPayloads(path.join(registryDir, 'device-records'), 'device');
  const workspaceRecords = await readRegistryRecordPayloads(path.join(registryDir, 'workspace-records'), 'workspace');
  const retiredDeviceIds = registryRetirementIds(deviceRecords, 'device');
  const retiredWorkspaceIds = registryRetirementIds(workspaceRecords, 'workspace');
  if (options.currentOverridesRetirement) {
    retiredDeviceIds.delete(currentRegistry?.projects?.deviceId);
    retiredWorkspaceIds.delete(currentRegistry?.projects?.workspaceId);
  }

  let devices = { schemaVersion: 1, lastUpdated: currentRegistry?.devices?.lastUpdated || nowIso(), devices: [] };
  for (const record of deviceRecords.filter((item) => item?.status === 'active')) {
    devices = mergeDeviceRegistry(devices, {
      schemaVersion: 1,
      lastUpdated: record.lastSeen,
      devices: record.device ? [record.device] : [],
    });
  }
  if (currentRegistry?.devices) devices = mergeDeviceRegistry(devices, currentRegistry.devices);

  let projects = {
    schemaVersion: 1,
    lastUpdated: currentRegistry?.projects?.lastUpdated || nowIso(),
    root: '',
    roots: [],
    deviceId: '',
    workspaceId: '',
    workspacePath: '',
    workspaces: [],
    summary: projectRegistrySummary([]),
    projects: [],
  };
  for (const record of workspaceRecords.filter((item) => item?.status === 'active')) {
    if (record.projects) projects = mergeProjectRegistry(projects, record.projects);
  }
  if (currentRegistry?.projects) projects = mergeProjectRegistry(projects, currentRegistry.projects);
  return filterRetiredRegistryView(devices, projects, retiredDeviceIds, retiredWorkspaceIds);
}
