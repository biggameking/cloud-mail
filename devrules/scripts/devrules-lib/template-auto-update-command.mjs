import { isApply } from './cli-io.mjs';
import { ensureTemplateAutoUpdateAgent, templateAutoUpdateAgentStatus, uninstallTemplateAutoUpdateAgent } from './template-auto-update-agent.mjs';
import { readTemplateAutoUpdateStatus, runTemplateAutoUpdate } from './template-auto-update-core.mjs';

function value(options, camel, dashed = camel) { return options[camel] ?? options[dashed]; }
function common(options, context) {
  return { env: context.env, platform: context.platform, homeDir: context.homeDir, cwd: context.cwd,
    runtimeLocation: context.runtimeLocation, fallbackTemplateRoot: context.templateRoot,
    runtimeConfigPath: value(options, 'runtimeConfigPath', 'runtime-config'), statusPath: value(options, 'statusPath', 'status-file'),
    lockPath: value(options, 'lockPath', 'lock-file'), releasesDirectory: value(options, 'releasesDirectory', 'releases-dir'),
    temporaryDirectory: value(options, 'temporaryDirectory', 'temporary-dir'), allowMajor: value(options, 'allowMajor', 'allow-major') === true,
    reconcileOwnership: value(options, 'reconcileOwnership', 'reconcile-ownership') === true,
    includePrerelease: value(options, 'includePrerelease', 'include-prerelease') === true };
}
function agentOptions(options, context) {
  return { env: context.env, platform: context.platform, homeDir: context.homeDir, apply: isApply(options),
    allowMajor: value(options, 'allowMajor', 'allow-major') === true, schedule: options.schedule,
    reconcileOwnership: value(options, 'reconcileOwnership', 'reconcile-ownership') === true,
    launcherPath: value(options, 'launcherPath', 'launcher-path'), policyPath: value(options, 'policyPath', 'policy-file') };
}

export async function runTemplateAutoUpdateCommand(subcommand, options = {}, context = {}) {
  if (subcommand === 'status') return readTemplateAutoUpdateStatus(common(options, context));
  if (subcommand === 'agent-status') return templateAutoUpdateAgentStatus(agentOptions(options, context));
  if (subcommand === 'ensure-agent') return ensureTemplateAutoUpdateAgent(agentOptions(options, context));
  if (subcommand === 'uninstall-agent') return uninstallTemplateAutoUpdateAgent(agentOptions(options, context));
  if (subcommand !== 'run') throw new Error(`Unknown template auto-update command: ${subcommand}`);
  const scheduled = value(options, 'deviceOptIn', 'device-opt-in') === true;
  const agent = scheduled ? await templateAutoUpdateAgentStatus(agentOptions(options, context)) : null;
  return runTemplateAutoUpdate({ ...common(options, context), apply: isApply(options), invocation: scheduled ? 'agent' : 'manual',
    deviceOptIn: scheduled && agent?.healthy === true,
    allowMajor: scheduled ? agent?.allowMajor === true : value(options, 'allowMajor', 'allow-major') === true,
    reconcileOwnership: scheduled ? agent?.reconcileOwnership === true : value(options, 'reconcileOwnership', 'reconcile-ownership') === true });
}

export function renderTemplateAutoUpdateResult(result) {
  if (['agent-status', 'ensure-agent', 'uninstall-agent'].includes(result.command)) return [
    `Template auto-update agent: ${String(result.status || 'unknown').toUpperCase()}`,
    `Scheduler: ${result.scheduler || 'unknown'}`,
    result.launcherPath ? `Launcher: ${result.launcherPath} (${result.launcherAvailable ? 'available' : 'unavailable'})` : '',
    `Installed: ${result.installed ? 'yes' : 'no'}`,
    `Healthy: ${result.healthy ? 'yes' : 'no'}`,
    `Allow major: ${result.allowMajor ? 'yes' : 'no'}`,
    `Reconcile ownership: ${result.reconcileOwnership ? 'yes' : 'no'}`,
    result.reason || '',
  ].filter(Boolean).join('\n');
  const lines = [`Template auto-update: ${String(result.status || 'unknown').toUpperCase()}`];
  if (result.releases?.current) lines.push(`Current: v${result.releases.current.version} r${result.releases.current.revision}`);
  if (result.releases?.candidate) lines.push(`Candidate: v${result.releases.candidate.version} r${result.releases.candidate.revision}`);
  if (result.projects) lines.push(`Projects: discovered=${result.projects.discoveredCount || 0}, applied=${result.projects.appliedCount || 0}, current=${result.projects.currentCount || 0}, unchecked=${result.projects.uncheckedCount || 0}, deferred=${result.projects.deferredCount || 0}, partial=${result.projects.partialAppliedCount || 0}`);
  if (result.reason) lines.push(result.reason);
  return lines.join('\n');
}
