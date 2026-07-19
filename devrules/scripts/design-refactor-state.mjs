#!/usr/bin/env node
// Validate UI refactor execution state.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MODES = new Set(['incremental', 'hybrid', 'full_redesign']);
const PHASES = [
  'phase_00',
  'phase_01',
  'phase_02',
  'phase_03',
  'phase_04',
  'phase_05',
  'phase_06',
  'phase_07',
  'phase_08',
];

const DEFAULT_ARTIFACTS = {
  phase_00: [
    'docs/ui-refactor/repository-intake.md',
    'docs/ui-refactor/screen-inventory.md',
    'docs/ui-refactor/component-inventory.md',
  ],
  phase_01: ['docs/ui-refactor/design-debt-report.md'],
  phase_02: ['DESIGN.md'],
  phase_03: ['docs/ui-refactor/component-inventory.md', 'docs/ui-refactor/base-component-plan.md'],
  phase_04: ['docs/ui-refactor/screen-specs'],
  phase_05: ['docs/ui-refactor/secondary-screen-standardization.md'],
  phase_06: ['docs/ui-refactor/state-coverage-report.md'],
  phase_07: ['docs/ui-refactor/qa-report.md'],
  phase_08: ['docs/ui-refactor/final-ui-refactor-report.md', 'docs/ui-refactor/handoff-notes.md'],
};

main().catch((err) => {
  console.error(`[design-refactor-state] ${err.message}`);
  process.exit(1);
});

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }
  const statePath = values.state ? path.resolve(values.state) : path.resolve('docs/ui-refactor/design-refactor-state.json');
  const root = path.resolve(values.root || process.cwd());
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  const result = validateState(state, { root, checkFiles: !!flags['check-files'] });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  if (result.errors.length) process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (['json', 'help', 'check-files'].includes(key)) {
      flags[key] = true;
      continue;
    }
    values[key] = argv[i + 1];
    i += 1;
  }
  return { flags, values };
}

function printHelp() {
  console.log(`design-refactor-state

Usage:
  node devrules/scripts/design-refactor-state.mjs --state docs/ui-refactor/design-refactor-state.json
  node devrules/scripts/design-refactor-state.mjs --state docs/ui-refactor/design-refactor-state.json --check-files

Validates mode, phase order, blocked/risks shape, protected paths, and required phase artifacts.`);
}

function validateState(state, { root, checkFiles }) {
  const errors = [];
  const warnings = [];
  const required = ['project_name', 'mode', 'current_phase', 'completed_phases', 'blocked', 'risks'];

  for (const key of required) {
    if (!(key in state)) errors.push(`Missing required field: ${key}`);
  }

  if (!MODES.has(state.mode)) errors.push(`Invalid mode: ${state.mode}`);
  if (!PHASES.includes(state.current_phase)) errors.push(`Invalid current_phase: ${state.current_phase}`);
  if (!Array.isArray(state.completed_phases)) errors.push('completed_phases must be an array');
  if (typeof state.blocked !== 'boolean') errors.push('blocked must be boolean');
  if (!Array.isArray(state.risks)) errors.push('risks must be an array');

  const currentIndex = PHASES.indexOf(state.current_phase);
  for (const phase of state.completed_phases || []) {
    if (!PHASES.includes(phase)) {
      errors.push(`Unknown completed phase: ${phase}`);
      continue;
    }
    if (PHASES.indexOf(phase) > currentIndex) {
      errors.push(`Completed phase ${phase} is after current_phase ${state.current_phase}`);
    }
  }

  if (state.blocked && (!Array.isArray(state.blockers) || state.blockers.length === 0)) {
    errors.push('blocked=true requires non-empty blockers');
  }

  if (!Array.isArray(state.protected_paths) || state.protected_paths.length === 0) {
    warnings.push('protected_paths is empty; UI refactor should declare protected business/API/data boundaries');
  }

  const artifactMap = state.artifacts && typeof state.artifacts === 'object' ? state.artifacts : {};
  for (const phase of state.completed_phases || []) {
    const artifacts = artifactMap[phase] || DEFAULT_ARTIFACTS[phase] || [];
    if (!artifacts.length) {
      warnings.push(`No artifacts declared for completed ${phase}`);
      continue;
    }
    for (const rel of artifacts) {
      if (typeof rel !== 'string' || !rel.trim()) {
        errors.push(`Invalid artifact path in ${phase}`);
        continue;
      }
      if (checkFiles && !existsSync(path.join(root, rel))) {
        errors.push(`Missing artifact for ${phase}: ${rel}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    mode: state.mode,
    current_phase: state.current_phase,
    completed_phases: state.completed_phases || [],
    errors,
    warnings,
  };
}

function printResult(result) {
  if (result.valid) {
    console.log(`[design-refactor-state] OK mode=${result.mode} current=${result.current_phase} completed=${result.completed_phases.length}`);
  } else {
    console.log('[design-refactor-state] invalid');
  }
  for (const warning of result.warnings) console.log(`warning: ${warning}`);
  for (const error of result.errors) console.error(`error: ${error}`);
}
