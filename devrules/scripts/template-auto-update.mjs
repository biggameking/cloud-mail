#!/usr/bin/env node
import { renderTemplateAutoUpdateResult, runTemplateAutoUpdateCommand } from './devrules-lib/template-auto-update-command.mjs';

function parse(argv) {
  const options = { apply: false, json: false }, values = [...argv];
  const subcommand = values[0] && !values[0].startsWith('-') ? values.shift() : 'run';
  while (values.length) {
    const token = values.shift();
    if (token === '--apply') options.apply = true;
    else if (token === '--dry-run') options['dry-run'] = true;
    else if (token === '--json') options.json = true;
    else if (token === '--allow-major') options['allow-major'] = true;
    else if (token === '--reconcile-ownership') options['reconcile-ownership'] = true;
    else if (token === '--include-prerelease') options['include-prerelease'] = true;
    else if (token === '--device-opt-in') options['device-opt-in'] = true;
    else if (token === '--runtime-config') options['runtime-config'] = values.shift();
    else if (token === '--status-file') options['status-file'] = values.shift();
    else if (token === '--lock-file') options['lock-file'] = values.shift();
    else if (token === '--releases-dir') options['releases-dir'] = values.shift();
    else if (token === '--temporary-dir') options['temporary-dir'] = values.shift();
    else if (token === '--policy-file') options['policy-file'] = values.shift();
    else if (token === '--launcher-path') options['launcher-path'] = values.shift();
    else if (token === '--schedule') options.schedule = values.shift();
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return { subcommand, options };
}
function usage() { return `template-auto-update.mjs

Usage:
  node scripts/template-auto-update.mjs status [--json]
  node scripts/template-auto-update.mjs run [--apply] [--allow-major] [--reconcile-ownership] [--json]
  node scripts/template-auto-update.mjs agent-status [--json]
  node scripts/template-auto-update.mjs ensure-agent [--apply] [--allow-major] [--reconcile-ownership] [--json]
  node scripts/template-auto-update.mjs uninstall-agent [--apply] [--json]

Run defaults to dry-run. Major releases require --allow-major. Installing the
scheduler persists device opt-in; status and agent-status are read-only.`; }
async function main() {
  const { subcommand, options } = parse(process.argv.slice(2));
  if (options.help) { process.stdout.write(`${usage()}\n`); return; }
  const result = await runTemplateAutoUpdateCommand(subcommand, options, {});
  process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${renderTemplateAutoUpdateResult(result)}\n`);
  if (['failed', 'blocked', 'blocked-major', 'locked', 'invalid', 'opt-in-required'].includes(result.status)) process.exitCode = 1;
}
main().catch((error) => { process.stderr.write(`template-auto-update: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 2; });
