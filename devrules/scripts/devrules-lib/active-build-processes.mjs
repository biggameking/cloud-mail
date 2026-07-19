import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const LANES = ['rust', 'swift', 'gradle', 'xcode'];

function processName(item) {
  return path.basename(String(item.name || item.command || '')).toLowerCase();
}

function commandText(item) {
  return String(item.args || item.commandLine || '').toLowerCase();
}

function executableMatches(name, bases) {
  return bases.some((base) => name === base || name === `${base}.exe`);
}

export function classifyBuildProcesses(processes, currentPid = process.pid) {
  const lanes = Object.fromEntries(LANES.map((lane) => [lane, []]));
  for (const item of processes) {
    const pid = Number(item.pid || item.processId || 0);
    if (!pid || pid === currentPid) continue;
    const name = processName(item);
    const text = commandText(item);
    const summary = { pid, name: name || 'unknown' };

    if (
      executableMatches(name, ['cargo', 'rustc', 'rustdoc'])
      || /(?:^|[\\/"'\s])(?:cargo|rustc|rustdoc)(?:\.exe)?(?:\s|$)/.test(text)
    ) lanes.rust.push(summary);

    if (
      executableMatches(name, ['swift', 'swiftc', 'swift-build', 'swift-driver', 'swift-frontend'])
      || /(?:^|[\\/"'\s])(?:swift|swiftc|swift-build|swift-driver|swift-frontend)(?:\.exe)?(?:\s|$)/.test(text)
    ) lanes.swift.push(summary);

    if (
      executableMatches(name, ['gradle', 'gradlew'])
      || /(?:gradlewrappermain|gradledaemon|org\.gradle|[\\/]gradlew(?:\.bat)?(?:\s|$))/.test(text)
    ) lanes.gradle.push(summary);

    if (
      executableMatches(name, ['xcode', 'xcodebuild', 'xcbuild', 'xctest'])
      || /(?:^|[\\/"'\s])(?:xcodebuild|xcbuild|xctest)(?:\s|$)/.test(text)
    ) lanes.xcode.push(summary);
  }
  return Object.fromEntries(LANES.map((lane) => [lane, {
    active: lanes[lane].length > 0,
    count: lanes[lane].length,
    processes: lanes[lane],
  }]));
}

async function defaultRunCapture(command, args) {
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
    };
  }
}

function parseWindowsProcesses(stdout) {
  const parsed = JSON.parse(stdout || '[]');
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    pid: Number(item.ProcessId || 0),
    name: item.Name || '',
    commandLine: item.CommandLine || '',
  }));
}

function parsePosixProcesses(stdout) {
  const processes = [];
  for (const line of String(stdout || '').split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s*(.*)$/);
    if (match) processes.push({ pid: Number(match[1]), name: match[2], args: match[3] });
  }
  return processes;
}

export async function inspectBuildActivity({
  platform = process.platform,
  runCapture = defaultRunCapture,
  currentPid = process.pid,
} = {}) {
  let result;
  try {
    result = platform === 'win32'
      ? await runCapture('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress',
      ])
      : await runCapture('ps', ['-axo', 'pid=,comm=,args=']);
  } catch (error) {
    result = { ok: false, stderr: String(error.message || error) };
  }
  if (!result?.ok) {
    return {
      available: false,
      error: String(result?.stderr || 'process inventory unavailable').trim(),
      ...classifyBuildProcesses([], currentPid),
    };
  }
  try {
    const processes = platform === 'win32'
      ? parseWindowsProcesses(result.stdout)
      : parsePosixProcesses(result.stdout);
    return { available: true, error: '', ...classifyBuildProcesses(processes, currentPid) };
  } catch (error) {
    return {
      available: false,
      error: `process inventory parse failed: ${error.message}`,
      ...classifyBuildProcesses([], currentPid),
    };
  }
}

export function artifactCleanupGates(activity) {
  const unavailable = !activity.available;
  return {
    derivedData: unavailable || activity.xcode.active || activity.swift.active,
    rustTargets: unavailable || activity.rust.active,
    swiftBuilds: unavailable || activity.swift.active || activity.xcode.active,
    gradleBuilds: unavailable || activity.gradle.active,
  };
}

export function cleanupGateForAction(kind) {
  return {
    'derivedData.remove': 'derivedData',
    'rustTarget.remove': 'rustTargets',
    'swiftBuild.remove': 'swiftBuilds',
    'gradleBuild.remove': 'gradleBuilds',
  }[kind] || null;
}
