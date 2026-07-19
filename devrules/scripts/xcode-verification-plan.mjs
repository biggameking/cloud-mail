#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const options = { tests: [], tier: 'focused', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--project') options.project = argv[++index];
    else if (token === '--workspace') options.workspace = argv[++index];
    else if (token === '--scheme') options.scheme = argv[++index];
    else if (token === '--udid') options.udid = argv[++index];
    else if (token === '--derived-data') options.derivedData = argv[++index];
    else if (token === '--tier') options.tier = argv[++index];
    else if (token === '--only-testing') options.tests.push(argv[++index]);
    else if (token === '--json') options.json = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function validate(options) {
  if (Boolean(options.project) === Boolean(options.workspace)) throw new Error('Provide exactly one of --project or --workspace');
  for (const key of ['scheme', 'udid', 'derivedData']) {
    if (!options[key]) throw new Error(`--${key === 'derivedData' ? 'derived-data' : key} is required`);
  }
  if (!['low', 'focused', 'broad'].includes(options.tier)) throw new Error('--tier must be low, focused, or broad');
  if (options.tier === 'focused' && options.tests.length === 0) throw new Error('focused tier requires at least one --only-testing target');
  if (!/^[A-F0-9-]{8,}$/i.test(options.udid)) throw new Error('--udid must be an explicit Simulator UDID');
}

function shellQuote(value) {
  const text = String(value);
  return /^[A-Za-z0-9_./:=-]+$/.test(text) ? text : `'${text.replaceAll("'", "'\\''")}'`;
}

function command(args) {
  return args.map(shellQuote).join(' ');
}

function buildPlan(options) {
  const container = options.project ? ['-project', options.project] : ['-workspace', options.workspace];
  const common = [
    'xcodebuild',
    ...container,
    '-scheme', options.scheme,
    '-destination', `platform=iOS Simulator,id=${options.udid}`,
    '-derivedDataPath', path.resolve(options.derivedData),
  ];
  const testArgs = options.tests.flatMap((test) => [`-only-testing:${test}`]);
  return {
    tier: options.tier,
    destinationUdid: options.udid,
    derivedDataPath: path.resolve(options.derivedData),
    preflight: [
      command(['xcrun', 'simctl', 'list', 'devices', options.udid]),
      `Confirm ${options.udid} is Booted; boot only this device if needed, then run ${command(['xcrun', 'simctl', 'bootstatus', options.udid, '-b'])}`,
    ],
    build: options.tier === 'low' ? [] : [command([...common, 'build-for-testing'])],
    test: options.tier === 'low' ? [] : [command([...common, 'test-without-building', ...testArgs])],
    notes: [
      'Reuse the same DerivedData path for retries and additional focused suites.',
      'Run UI tests only with Simulator foreground ownership.',
    ],
  };
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log('Usage: node xcode-verification-plan.mjs (--project <path>|--workspace <path>) --scheme <name> --udid <UDID> --derived-data <path> --tier low|focused|broad [--only-testing <target> ...] [--json]');
} else {
  validate(options);
  const plan = buildPlan(options);
  if (options.json) console.log(JSON.stringify(plan, null, 2));
  else {
    console.log(`Xcode verification tier: ${plan.tier}`);
    for (const item of plan.preflight) console.log(`Preflight: ${item}`);
    for (const item of plan.build) console.log(`Build once: ${item}`);
    for (const item of plan.test) console.log(`Test with build reuse: ${item}`);
    for (const item of plan.notes) console.log(`Note: ${item}`);
  }
}
