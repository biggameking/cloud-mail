#!/usr/bin/env node
// Minimal deterministic self-test for i18n-maintenance.mjs. Verifies the
// scan -> approve -> diff -> plan -> validate loop, the dry-run default, and
// the report-only write scope on a temporary fixture repository.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'i18n-maintenance.mjs');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-i18n-'));

const run = (args) => execFileSync(process.execPath, [script, ...args, '--repo', temp, '--json'], { encoding: 'utf8' });

try {
  await fs.mkdir(path.join(temp, 'src'), { recursive: true });
  await fs.mkdir(path.join(temp, 'locales'), { recursive: true });
  await fs.mkdir(path.join(temp, 'devrules'), { recursive: true });
  await fs.writeFile(path.join(temp, 'devrules', 'config.json'), `${JSON.stringify({
    schemaVersion: 1,
    i18n: {
      sourceLocale: 'en',
      requiredLocales: ['en', 'zh'],
      sourceRoots: ['src'],
    },
  }, null, 2)}\n`);
  await fs.writeFile(
    path.join(temp, 'src', 'app.tsx'),
    'export const title = "Welcome to the dashboard";\nexport const cta = "Start your free trial now";\n',
  );
  await fs.writeFile(path.join(temp, 'locales', 'en.json'), `${JSON.stringify({ title: 'Welcome to the dashboard' }, null, 2)}\n`);
  await fs.writeFile(path.join(temp, 'locales', 'zh.json'), `${JSON.stringify({ title: '\u6b22\u8fce' }, null, 2)}\n`);

  // Dry-run scan must not create the report directory.
  const dryScan = JSON.parse(run(['scan']));
  assert.equal(dryScan.mode, 'dry-run', 'scan without --apply must be a dry-run');
  assert(dryScan.units.total > 0, 'scan must find source units in src/');
  let reportsExist = true;
  try {
    await fs.access(path.join(temp, 'devrules', 'reports', 'i18n', 'source-units.json'));
  } catch {
    reportsExist = false;
  }
  assert.equal(reportsExist, false, 'dry-run scan must not write reports');

  // Applied scan writes only under the configured report directory.
  const appliedScan = JSON.parse(run(['scan', '--apply']));
  assert.equal(appliedScan.mode, 'apply');
  const generated = JSON.parse(await fs.readFile(path.join(temp, 'devrules', 'reports', 'i18n', 'source-units.json'), 'utf8'));
  assert(Array.isArray(generated.units) && generated.units.length > 0, 'applied scan must persist source units');

  // approve records the current inventory as the reviewed baseline.
  JSON.parse(run(['approve', '--apply']));
  await fs.access(path.join(temp, 'devrules', 'reports', 'i18n', 'source-units.approved.json'));

  // A new copy string must surface through diff and plan.
  await fs.appendFile(path.join(temp, 'src', 'app.tsx'), 'export const bye = "See you next time";\n');
  JSON.parse(run(['scan', '--apply']));
  const diff = JSON.parse(run(['diff']));
  assert(diff.summary.added > 0, 'diff must report the newly added source unit');
  const plan = JSON.parse(run(['plan', '--apply']));
  assert(plan.jobs.jobs > 0, 'plan must produce translation jobs for the missing locale coverage');
  await fs.access(path.join(temp, 'devrules', 'reports', 'i18n', 'translation-jobs.json'));

  // validate reports missing zh coverage without mutating product files.
  const sourceBefore = await fs.readFile(path.join(temp, 'src', 'app.tsx'), 'utf8');
  const localeBefore = await fs.readFile(path.join(temp, 'locales', 'zh.json'), 'utf8');
  const validation = JSON.parse(run(['validate', '--apply']));
  assert(validation.summary, 'validate must return a summary');
  assert.equal(await fs.readFile(path.join(temp, 'src', 'app.tsx'), 'utf8'), sourceBefore, 'validate must not rewrite product source');
  assert.equal(await fs.readFile(path.join(temp, 'locales', 'zh.json'), 'utf8'), localeBefore, 'validate must not rewrite locale resources');

  console.log('i18n maintenance selftest: PASS');
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

// Resource parser coverage: drive the four locale-resource formats through
// `scan --apply` on a dedicated fixture repo and assert extracted keys/values.
const parserTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-i18n-parsers-'));
try {
  const runParsers = (args) => execFileSync(process.execPath, [script, ...args, '--repo', parserTemp, '--json'], { encoding: 'utf8' });
  await fs.mkdir(path.join(parserTemp, 'devrules'), { recursive: true });
  await fs.writeFile(path.join(parserTemp, 'devrules', 'config.json'), `${JSON.stringify({
    schemaVersion: 1,
    i18n: {
      sourceLocale: 'en',
      requiredLocales: ['en', 'zh'],
      sourceRoots: ['src'],
      resourceFiles: [
        '**/*.xcstrings',
        '**/*.strings',
        'locales/**/*.json',
        '**/values*/strings.xml',
      ],
    },
  }, null, 2)}\n`);
  await fs.mkdir(path.join(parserTemp, 'src'), { recursive: true });
  await fs.writeFile(path.join(parserTemp, 'src', 'app.tsx'), 'export const noop = 1;\n');

  await fs.writeFile(path.join(parserTemp, 'Catalog.xcstrings'), `${JSON.stringify({
    sourceLanguage: 'en',
    strings: {
      'cart.checkout': {
        comment: 'checkout CTA',
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Proceed to checkout' } },
          zh: { stringUnit: { state: 'translated', value: '\u53bb\u7ed3\u8d26' } },
        },
      },
    },
  }, null, 2)}\n`);

  await fs.mkdir(path.join(parserTemp, 'en.lproj'), { recursive: true });
  await fs.writeFile(
    path.join(parserTemp, 'en.lproj', 'Localizable.strings'),
    '/* greeting */\n"greeting.title" = "Hello \\"World\\"";\n"greeting.subtitle" = "Nice to meet you";\n',
  );

  await fs.mkdir(path.join(parserTemp, 'locales'), { recursive: true });
  await fs.writeFile(path.join(parserTemp, 'locales', 'en.json'), `${JSON.stringify({
    menu: { file: { open: 'Open a recent file' } },
    plain: 'Plain top-level entry',
  }, null, 2)}\n`);

  await fs.mkdir(path.join(parserTemp, 'res', 'values'), { recursive: true });
  await fs.writeFile(
    path.join(parserTemp, 'res', 'values', 'strings.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="promo_banner">Save <b>20 percent</b> today</string>\n</resources>\n',
  );

  const scan = JSON.parse(runParsers(['scan', '--apply']));
  assert.equal(scan.mode, 'apply');
  const inventory = JSON.parse(await fs.readFile(path.join(parserTemp, 'devrules', 'reports', 'i18n', 'source-units.json'), 'utf8'));
  const resourceUnits = inventory.units.filter((unit) => unit.origin === 'resource');
  const byId = new Map(resourceUnits.map((unit) => [unit.id, unit]));

  const xcstrings = byId.get('cart.checkout');
  assert(xcstrings, 'xcstrings parser must extract cart.checkout');
  assert.equal(xcstrings.text, 'Proceed to checkout', 'xcstrings must pick the sourceLocale value');
  assert.equal(xcstrings.sourcePath, 'Catalog.xcstrings');
  assert.equal(xcstrings.context, 'checkout CTA', 'xcstrings comment must surface as unit context');

  const appleEscaped = byId.get('greeting.title');
  assert(appleEscaped, 'Apple .strings parser must extract greeting.title');
  assert.equal(appleEscaped.text, 'Hello "World"', '.strings escaped quotes must decode');
  assert.equal(byId.get('greeting.subtitle')?.text, 'Nice to meet you');
  assert.equal(appleEscaped.sourcePath, 'en.lproj/Localizable.strings');

  const nestedJson = byId.get('menu.file.open');
  assert(nestedJson, 'JSON locale parser must flatten nested keys');
  assert.equal(nestedJson.text, 'Open a recent file');
  assert.equal(byId.get('plain')?.text, 'Plain top-level entry');

  const android = byId.get('promo_banner');
  assert(android, 'Android strings.xml parser must extract promo_banner');
  assert.equal(android.text, 'Save 20 percent today', 'Android inline markup must be stripped');
  assert.equal(android.sourcePath, 'res/values/strings.xml');

  const fileTypes = new Map((inventory.config?.resourceFiles ?? []).map((item) => [item, true]));
  assert(fileTypes.size >= 4, 'inventory must record the configured resource patterns');
  assert(scan.resources.files >= 4, 'scan must parse all four resource formats');
  assert.equal(scan.resources.parseErrors ?? 0, 0, 'fixture resources must parse without errors');

  console.log('i18n resource parser selftest: PASS');
} finally {
  await fs.rm(parserTemp, { recursive: true, force: true });
}
