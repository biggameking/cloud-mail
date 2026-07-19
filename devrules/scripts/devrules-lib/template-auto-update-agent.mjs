import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { defaultRuntimeLauncherPath } from './runtime-location.mjs';
import { atomicWriteFile } from './safe-files.mjs';

const execFileAsync = promisify(execFile);
const MAC_LABEL = 'com.devrules.template-auto-update';
const WINDOWS_TASK = 'devrules-template-auto-update';
const DEFAULT_SCHEDULE = '11:35';
const SCHEDULER_COMMAND_TIMEOUT_MS = 30_000;

async function runCapture(command, args) {
  try {
    const result = await execFileAsync(command, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      timeout: SCHEDULER_COMMAND_TIMEOUT_MS, windowsHide: true });
    return { ok: true, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
  } catch (error) {
    return { ok: false, stdout: String(error?.stdout || ''), stderr: String(error?.stderr || error?.message || error), code: error?.code };
  }
}

function sh(value) { return `'${String(value).replaceAll("'", `'"'"'`)}'`; }
function ps(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function xml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function schedule(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  const hour = Number(match?.[1]), minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new Error(`invalid template auto-update schedule: ${value}`);
  return { hour, minute };
}
function policy(options = {}) { return { schemaVersion: 1, enabled: true, allowMajor: options.allowMajor === true,
  reconcileOwnership: options.reconcileOwnership === true, schedule: options.schedule || DEFAULT_SCHEDULE }; }

async function loadPolicy(policyPath, options) {
  try {
    const value = JSON.parse(await fs.readFile(policyPath, 'utf8'));
    if (value?.schemaVersion !== 1 || value.enabled !== true || typeof value.allowMajor !== 'boolean'
      || typeof value.reconcileOwnership !== 'boolean') throw new Error('invalid schema/enabled/allowMajor/reconcileOwnership');
    schedule(value.schedule);
    return { exists: true, valid: true, value };
  } catch (error) {
    return error?.code === 'ENOENT' ? { exists: false, valid: true, value: policy(options) }
      : { exists: true, valid: false, value: policy(options), error: error.message };
  }
}

function macWrapper(spec) {
  const args = ['template', 'auto-update', 'run', '--apply', '--device-opt-in'];
  if (spec.policy.allowMajor) args.push('--allow-major');
  if (spec.policy.reconcileOwnership) args.push('--reconcile-ownership');
  args.push('--json');
  return `#!/bin/bash\nset -euo pipefail\nmkdir -p ${sh(spec.logDir)}\n${sh(spec.nodePath)} ${sh(spec.launcherPath)} ${args.map(sh).join(' ')} >> ${sh(spec.logPath)} 2>&1\n`;
}
function macPlist(spec) {
  const parts = schedule(spec.policy.schedule);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${MAC_LABEL}</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>${xml(spec.wrapper)}</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>${parts.hour}</integer><key>Minute</key><integer>${parts.minute}</integer></dict>
<key>StandardOutPath</key><string>${xml(path.join(spec.logDir, 'template-auto-update.out.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(spec.logDir, 'template-auto-update.err.log'))}</string>
<key>RunAtLoad</key><false/>
</dict></plist>\n`;
}
function windowsWrapper(spec) {
  const args = ['template', 'auto-update', 'run', '--apply', '--device-opt-in'];
  if (spec.policy.allowMajor) args.push('--allow-major');
  if (spec.policy.reconcileOwnership) args.push('--reconcile-ownership');
  args.push('--json');
  return `$ErrorActionPreference = 'Stop'\nNew-Item -ItemType Directory -Force -Path ${ps(spec.logDir)} | Out-Null\n& ${ps(spec.nodePath)} ${ps(spec.launcherPath)} ${args.map(ps).join(' ')} >> ${ps(spec.logPath)} 2>&1\nexit $LASTEXITCODE\n`;
}

export function buildTemplateAutoUpdateAgentSpec(options = {}) {
  const platform = options.platform || process.platform, homeDir = options.homeDir || os.homedir(), selectedPolicy = options.policy || policy(options);
  schedule(selectedPolicy.schedule);
  const configDir = path.join(homeDir, '.config', 'devrules'), logDir = options.logDir || path.join(configDir, 'logs');
  const base = { platform, homeDir, policy: selectedPolicy, policyPath: options.policyPath || path.join(configDir, 'template-auto-update-policy.json'),
    launcherPath: options.launcherPath || defaultRuntimeLauncherPath({ platform, homeDir, env: options.env }),
    nodePath: options.nodePath || process.execPath, logDir, logPath: path.join(logDir, 'template-auto-update.jsonl') };
  if (platform === 'darwin') {
    const spec = { ...base, scheduler: 'launchd', label: MAC_LABEL, wrapper: path.join(configDir, 'template-auto-update-agent.sh'),
      plist: path.join(homeDir, 'Library', 'LaunchAgents', `${MAC_LABEL}.plist`) };
    return { ...spec, wrapperContent: macWrapper(spec), plistContent: macPlist(spec), taskCommand: '' };
  }
  if (platform === 'win32') {
    const spec = { ...base, scheduler: 'task-scheduler', taskName: WINDOWS_TASK, wrapper: path.join(configDir, 'template-auto-update-agent.ps1'), plist: '' };
    return { ...spec, wrapperContent: windowsWrapper(spec), plistContent: '',
      taskCommand: `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${spec.wrapper.replaceAll('"', '""')}"` };
  }
  return { ...base, scheduler: 'unsupported', wrapper: '', plist: '', wrapperContent: '', plistContent: '', taskCommand: '' };
}

async function current(filePath, expected) { return filePath ? fs.readFile(filePath, 'utf8').then((value) => value === expected).catch(() => false) : false; }
async function launcherAvailable(spec) {
  try {
    const [launcher, node] = await Promise.all([fs.lstat(spec.launcherPath), fs.stat(spec.nodePath)]);
    return launcher.isFile() && !launcher.isSymbolicLink() && node.isFile()
      && (spec.platform === 'win32' || (node.mode & 0o111) !== 0);
  } catch {
    return false;
  }
}
async function registration(spec, run) {
  if (spec.scheduler === 'launchd') return run('launchctl', ['print', `gui/${process.getuid()}/${spec.label}`]);
  if (spec.scheduler === 'task-scheduler') return run('schtasks.exe', ['/Query', '/TN', spec.taskName, '/XML']);
  return { ok: false };
}

function registrationDefinitelyAbsent(spec, result) {
  if (result.ok) return false;
  const detail = `${result.stderr || ''}\n${result.stdout || ''}`;
  if (spec.scheduler === 'launchd') return /could not find service|service (?:was )?not found|\bnot found\b|no such process/i.test(detail);
  if (spec.scheduler === 'task-scheduler') return /cannot find|does not exist|\bnot found\b/i.test(detail);
  return false;
}

function registrationMatchesSpec(spec, registered) {
  if (!registered.ok) return false;
  const output = String(registered.stdout || '');
  if (!output) return false;
  const parts = schedule(spec.policy.schedule);
  if (spec.scheduler === 'launchd') {
    return output.includes(spec.wrapper)
      && new RegExp(`["']?Hour["']?\\s*(?:=>|=)\\s*${parts.hour}\\b`, 'i').test(output)
      && new RegExp(`["']?Minute["']?\\s*(?:=>|=)\\s*${parts.minute}\\b`, 'i').test(output);
  }
  if (spec.scheduler === 'task-scheduler') return templateAutoUpdateWindowsTaskCurrent(spec, output);
  return false;
}

export function templateAutoUpdateWindowsTaskCurrent(spec, taskXml) {
  const output = String(taskXml || '').replaceAll('\0', '');
  const normalized = output.toLowerCase();
  const parts = schedule(spec.policy.schedule);
  const expected = [
    '<calendartrigger',
    '<schedulebyday>',
    '<daysinterval>1</daysinterval>',
    '<command>powershell.exe</command>',
    '-noprofile',
    '-noninteractive',
    '-windowstyle hidden',
    '-executionpolicy bypass',
    '-file',
    xml(spec.wrapper).toLowerCase(),
  ];
  return !/<Enabled>\s*false\s*<\/Enabled>/i.test(output)
    && new RegExp(`T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}(?::|<)`, 'i').test(output)
    && expected.every((value) => normalized.includes(value));
}

export async function templateAutoUpdateAgentStatus(options = {}) {
  const provisional = buildTemplateAutoUpdateAgentSpec(options);
  const stored = await loadPolicy(provisional.policyPath, options);
  const spec = buildTemplateAutoUpdateAgentSpec({ ...options, policy: stored.value, policyPath: provisional.policyPath });
  if (spec.scheduler === 'unsupported') return { command: 'agent-status', status: 'unsupported', healthy: false, installed: false,
    scheduler: spec.scheduler, policyPath: spec.policyPath, allowMajor: stored.value.allowMajor,
    reconcileOwnership: stored.value.reconcileOwnership };
  const run = options.runCapture || runCapture;
  const [launcherReady, wrapperCurrent, plistCurrent, registered] = await Promise.all([
    launcherAvailable(spec), current(spec.wrapper, spec.wrapperContent), spec.plist ? current(spec.plist, spec.plistContent) : true, registration(spec, run),
  ]);
  const installed = await fs.stat(spec.wrapper).then(() => true).catch(() => false);
  const configurationCurrent = stored.exists && stored.valid && wrapperCurrent && plistCurrent;
  const registrationCurrent = registrationMatchesSpec(spec, registered);
  const healthy = launcherReady && installed && registered.ok && registrationCurrent && configurationCurrent;
  return { command: 'agent-status', status: healthy ? 'pass' : 'missing', healthy, installed, registered: registered.ok,
    registrationCurrent,
    launcherAvailable: launcherReady, launcherPath: spec.launcherPath, nodePath: spec.nodePath, configurationCurrent,
    scheduler: spec.scheduler, label: spec.label || '', taskName: spec.taskName || '', wrapper: spec.wrapper,
    plist: spec.plist, policyPath: spec.policyPath, allowMajor: stored.value.allowMajor, schedule: stored.value.schedule,
    reconcileOwnership: stored.value.reconcileOwnership,
    reason: stored.valid ? '' : `invalid device policy: ${stored.error}` };
}

function actions(spec) { return [{ kind: 'write', path: spec.policyPath }, { kind: 'write', path: spec.wrapper },
  ...(spec.plist ? [{ kind: 'write', path: spec.plist }] : []), { kind: spec.scheduler === 'launchd' ? 'launchctl' : 'task-scheduler', label: spec.label || spec.taskName }]; }

export async function ensureTemplateAutoUpdateAgent(options = {}) {
  const selectedPolicy = policy(options), spec = buildTemplateAutoUpdateAgentSpec({ ...options, policy: selectedPolicy });
  if (spec.scheduler === 'unsupported') return { command: 'ensure-agent',
    status: options.apply === true ? 'blocked' : 'unsupported', applied: false, scheduler: spec.scheduler,
    reason: 'template auto-update scheduler is unsupported on this platform' };
  const existing = await templateAutoUpdateAgentStatus(options);
  if (existing.healthy && existing.allowMajor === selectedPolicy.allowMajor
    && existing.reconcileOwnership === selectedPolicy.reconcileOwnership && existing.schedule === selectedPolicy.schedule) {
    return { ...existing, command: 'ensure-agent', applied: false, changed: false, requiresApply: false, actions: [] };
  }
  const planned = actions(spec);
  if (options.apply !== true) return { command: 'ensure-agent', status: 'dry-run', applied: false, requiresApply: true, scheduler: spec.scheduler, actions: planned };
  if (!(await launcherAvailable(spec))) {
    return { command: 'ensure-agent', status: 'blocked', applied: false, changed: false, scheduler: spec.scheduler,
      launcherPath: spec.launcherPath, reason: 'stable devrules launcher is unavailable; run devrules location install-launcher --apply first', actions: [] };
  }
  await atomicWriteFile(spec.policyPath, `${JSON.stringify(selectedPolicy, null, 2)}\n`, { mode: 0o644 });
  await atomicWriteFile(spec.wrapper, spec.wrapperContent, { mode: spec.scheduler === 'launchd' ? 0o755 : 0o644 });
  await fs.mkdir(spec.logDir, { recursive: true });
  const run = options.runCapture || runCapture;
  if (spec.scheduler === 'launchd') {
    await atomicWriteFile(spec.plist, spec.plistContent, { mode: 0o644 });
    await run('launchctl', ['bootout', `gui/${process.getuid()}/${spec.label}`]);
    const loaded = await run('launchctl', ['bootstrap', `gui/${process.getuid()}`, spec.plist]);
    if (!loaded.ok) throw new Error(`cannot register LaunchAgent: ${loaded.stderr || loaded.stdout}`);
  } else {
    const created = await run('schtasks.exe', ['/Create', '/TN', spec.taskName, '/SC', 'DAILY', '/ST', selectedPolicy.schedule, '/TR', spec.taskCommand, '/F']);
    if (!created.ok) throw new Error(`cannot register scheduled task: ${created.stderr || created.stdout}`);
  }
  const status = await templateAutoUpdateAgentStatus({ ...options, policy: selectedPolicy });
  if (!status.healthy) {
    return { ...status, command: 'ensure-agent', status: 'blocked', applied: true, changed: true, actions: planned,
      reason: status.reason || 'scheduler registration did not match the installed template auto-update policy' };
  }
  return { ...status, command: 'ensure-agent', applied: true, changed: status.healthy, actions: planned };
}

export async function refreshInstalledTemplateAutoUpdateAgent(options = {}) {
  const existing = await templateAutoUpdateAgentStatus(options);
  if (existing.installed !== true) {
    return {
      command: 'refresh-agent',
      status: 'skipped',
      applied: false,
      changed: false,
      installed: false,
      scheduler: existing.scheduler,
      actions: [],
      reason: 'template auto-update agent is not installed; release activation will not opt this device in',
    };
  }
  if (existing.reason) {
    return {
      ...existing,
      command: 'refresh-agent',
      status: 'blocked',
      applied: false,
      changed: false,
      actions: [],
      reason: `installed template auto-update policy cannot be preserved: ${existing.reason}`,
    };
  }
  const selectedPolicy = policy({
    allowMajor: existing.allowMajor === true,
    reconcileOwnership: existing.reconcileOwnership === true,
    schedule: existing.schedule,
  });
  const spec = buildTemplateAutoUpdateAgentSpec({ ...options, policy: selectedPolicy });
  if (!(await launcherAvailable(spec))) {
    return { ...existing, command: 'refresh-agent', status: 'blocked', applied: false, changed: false,
      actions: [], reason: 'stable devrules launcher is unavailable; installed auto-update agent cannot be refreshed' };
  }
  if (existing.registered !== true || existing.registrationCurrent !== true) {
    return { ...existing, command: 'refresh-agent', status: 'blocked', applied: false, changed: false,
      actions: [], reason: 'installed auto-update scheduler registration is missing or stale; in-process release activation will not reload it' };
  }

  // The scheduler identity, schedule, and wrapper path are stable. Replace only
  // the files it will read on the next launch: reloading launchd/schtasks from a
  // currently running updater could terminate this activation before commit.
  await atomicWriteFile(spec.policyPath, `${JSON.stringify(selectedPolicy, null, 2)}\n`, { mode: 0o644 });
  await atomicWriteFile(spec.wrapper, spec.wrapperContent, { mode: spec.scheduler === 'launchd' ? 0o755 : 0o644 });
  if (spec.plist) await atomicWriteFile(spec.plist, spec.plistContent, { mode: 0o644 });
  await fs.mkdir(spec.logDir, { recursive: true });
  const refreshed = await templateAutoUpdateAgentStatus(options);
  return { ...refreshed, command: 'refresh-agent', applied: true, changed: true, actions: actions(spec) };
}

export async function uninstallTemplateAutoUpdateAgent(options = {}) {
  const provisional = buildTemplateAutoUpdateAgentSpec(options), stored = await loadPolicy(provisional.policyPath, options);
  const spec = buildTemplateAutoUpdateAgentSpec({ ...options, policy: stored.value, policyPath: provisional.policyPath });
  const planned = [{ kind: spec.scheduler === 'launchd' ? 'launchctl.remove' : 'task-scheduler.remove', label: spec.label || spec.taskName || '' },
    { kind: 'remove', path: spec.policyPath }, ...(spec.wrapper ? [{ kind: 'remove', path: spec.wrapper }] : []), ...(spec.plist ? [{ kind: 'remove', path: spec.plist }] : [])];
  if (options.apply !== true) return { command: 'uninstall-agent', status: 'dry-run', applied: false, actions: planned };
  if (spec.scheduler === 'unsupported') {
    return { command: 'uninstall-agent', status: 'unsupported', applied: false, scheduler: spec.scheduler, actions: [] };
  }
  const run = options.runCapture || runCapture;
  const before = await registration(spec, run);
  if (!before.ok && !registrationDefinitelyAbsent(spec, before)) {
    return { command: 'uninstall-agent', status: 'blocked', applied: false, scheduler: spec.scheduler,
      reason: 'scheduler registration state could not be verified; policy and launcher files were preserved', actions: [] };
  }
  if (before.ok) {
    const removed = spec.scheduler === 'launchd'
      ? await run('launchctl', ['bootout', `gui/${process.getuid()}/${spec.label}`])
      : await run('schtasks.exe', ['/Delete', '/TN', spec.taskName, '/F']);
    if (!removed.ok) {
      return { command: 'uninstall-agent', status: 'blocked', applied: false, scheduler: spec.scheduler,
        reason: 'scheduler deregistration failed; policy and launcher files were preserved', actions: [] };
    }
    const stillRegistered = await registration(spec, run);
    if (stillRegistered.ok || !registrationDefinitelyAbsent(spec, stillRegistered)) {
      return { command: 'uninstall-agent', status: 'blocked', applied: false, scheduler: spec.scheduler,
        reason: stillRegistered.ok
          ? 'scheduler still reports the template auto-update job after deregistration; files were preserved'
          : 'scheduler deregistration could not be verified; files were preserved', actions: [] };
    }
  }
  for (const target of [spec.wrapper, spec.plist, spec.policyPath].filter(Boolean)) await fs.rm(target, { force: true });
  return { command: 'uninstall-agent', status: 'pass', applied: true, scheduler: spec.scheduler, actions: planned };
}
