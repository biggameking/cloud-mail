import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const UI_EXTENSIONS = new Set([
  '.astro', '.css', '.html', '.js', '.jsx', '.less', '.mjs', '.sass', '.scss',
  '.svelte', '.swift', '.ts', '.tsx', '.vue',
]);

const EXCLUDED_DIRS = new Set([
  '.git', '.next', '.nuxt', '.output', '.turbo', 'build', 'coverage', 'dist',
  'node_modules', 'public', 'vendor',
]);

const DEFAULT_EXCLUDED_PREFIXES = ['devrules', 'scripts', 'workers', 'src/pages/api'];

const SIGNAL_PATTERNS = {
  'serif-headlines': /font-(?:headline|display)|playfair|serif[^\n]{0,32}(?:h1|headline)|(?:h1|h2|h3)[^\n]{0,64}font-family[^\n]{0,32}serif/i,
  'serif-body': /font-body|source\+?serif|source serif|prose[^\n]{0,48}serif/i,
  'sans-ui': /font-ui|\binter\b|system-ui/i,
  'uppercase-labels': /\buppercase\b|text-transform\s*:\s*uppercase/i,
  'tracked-labels': /tracking-(?:wide|wider|widest)|letter-spacing\s*:\s*(?:0\.0[2-9]|[1-9])/i,
  'thin-dividers': /divide-[xy]|border-(?:t|b|y)\b|section-divider/i,
  'editorial-grid': /grid-cols-(?:4|12)|col-span-(?:4|8)|max-w-(?:7xl|prose)|65ch/i,
  'image-led-story': /(?:hero|story-card|article-card)[^\n]{0,96}(?:image|img)|(?:image|img)[^\n]{0,96}(?:hero|story-card|article-card)/i,
  'restrained-radius': /rounded(?:-(?:none|sm|md|lg))?\b|border-radius\s*:\s*(?:0|[2-9]px|0\.[1-5]rem)/i,
  'restrained-shadow': /shadow-(?:sm|md|lg)\b|box-shadow\s*:/i,
  'accent-rule': /accent-underline|border-accent|text-accent|bg-accent/i,
  'ticker-or-breaking': /\bticker\b|breaking(?:-news)?/i,
  'dark-mode': /\bdark:|prefers-color-scheme|classList\.(?:add|toggle)\(['"]dark/i,
  'long-form-prose': /\bprose\b|drop-cap|story-body|article-body/i,
};

export function extractStyleEvidence(sourcePaths, { exclude = [] } = {}) {
  const excludedPrefixes = [...DEFAULT_EXCLUDED_PREFIXES, ...exclude.map(normalizePrefix)];
  const sources = sourcePaths.map((sourcePath) => inspectSource(sourcePath, excludedPrefixes));
  const commonSignals = Object.keys(SIGNAL_PATTERNS).filter((signal) =>
    sources.every((source) => source.signals[signal]?.count > 0),
  );
  const divergentSignals = Object.keys(SIGNAL_PATTERNS).filter((signal) => {
    const matching = sources.filter((source) => source.signals[signal]?.count > 0).length;
    return matching > 0 && matching < sources.length;
  });

  return {
    schemaVersion: 1,
    generatedBy: 'devrules/scripts/design-style-library.mjs extract',
    sourceCount: sources.length,
    excludedPrefixes,
    commonSignals,
    divergentSignals,
    sources,
  };
}

function inspectSource(sourcePath, excludedPrefixes) {
  const root = path.resolve(sourcePath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Style source is not a directory: ${sourcePath}`);
  }

  const files = collectUiFiles(root, excludedPrefixes);
  const colors = new Map();
  const fonts = new Map();
  const signals = Object.fromEntries(Object.keys(SIGNAL_PATTERNS).map((key) => [key, { count: 0, evidence: [] }]));

  for (const file of files) {
    const relative = slash(path.relative(root, file));
    const content = fs.readFileSync(file, 'utf8');
    collectMatches(content, /#[0-9a-fA-F]{3,8}\b/g, colors, relative);
    collectMatches(content, /(?:font-family\s*:\s*|family=)([^;\n<]+)/gi, fonts, relative, normalizeFont);
    collectMatches(content, /(?:headline|body|ui)\s*:\s*\[([^\]\n]+)/gi, fonts, relative, normalizeFont);

    for (const [signal, pattern] of Object.entries(SIGNAL_PATTERNS)) {
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        if (!pattern.test(lines[index])) continue;
        const entry = signals[signal];
        entry.count += 1;
        if (entry.evidence.length < 6) entry.evidence.push(`${relative}:${index + 1}`);
      }
    }
  }

  return {
    name: path.basename(root),
    commit: gitCommit(root),
    filesScanned: files.length,
    topColors: topEntries(colors, 16),
    topFonts: topEntries(fonts, 12),
    signals,
  };
}

function collectUiFiles(root, excludedPrefixes) {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('._')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) visit(full);
        continue;
      }
      if (!entry.isFile() || !UI_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (entry.name.endsWith('.min.js') || fs.statSync(full).size > 1_000_000) continue;
      const relative = slash(path.relative(root, full));
      if (excludedPrefixes.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))) continue;
      files.push(full);
    }
  };
  visit(root);
  return files.sort();
}

function collectMatches(content, pattern, map, file, normalize = (value) => value.toUpperCase()) {
  for (const match of content.matchAll(pattern)) {
    const value = normalize(match[1] ?? match[0]);
    if (!value) continue;
    const current = map.get(value) ?? { value, count: 0, evidence: [] };
    current.count += 1;
    if (current.evidence.length < 4) current.evidence.push(file);
    map.set(value, current);
  }
}

function normalizeFont(value) {
  return value
    .replace(/&[^\s]+/g, '')
    .replace(/\+/g, ' ')
    .replace(/["']/g, '')
    .trim()
    .slice(0, 160);
}

function topEntries(map, limit) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function gitCommit(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function slash(value) {
  return value.split(path.sep).join('/');
}

function normalizePrefix(value) {
  return slash(String(value))
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export function renderStyleDraft({ id, name, evidence }) {
  const sourceRows = evidence.sources
    .map((source) => `| ${source.name} | ${source.commit ?? 'not-a-git-repo'} | ${source.filesScanned} |`)
    .join('\n');
  const common = evidence.commonSignals.map((signal) => `- [ ] ${signal}: explain the portable decision and cite every source; for a single source cite at least three representative screens.`).join('\n');
  const divergent = evidence.divergentSignals.map((signal) => `- [ ] ${signal}: classify as source-specific, optional variant, or false positive.`).join('\n');

  return `# Design style extraction draft: ${name}\n\n` +
    `- Proposed id: \`${id}\`\n` +
    `- Status: evidence collected; editorial review required before publish\n` +
    `- Privacy boundary: do not copy product names, copy, routes, credentials, customer data, or business logic into the style pack.\n\n` +
    `## Sources\n\n| Repository | Commit | UI files scanned |\n| --- | --- | ---: |\n${sourceRows}\n\n` +
    `## Shared signals to review\n\n${common || '- No mechanically shared signals found; inspect sources manually.'}\n\n` +
    `## Divergences to resolve\n\n${divergent || '- None detected mechanically.'}\n\n` +
    `## Required editorial decisions\n\n` +
    `- [ ] Define the concrete visual reference, audience, density, and suitable surfaces.\n` +
    `- [ ] Separate structural design language from brand identity and one-off implementation details.\n` +
    `- [ ] Reconcile tokens by semantic role; frequency alone is not a design decision.\n` +
    `- [ ] Write explicit non-goals and excluded source surfaces.\n` +
    `- [ ] Produce lint-valid DESIGN.md, application.md, evidence.json, and style.json.\n` +
    `- [ ] Run validate and design-lint before publish.\n`;
}
