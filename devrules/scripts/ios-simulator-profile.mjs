#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { summarizeIosSimulatorProfile } from './devrules-lib/ios-simulator-profile.mjs';

function parseArgs(argv) {
  const options = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') options.profile = path.resolve(argv[++index]);
    else if (token === '--json') options.json = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function printHuman(summary, profilePath) {
  console.log(`iOS Simulator profile: ${summary.valid ? 'VALID' : 'INVALID'}`);
  console.log(`Profile: ${profilePath}`);
  if (summary.projectId) console.log(`Project: ${summary.projectId}`);
  if (summary.device) console.log(`Persistent device: ${summary.device.name} (${summary.device.runtime})`);
  if (summary.manualBundleId) console.log(`Manual app: ${summary.manualBundleId}`);
  if (summary.automationBundleId) console.log(`Automation app: ${summary.automationBundleId} (${summary.automationDestination})`);
  for (const issue of summary.issues) console.log(`Issue: ${issue.path}: ${issue.message}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node ios-simulator-profile.mjs --profile <ios-simulator-device-profile.json> [--json]');
    return;
  }
  if (!options.profile) throw new Error('--profile is required');
  const profile = JSON.parse(await fs.readFile(options.profile, 'utf8'));
  const summary = summarizeIosSimulatorProfile(profile);
  if (options.json) console.log(JSON.stringify({ profile: options.profile, ...summary }, null, 2));
  else printHuman(summary, options.profile);
  if (!summary.valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`iOS Simulator profile check failed: ${error.message}`);
  process.exitCode = 1;
});
