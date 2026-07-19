import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAC_AGENT_LABEL = 'com.devrules.idle-resource-maintenance';
const WINDOWS_TASK_NAME = 'devrules-idle-resource-maintenance';
const DEFAULT_SCHEDULE_TIME = '10:15';

async function runCapture(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || error.message || error),
      code: error.code,
    };
  }
}

function bashQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function powershellQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function commonArguments(policy) {
  return [
    '--idle-days', String(policy.idleDays),
    '--soft-booted-target', String(policy.softBootedSimulatorTarget),
    '--memory-pressure-free-warn-percent', String(policy.memoryPressureFreeWarnPercent),
    '--pressure-sample-count', String(policy.memoryPressureSampleCount),
    '--pressure-sample-interval-ms', String(policy.memoryPressureSampleIntervalMs),
    '--lease-heartbeat-ttl-minutes', String(policy.simulatorLeaseHeartbeatTtlMinutes),
  ];
}

function renderMacWrapper(options) {
  const common = commonArguments(options.policy).map(bashQuote).join(' ');
  return `#!/bin/bash
set -euo pipefail
export DEVELOPER_DIR="\${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
mkdir -p ${bashQuote(options.logDir)}
if [[ "$(/bin/date +%w)" == "0" ]]; then
  ${bashQuote(options.nodePath)} ${bashQuote(options.scriptPath)} apply --apply ${common} >> ${bashQuote(options.logPath)} 2>&1
else
  ${bashQuote(options.nodePath)} ${bashQuote(options.scriptPath)} pressure --apply ${common} >> ${bashQuote(options.logPath)} 2>&1
fi
`;
}

function renderMacPlist(options) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAC_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${xmlEscape(options.wrapper)}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>10</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(path.join(options.logDir, 'idle-resource-maintenance.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(path.join(options.logDir, 'idle-resource-maintenance.err.log'))}</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

function renderWindowsWrapper(options) {
  const common = commonArguments(options.policy).map(powershellQuote).join(', ');
  return `$ErrorActionPreference = 'Stop'
$logDirectory = ${powershellQuote(options.logDir)}
$logPath = ${powershellQuote(options.logPath)}
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$commonArguments = @(${common})
if ((Get-Date).DayOfWeek -eq [DayOfWeek]::Sunday) {
  $commandArguments = @('apply', '--apply') + $commonArguments
} else {
  $commandArguments = @('pressure', '--apply') + $commonArguments
}
& ${powershellQuote(options.nodePath)} ${powershellQuote(options.scriptPath)} @commandArguments >> $logPath 2>&1
exit $LASTEXITCODE
`;
}

export function buildDeviceAgentSpec(options) {
  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();
  const logDir = options.logDir || path.join(homeDir, '.config', 'devrules', 'logs');
  const base = {
    platform,
    homeDir,
    logDir,
    logPath: path.join(logDir, 'idle-resource-maintenance.jsonl'),
    scriptPath: path.resolve(options.scriptPath),
    nodePath: options.nodePath || process.execPath,
    policy: options.policy,
    scheduleTime: options.scheduleTime || DEFAULT_SCHEDULE_TIME,
  };
  if (platform === 'darwin') {
    const wrapper = path.join(homeDir, '.config', 'devrules', 'idle-resource-maintenance-agent.sh');
    const plist = path.join(homeDir, 'Library', 'LaunchAgents', `${MAC_AGENT_LABEL}.plist`);
    const spec = { ...base, scheduler: 'launchd', label: MAC_AGENT_LABEL, wrapper, plist };
    return {
      ...spec,
      wrapperContent: renderMacWrapper(spec),
      plistContent: renderMacPlist(spec),
      taskCommand: '',
    };
  }
  if (platform === 'win32') {
    const wrapper = path.join(homeDir, '.config', 'devrules', 'idle-resource-maintenance-agent.ps1');
    const taskCommand = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${wrapper.replaceAll('"', '""')}"`;
    const spec = { ...base, scheduler: 'task-scheduler', taskName: WINDOWS_TASK_NAME, wrapper, taskCommand };
    return {
      ...spec,
      wrapperContent: renderWindowsWrapper(spec),
      plist: '',
      plistContent: '',
    };
  }
  return {
    ...base,
    scheduler: 'project-fallback',
    wrapper: '',
    wrapperContent: '',
    plist: '',
    plistContent: '',
    taskCommand: '',
  };
}

async function fileMatches(filePath, expected) {
  if (!filePath) return false;
  try {
    return await fs.readFile(filePath, 'utf8') === expected;
  } catch {
    return false;
  }
}

async function schedulerRegistration(spec, run = runCapture) {
  if (spec.scheduler === 'launchd') {
    return run('launchctl', ['print', `gui/${process.getuid()}/${spec.label}`]);
  }
  if (spec.scheduler === 'task-scheduler') {
    return run('schtasks.exe', ['/Query', '/TN', spec.taskName, '/XML']);
  }
  return { ok: false, stdout: '', stderr: 'no supported device scheduler' };
}

export function windowsTaskConfigurationCurrent(spec, xml) {
  const normalized = String(xml || '').replaceAll('\0', '').toLowerCase();
  const expected = [
    `t${spec.scheduleTime}:`,
    '<schedulebyday>',
    '<daysinterval>1</daysinterval>',
    '<command>powershell.exe</command>',
    '-noprofile',
    '-noninteractive',
    '-windowstyle hidden',
    '-executionpolicy bypass',
    xmlEscape(spec.wrapper).toLowerCase(),
  ];
  return expected.every((value) => normalized.includes(value));
}

export async function deviceAgentStatus(options) {
  const spec = buildDeviceAgentSpec(options);
  if (spec.scheduler === 'project-fallback') {
    return {
      installed: false,
      loaded: false,
      registered: false,
      configurationCurrent: false,
      healthy: false,
      scheduler: spec.scheduler,
      wrapper: '',
      plist: '',
      reason: 'No device scheduler is supported on this platform; project Agents must invoke maintenance.',
    };
  }
  const wrapperCurrent = await fileMatches(spec.wrapper, spec.wrapperContent);
  const plistCurrent = spec.scheduler === 'launchd'
    ? await fileMatches(spec.plist, spec.plistContent)
    : true;
  const registration = await schedulerRegistration(spec, options.runCapture || runCapture);
  const installed = wrapperCurrent || await fs.stat(spec.wrapper).then(() => true).catch(() => false);
  const registered = registration.ok;
  const schedulerCurrent = registered && (spec.scheduler !== 'task-scheduler'
    || windowsTaskConfigurationCurrent(spec, registration.stdout));
  const configurationCurrent = wrapperCurrent && plistCurrent && schedulerCurrent;
  const enabled = registered && (spec.scheduler !== 'task-scheduler'
    || !/<Enabled>\s*false\s*<\/Enabled>/i.test(registration.stdout.replaceAll('\0', '')));
  return {
    installed,
    loaded: registered,
    registered,
    enabled,
    schedulerConfigurationCurrent: schedulerCurrent,
    configurationCurrent,
    healthy: installed && registered && enabled && configurationCurrent,
    scheduler: spec.scheduler,
    label: spec.label || '',
    taskName: spec.taskName || '',
    wrapper: spec.wrapper,
    plist: spec.plist,
    registrationDetail: registration.ok ? (enabled ? 'registered and enabled' : 'registered but disabled') : registration.stderr.trim(),
  };
}

function plannedActions(spec) {
  const actions = [{ kind: 'write', path: spec.wrapper }];
  if (spec.plist) actions.push({ kind: 'write', path: spec.plist });
  actions.push({
    kind: spec.scheduler === 'launchd' ? 'launchctl' : 'task-scheduler',
    label: spec.label || spec.taskName,
  });
  return actions;
}

export async function installDeviceAgent(options) {
  const spec = buildDeviceAgentSpec(options);
  const run = options.runCapture || runCapture;
  if (spec.scheduler === 'project-fallback') {
    return {
      command: 'install-agent',
      status: 'skipped',
      scheduler: spec.scheduler,
      reason: 'Device scheduling is unsupported; keep the project fallback active.',
    };
  }
  const actions = plannedActions(spec);
  if (options.apply !== true) {
    return {
      command: 'install-agent',
      status: 'dry-run',
      scheduler: spec.scheduler,
      actions,
      wrapper: spec.wrapper,
      plist: spec.plist,
      taskName: spec.taskName || '',
    };
  }
  await fs.mkdir(path.dirname(spec.wrapper), { recursive: true });
  await fs.mkdir(spec.logDir, { recursive: true });
  await fs.writeFile(spec.wrapper, spec.wrapperContent, { encoding: 'utf8', mode: 0o755 });
  if (spec.scheduler === 'launchd') {
    await fs.chmod(spec.wrapper, 0o755);
    await fs.mkdir(path.dirname(spec.plist), { recursive: true });
    await fs.writeFile(spec.plist, spec.plistContent, 'utf8');
    await run('launchctl', ['bootout', `gui/${process.getuid()}/${spec.label}`]);
    await run('launchctl', ['bootstrap', `gui/${process.getuid()}`, spec.plist]);
  } else {
    await run('schtasks.exe', [
      '/Create',
      '/TN', spec.taskName,
      '/SC', 'DAILY',
      '/ST', spec.scheduleTime,
      '/TR', spec.taskCommand,
      '/F',
    ]);
  }
  const status = await deviceAgentStatus(options);
  return {
    command: 'install-agent',
    status: status.healthy ? 'pass' : 'fail',
    applied: true,
    ...status,
  };
}

export async function ensureDeviceAgent(options) {
  const current = await deviceAgentStatus(options);
  if (current.healthy) {
    return {
      command: 'ensure-agent',
      status: 'pass',
      applied: false,
      changed: false,
      repairAttempted: false,
      requiresApply: false,
      ...current,
    };
  }
  if (options.apply !== true) {
    const planned = await installDeviceAgent({ ...options, apply: false });
    return {
      ...planned,
      ...current,
      command: 'ensure-agent',
      status: planned.status,
      applied: false,
      changed: false,
      repairAttempted: false,
      requiresApply: true,
    };
  }
  const installed = await installDeviceAgent(options);
  return {
    ...installed,
    command: 'ensure-agent',
    changed: installed.applied === true && installed.healthy === true,
    repairAttempted: true,
    requiresApply: false,
  };
}

export async function uninstallDeviceAgent(options) {
  const spec = buildDeviceAgentSpec(options);
  const run = options.runCapture || runCapture;
  if (spec.scheduler === 'project-fallback') {
    return { command: 'uninstall-agent', status: 'skipped', scheduler: spec.scheduler };
  }
  const actions = [
    { kind: spec.scheduler === 'launchd' ? 'launchctl.remove' : 'task-scheduler.remove', label: spec.label || spec.taskName },
    { kind: 'remove', path: spec.wrapper },
    ...(spec.plist ? [{ kind: 'remove', path: spec.plist }] : []),
  ];
  if (options.apply !== true) return { command: 'uninstall-agent', status: 'dry-run', scheduler: spec.scheduler, actions };
  if (spec.scheduler === 'launchd') {
    await run('launchctl', ['bootout', `gui/${process.getuid()}/${spec.label}`]);
  } else {
    await run('schtasks.exe', ['/Delete', '/TN', spec.taskName, '/F']);
  }
  await fs.rm(spec.wrapper, { force: true });
  if (spec.plist) await fs.rm(spec.plist, { force: true });
  return { command: 'uninstall-agent', status: 'pass', scheduler: spec.scheduler, applied: true, actions };
}
