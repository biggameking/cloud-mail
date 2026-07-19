import path from 'node:path';
import {
  nowIso,
  pathExists,
  readText,
  today,
  writeText,
  writeTextIfChanged,
} from './fs-actions.mjs';
import { findGitRepos } from './repo-discovery.mjs';
import { isApply, output } from './cli-io.mjs';

const EVOLUTION_START = '<!-- DEVRULES:COLLECTED-EVOLUTION-START -->';
const EVOLUTION_END = '<!-- DEVRULES:COLLECTED-EVOLUTION-END -->';

function extractLines(content, pattern) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+\.)\s+/.test(line))
    .filter((line) => pattern.test(line));
}

export async function commandMemoryCompact(options) {
  if (!options.repo) throw new Error('memory compact requires --repo <dir>');
  const apply = isApply(options);
  const repo = path.resolve(String(options.repo));
  const memoryDir = path.join(repo, 'devrules', 'memory');
  const logPath = path.join(memoryDir, 'interaction-log.md');
  const log = await readText(logPath);
  const actions = [];

  if (!log.trim()) {
    output({ repo, apply, actions: [{ action: 'skip', reason: 'interaction log is empty' }] }, options);
    return;
  }

  const decisionLines = extractLines(log, /(decision|decided|decide|决策|决定)/i);
  const lessonLines = extractLines(log, /(lesson|learned|root cause|经验|教训|根因)/i);
  const stamp = nowIso().replace(/[:.]/g, '-');
  const archivePath = path.join(memoryDir, 'archive', `interaction-log-${stamp}.md`);

  const compactedLog = `# Interaction Log

Recent useful interaction notes belong here until they are distilled into decisions, lessons, or evolution suggestions.

Compacted on ${nowIso()}. Archived previous log to \`archive/${path.basename(archivePath)}\`.
`;

  await writeText(archivePath, log, apply, actions, 'archive interaction log before compaction');
  await writeText(logPath, compactedLog, apply, actions, 'reset compacted interaction log');

  if (decisionLines.length) {
    const decisionsPath = path.join(memoryDir, 'decisions.md');
    const existing = await readText(decisionsPath, '# Decisions\n');
    const addition = `\n## ${today()} - Compacted decisions\n\n${decisionLines.map((line) => `- ${line}`).join('\n')}\n`;
    await writeText(decisionsPath, `${existing.trimEnd()}\n${addition}`, apply, actions, 'append compacted decision candidates');
  }

  if (lessonLines.length) {
    const lessonsPath = path.join(memoryDir, 'lessons.md');
    const existing = await readText(lessonsPath, '# Lessons\n');
    const addition = `\n## ${today()} - Compacted lessons\n\n${lessonLines.map((line) => `- ${line}`).join('\n')}\n`;
    await writeText(lessonsPath, `${existing.trimEnd()}\n${addition}`, apply, actions, 'append compacted lesson candidates');
  }

  output({ repo, apply, decisionCandidates: decisionLines.length, lessonCandidates: lessonLines.length, actions }, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} memory compaction for ${data.repo}`);
    console.log(`Decision candidates: ${data.decisionCandidates}`);
    console.log(`Lesson candidates: ${data.lessonCandidates}`);
    for (const action of data.actions) console.log(`- ${action.action}: ${action.path || ''} (${action.reason})`);
  });
}

function stripSuggestionBoilerplate(content) {
  return content
    .replace(/^#\s+Evolution Suggestions\s*/i, '')
    .replace(/Suggestions for improving[\s\S]*?template changes\.\s*/i, '')
    .trim();
}

export async function commandEvolutionCollect(options, context) {
  const apply = isApply(options);
  const root = path.resolve(String(options.root || '..'));
  const repos = await findGitRepos(root, options.recursive === true);
  const collected = [];

  for (const repo of repos) {
    const file = path.join(repo, 'devrules', 'memory', 'evolution-suggestions.md');
    if (!(await pathExists(file))) continue;
    const content = stripSuggestionBoilerplate(await readText(file));
    if (!content || /^no suggestions yet\.?$/i.test(content)) continue;
    collected.push({ repo, name: path.basename(repo), content });
  }

  const target = path.join(context.templateRoot, 'memory', 'evolution-suggestions.md');
  const existing = await readText(target, '# Template Evolution Suggestions\n');
  const blockContent = collected.length
    ? collected.map((item) => `## ${item.name}\n\nSource: ${item.repo}\n\n${item.content}`).join('\n\n---\n\n')
    : 'No collected suggestions yet.';

  const managed = `${EVOLUTION_START}\n${blockContent}\n${EVOLUTION_END}`;
  let next;
  const start = existing.indexOf(EVOLUTION_START);
  const end = existing.indexOf(EVOLUTION_END);
  if (start !== -1 && end !== -1 && end > start) {
    next = `${existing.slice(0, start).trimEnd()}\n\n${managed}\n${existing.slice(end + EVOLUTION_END.length).trimStart()}`.trimEnd() + '\n';
  } else {
    next = `${existing.trimEnd()}\n\n${managed}\n`;
  }

  const actions = [];
  await writeTextIfChanged(target, next, apply, actions, 'collect project evolution suggestions into template review file');
  output({ root, apply, collectedCount: collected.length, collected, actions }, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} evolution collection from ${data.root}`);
    console.log(`Collected suggestions from ${data.collectedCount} repositories.`);
    for (const item of data.collected) console.log(`- ${item.name}`);
    for (const action of data.actions) console.log(`- ${action.action}: ${action.path || ''} (${action.reason})`);
  });
}
