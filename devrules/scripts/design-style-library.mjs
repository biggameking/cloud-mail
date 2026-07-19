#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractStyleEvidence, renderStyleDraft } from './design-lib/style-extract.mjs';
import { applyStyle, listStyles, publishStyle, resolveStyle, validateStyle } from './design-lib/style-library.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultLibrary = path.resolve(here, '..', 'design-styles');

main();

function main() {
  try {
    const { command, flags } = parse(process.argv.slice(2));
    const library = path.resolve(flags.library ?? defaultLibrary);
    let result;

    if (command === 'extract') {
      const sources = array(flags.source);
      const id = flags.id;
      if (sources.length === 0 || !id) usageError('extract requires --source <repo> (repeatable) and --id <kebab-case>');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) usageError('--id must be kebab-case');
      const evidence = extractStyleEvidence(sources, { exclude: array(flags.exclude) });
      const output = path.resolve(flags.out ?? path.join(process.cwd(), '.design-style-extract', id));
      result = { status: flags.apply ? 'extracted' : 'planned', id, output, evidence };
      if (flags.apply) {
        if (fs.existsSync(output) && fs.readdirSync(output).length > 0) usageError(`output directory is not empty: ${output}`);
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
        fs.writeFileSync(path.join(output, 'STYLE-DRAFT.md'), renderStyleDraft({ id, name: flags.name ?? id, evidence }), 'utf8');
      }
    } else if (command === 'list') {
      result = { status: 'ok', library, styles: listStyles(library) };
    } else if (command === 'validate') {
      if (!flags.style) usageError('validate requires --style <id-or-path>');
      const styleRoot = resolveStyle(library, flags.style);
      const validation = validateStyle(styleRoot, { expectedId: looksLikePath(flags.style) ? undefined : flags.style });
      result = { status: validation.valid ? 'valid' : 'invalid', styleRoot, ...validation };
    } else if (command === 'publish') {
      if (!flags.source) usageError('publish requires --source <reviewed-style-directory>');
      result = publishStyle({ sourceRoot: path.resolve(flags.source), libraryRoot: library, apply: Boolean(flags.apply) });
    } else if (command === 'apply') {
      if (!flags.style || !flags.repo) usageError('apply requires --style <id-or-path> and --repo <target>');
      result = applyStyle({ styleRoot: resolveStyle(library, flags.style), targetRoot: path.resolve(flags.repo), apply: Boolean(flags.apply) });
    } else {
      usageError('command must be extract, list, validate, publish, or apply');
    }

    print(result, Boolean(flags.json));
    if (result.status === 'invalid' || result.status === 'conflict') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`[design-style-library] ${error.message}\n`);
    process.exitCode = 1;
  }
}

function parse(argv) {
  const command = argv[0];
  const flags = {};
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) usageError(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === 'apply' || key === 'json') {
      flags[key] = true;
      continue;
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) usageError(`missing value for --${key}`);
    flags[key] = (key === 'source' || key === 'exclude') && flags[key] ? [...array(flags[key]), value] : value;
  }
  return { command, flags };
}

function array(value) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function looksLikePath(value) {
  return path.isAbsolute(value) || value.includes('/') || value.includes('\\');
}

function print(result, json) {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  process.stdout.write(`[design-style-library] ${result.status}\n`);
  if (result.id) process.stdout.write(`  style: ${result.id}\n`);
  if (result.output) process.stdout.write(`  output: ${result.output}\n`);
  if (result.styles) for (const style of result.styles) process.stdout.write(`  ${style.id}@${style.version} — ${style.name}\n`);
  if (result.errors) for (const error of result.errors) process.stdout.write(`  error: ${error}\n`);
  if (result.conflicts) for (const conflict of result.conflicts) process.stdout.write(`  conflict: ${conflict}\n`);
}

function usageError(message) {
  throw new Error(`${message}\nUsage: design-style-library.mjs <extract|list|validate|publish|apply> [options]`);
}
