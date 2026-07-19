#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildTemplateAutoUpdateAgentSpec,
  ensureTemplateAutoUpdateAgent,
  refreshInstalledTemplateAutoUpdateAgent,
  templateAutoUpdateWindowsTaskCurrent,
  templateAutoUpdateAgentStatus,
  uninstallTemplateAutoUpdateAgent,
} from './devrules-lib/template-auto-update-agent.mjs';

async function exists(filePath) { return fs.stat(filePath).then(() => true).catch(() => false); }

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-template-auto-update-agent-selftest-'));
  try {
    const schedulerCalls = [];
    const options = {
      platform: 'darwin',
      homeDir: path.join(root, 'home'),
      launcherPath: path.join(root, 'bin', 'devrules'),
      runCapture: async (command, args) => {
        schedulerCalls.push([command, ...args]);
        return { ok: true, stdout: `arguments = { /bin/bash ${path.join(root, 'home/.config/devrules/template-auto-update-agent.sh')} }\n"Hour" => 11\n"Minute" => 35\n`, stderr: '' };
      },
    };
    const missingLauncher = await ensureTemplateAutoUpdateAgent({ ...options, apply: true });
    assert.equal(missingLauncher.status, 'blocked');
    assert.match(missingLauncher.reason, /install-launcher/);
    assert.equal(await exists(path.join(options.homeDir, '.config/devrules/template-auto-update-policy.json')), false);
    const absentRefresh = await refreshInstalledTemplateAutoUpdateAgent(options);
    assert.equal(absentRefresh.status, 'skipped');
    assert.equal(absentRefresh.installed, false);
    await fs.mkdir(path.dirname(options.launcherPath), { recursive: true });
    await fs.writeFile(options.launcherPath, '#!/bin/sh\n', { mode: 0o755 });
    const dryRun = await ensureTemplateAutoUpdateAgent(options);
    assert.equal(dryRun.status, 'dry-run');
    assert.equal(await exists(path.join(options.homeDir, '.config/devrules/template-auto-update-policy.json')), false);
    const installed = await ensureTemplateAutoUpdateAgent({ ...options, apply: true, reconcileOwnership: true });
    assert.equal(installed.status, 'pass');
    assert.equal(installed.allowMajor, false);
    assert.equal(installed.reconcileOwnership, true);
    assert.equal(installed.launcherAvailable, true);
    const wrapper = await fs.readFile(installed.wrapper, 'utf8');
    assert.equal(wrapper.includes(`'${process.execPath}' '${options.launcherPath}'`), true, 'launchd wrapper must use an absolute Node executable');
    assert.match(wrapper, /run' '--apply' '--device-opt-in'/);
    assert.doesNotMatch(wrapper, /--allow-major/);
    assert.match(wrapper, /--reconcile-ownership/);
    const windows = buildTemplateAutoUpdateAgentSpec({ ...options, platform: 'win32', nodePath: 'C:\\Node\\node.exe' });
    assert.match(windows.wrapperContent, /C:\\Node\\node\.exe.*devrules/);
    const windowsTaskXml = `<Task><Triggers><CalendarTrigger><StartBoundary>2026-01-01T11:35:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger></Triggers><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>powershell.exe</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File &quot;${windows.wrapper}&quot;</Arguments></Exec></Actions></Task>`;
    assert.equal(templateAutoUpdateWindowsTaskCurrent(windows, windowsTaskXml), true);
    assert.equal(templateAutoUpdateWindowsTaskCurrent(windows,
      windowsTaskXml.replace('<Enabled>true</Enabled>', '<Enabled>false</Enabled>')), false,
    'a disabled scheduled task is never healthy');
    assert.equal(templateAutoUpdateWindowsTaskCurrent(windows,
      windowsTaskXml.replace('<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>', '<ScheduleByWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>')), false,
    'a non-daily trigger is never healthy');
    assert.equal(templateAutoUpdateWindowsTaskCurrent(windows,
      windowsTaskXml.replace('<Command>powershell.exe</Command>', '<Command>cmd.exe</Command>')), false,
    'a task with the wrong executable is never healthy');
    assert.equal(templateAutoUpdateWindowsTaskCurrent(windows,
      windowsTaskXml.replace('-ExecutionPolicy Bypass', '-ExecutionPolicy Restricted')), false,
    'a task with incomplete PowerShell arguments is never healthy');
    assert.equal((await templateAutoUpdateAgentStatus(options)).healthy, true);
    const staleRegistration = await templateAutoUpdateAgentStatus({
      ...options,
      runCapture: async () => ({ ok: true, stdout: `arguments = { /bin/bash ${installed.wrapper} }\n"Hour" => 12\n"Minute" => 35\n`, stderr: '' }),
    });
    assert.equal(staleRegistration.registrationCurrent, false);
    assert.equal(staleRegistration.healthy, false, 'a stale loaded schedule must not pass agent health');
    assert.equal(await fs.readFile(installed.wrapper, 'utf8'), wrapper, 'agent-status is read-only');
    const unchanged = await ensureTemplateAutoUpdateAgent({ ...options, apply: true, reconcileOwnership: true });
    assert.equal(unchanged.applied, false);
    assert.equal(unchanged.changed, false);
    assert.deepEqual(unchanged.actions, []);
    await fs.writeFile(installed.wrapper, '#!/bin/bash\nexit 99\n');
    schedulerCalls.length = 0;
    const refreshed = await refreshInstalledTemplateAutoUpdateAgent(options);
    assert.equal(refreshed.status, 'pass');
    assert.equal(refreshed.reconcileOwnership, true, 'agent refresh must preserve the stored opt-in policy');
    assert.equal(refreshed.allowMajor, false);
    assert.equal(refreshed.schedule, '11:35');
    assert.equal(await fs.readFile(installed.wrapper, 'utf8'), wrapper, 'agent refresh must restore the current release wrapper');
    assert.equal(
      schedulerCalls.some((call) => call.includes('bootout') || call.includes('bootstrap') || call.includes('/Create')),
      false,
      'in-process refresh must never reload or terminate the scheduler that may be running it',
    );
    const unhealthyOptions = {
      platform: 'darwin',
      homeDir: path.join(root, 'unhealthy-home'),
      launcherPath: path.join(root, 'unhealthy-bin', 'devrules'),
      runCapture: async (command, args) => args.includes('bootstrap')
        ? { ok: true, stdout: '', stderr: '' }
        : { ok: false, stdout: '', stderr: 'scheduler not registered' },
    };
    await fs.mkdir(path.dirname(unhealthyOptions.launcherPath), { recursive: true });
    await fs.writeFile(unhealthyOptions.launcherPath, '#!/bin/sh\n', { mode: 0o755 });
    const unhealthyInstall = await ensureTemplateAutoUpdateAgent({ ...unhealthyOptions, apply: true });
    assert.equal(unhealthyInstall.status, 'blocked');
    assert.equal(unhealthyInstall.applied, true);
    assert.match(unhealthyInstall.reason, /registration did not match/,
      'a scheduler command that returns success but fails postflight must not report installation success');
    assert.equal((await uninstallTemplateAutoUpdateAgent(options)).status, 'dry-run');
    assert.equal(await exists(installed.wrapper), true);
    const ambiguousRemoval = await uninstallTemplateAutoUpdateAgent({
      ...options,
      apply: true,
      runCapture: async () => ({ ok: false, stdout: '', stderr: 'fixture permission denied' }),
    });
    assert.equal(ambiguousRemoval.status, 'blocked');
    assert.match(ambiguousRemoval.reason, /could not be verified/);
    assert.equal(await exists(installed.wrapper), true, 'ambiguous scheduler query failure must preserve device files');
    const failedRemoval = await uninstallTemplateAutoUpdateAgent({
      ...options,
      apply: true,
      runCapture: async (command, args) => args.includes('bootout')
        ? { ok: false, stdout: '', stderr: 'fixture deregistration failure' }
        : { ok: true, stdout: 'registered', stderr: '' },
    });
    assert.equal(failedRemoval.status, 'blocked');
    assert.equal(await exists(installed.wrapper), true, 'failed scheduler removal must preserve the wrapper and policy');
    let registered = true;
    const removed = await uninstallTemplateAutoUpdateAgent({
      ...options,
      apply: true,
      runCapture: async (command, args) => {
        if (args.includes('bootout')) { registered = false; return { ok: true, stdout: '', stderr: '' }; }
        return { ok: registered, stdout: registered ? 'registered' : '', stderr: registered ? '' : 'not found' };
      },
    });
    assert.equal(removed.status, 'pass');
    assert.equal(await exists(installed.wrapper), false);
    assert.equal(await exists(installed.policyPath), false);
    process.stdout.write('template-auto-update-agent selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { process.stderr.write(`template-auto-update-agent selftest: FAIL\n${error.stack || error.message}\n`); process.exitCode = 1; });
