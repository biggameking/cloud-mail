import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeRel,
  nowIso,
  pathExists,
  readText,
} from './fs-actions.mjs';

function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeSkillId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed-skill';
}

function hasEmbeddedDriveSegment(value) {
  return /(?:\/|\\)[A-Za-z]:(?:\/|\\|$)/.test(String(value || ''));
}

export function defaultSkillRoots() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const roots = [];
  if (home) {
    roots.push({ surface: 'claude', root: path.join(home, '.claude', 'skills') });
    roots.push({ surface: 'codex', root: path.join(home, '.codex', 'skills') });
    roots.push({ surface: 'agents', root: path.join(home, '.agents', 'skills') });
  }
  const codexDataRoot = process.env.DEVRULES_CODEX_DATA_SKILLS
    || (process.platform === 'win32' ? 'D:\\UserData\\.codex\\skills' : '');
  if (codexDataRoot) {
    roots.push({ surface: 'codex-data', root: path.resolve(codexDataRoot) });
  }
  return roots.filter((rootInfo) => !hasEmbeddedDriveSegment(rootInfo.root));
}

function parseSkillFrontmatter(content) {
  const frontmatter = {};
  const match = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return frontmatter;
  for (const line of match[1].split(/\r?\n/)) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const key = keyMatch[1].trim();
    let value = keyMatch[2].trim();
    value = value.replace(/^['"]|['"]$/g, '');
    frontmatter[key] = value;
  }
  return frontmatter;
}

function fallbackSkillDescription(content) {
  const lines = String(content || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstText = lines.find((line) => !line.startsWith('---') && !line.startsWith('#'));
  return firstText || '';
}

function inferSkillCategories(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  const categories = [];
  const add = (category, pattern) => {
    if (pattern.test(text)) categories.push(category);
  };
  add('ios', /ios|swift|swiftui|iphone|ipad|mobile|\u79fb\u52a8/);
  add('web', /web|frontend|react|next|vite|html|css|\u7f51\u9875|\u524d\u7aef/);
  add('python', /python|py\b|django|fastapi/);
  add('content', /content|writer|writing|novel|story|\u6587\u7ae0|\u5199\u4f5c|\u5c0f\u8bf4|\u5185\u5bb9/);
  add('video', /video|remotion|animation|film|\u89c6\u9891|\u52a8\u753b/);
  add('ai', /ai|agent|llm|prompt|model|\u667a\u80fd|\u4ee3\u7406|\u63d0\u793a\u8bcd/);
  add('design', /design|ui|ux|visual|frontend|figma|\u8bbe\u8ba1|\u754c\u9762/);
  add('security', /security|audit|vulnerability|\u5b89\u5168|\u5ba1\u8ba1/);
  add('automation', /automation|workflow|batch|orchestration|sync|registry|devrules|\u81ea\u52a8\u5316|\u5de5\u4f5c\u6d41|\u540c\u6b65|\u8de8\u8bbe\u5907|\u591a\u8bbe\u5907|\u89c4\u5219\u6cbb\u7406/);
  add('architecture', /architecture|architect|refactor|modular|boundary|\u67b6\u6784|\u6cbb\u7406|\u91cd\u6784|\u6a21\u5757|\u8fb9\u754c/);
  add('data', /data|analytics|spreadsheet|sql|database|\u6570\u636e|\u5206\u6790/);
  add('docs', /docs|document|pdf|presentation|\u6587\u6863|\u8bf4\u660e/);
  return categories.length ? uniqueSorted(categories) : ['general'];
}

function tokenizeText(text) {
  return uniqueSorted(
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .slice(0, 80),
  );
}

function inferSkillKeywords(name, description, categories) {
  const tokens = tokenizeText(`${name} ${description}`);
  const seeded = [
    ...categories,
    ...tokens.filter((token) => token.length <= 24).slice(0, 18),
  ];
  return uniqueSorted(seeded).slice(0, 24);
}

async function findSkillDirs(root, maxDepth = 3) {
  const found = [];
  async function walk(dir, depth) {
    if (!(await pathExists(dir))) return;
    const skillPath = path.join(dir, 'SKILL.md');
    if (await pathExists(skillPath)) {
      found.push(dir);
      return;
    }
    if (depth >= maxDepth) return;
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['node_modules', '__pycache__', 'cache', 'backups'].includes(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }
  await walk(root, 0);
  return uniqueSorted(found);
}

async function collectSkills() {
  const byName = new Map();
  const roots = defaultSkillRoots();
  for (const rootInfo of roots) {
    const dirs = await findSkillDirs(rootInfo.root);
    for (const dir of dirs) {
      const skillMd = path.join(dir, 'SKILL.md');
      const content = await readText(skillMd, '');
      const frontmatter = parseSkillFrontmatter(content);
      const name = frontmatter.name || path.basename(dir);
      const description = frontmatter.description || fallbackSkillDescription(content);
      const categories = inferSkillCategories(name, description);
      const keywords = inferSkillKeywords(name, description, categories);
      const key = normalizeSkillId(name);
      const existing = byName.get(key);
      const nextPath = normalizeRel(dir);
      const issues = [];
      if (!description) issues.push('missing description');
      if (existing) {
        existing.paths = uniqueSorted([...existing.paths, nextPath]);
        existing.surfaces = uniqueSorted([...existing.surfaces, rootInfo.surface]);
        existing.categories = uniqueSorted([...existing.categories, ...categories]);
        existing.keywords = uniqueSorted([...existing.keywords, ...keywords]).slice(0, 32);
        existing.aliases = uniqueSorted([...existing.aliases, `/${name}`, `$${name}`, name]);
        existing.surface = existing.surfaces.length > 1 ? 'mixed' : existing.surfaces[0];
        existing.path = existing.paths[0];
        existing.health.duplicatePaths = existing.paths.length;
        existing.health.issues = uniqueSorted([...existing.health.issues, ...issues]);
        if (description.length > existing.description.length) existing.description = description;
      } else {
        byName.set(key, {
          skillId: key,
          name,
          surface: rootInfo.surface,
          surfaces: [rootInfo.surface],
          path: nextPath,
          paths: [nextPath],
          description,
          categories,
          keywords,
          aliases: uniqueSorted([`/${name}`, `$${name}`, name]),
          health: {
            hasSkillMd: true,
            hasDescription: Boolean(description),
            duplicatePaths: 1,
            issues,
          },
        });
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function scoreSkillForQuery(skill, query) {
  const queryText = String(query || '').toLowerCase();
  const queryTokens = tokenizeText(queryText);
  const queryCategories = inferSkillCategories('', queryText);
  const haystack = `${skill.name} ${skill.description} ${skill.keywords.join(' ')} ${skill.categories.join(' ')}`.toLowerCase();
  let score = 0;
  const reasons = [];

  for (const token of queryTokens) {
    if (skill.keywords.some((keyword) => keyword.toLowerCase() === token)) {
      score += 4;
      reasons.push(`keyword:${token}`);
    } else if (haystack.includes(token)) {
      score += 2;
      reasons.push(`text:${token}`);
    }
  }

  for (const category of queryCategories) {
    if (skill.categories.includes(category)) {
      score += 6;
      reasons.push(`category:${category}`);
    }
  }

  if (skill.surface === 'codex' || skill.surfaces.includes('codex')) {
    score += 1;
  }

  return { score, reasons: uniqueSorted(reasons).slice(0, 8) };
}

export async function buildSkillsRegistry() {
  const skills = await collectSkills();
  return {
    schemaVersion: 1,
    lastUpdated: nowIso(),
    totalSkills: skills.length,
    roots: defaultSkillRoots().map((root) => ({
      surface: root.surface,
      path: normalizeRel(root.root),
      exists: existsSync(root.root),
    })),
    skills,
  };
}

export async function commandSkillsList(options, context) {
  const registry = await buildSkillsRegistry();
  context.output(registry, options, (data) => {
    console.log(`Indexed ${data.totalSkills} skills.`);
    for (const skill of data.skills) {
      console.log(`- ${skill.name} [${skill.surface}] ${skill.categories.join(', ')}`);
    }
  });
}

export async function commandSkillsRecommend(options, context) {
  const query = String(options.query || '').trim();
  if (!query) throw new Error('skills recommend requires --query <task>');
  const registry = await buildSkillsRegistry();
  const recommendations = registry.skills
    .map((skill) => ({ skill, ...scoreSkillForQuery(skill, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, Number(options.limit || 8))
    .map((entry) => ({
      skillId: entry.skill.skillId,
      name: entry.skill.name,
      surface: entry.skill.surface,
      path: entry.skill.path,
      score: entry.score,
      categories: entry.skill.categories,
      reasons: entry.reasons,
      description: entry.skill.description,
    }));
  context.output({ query, count: recommendations.length, recommendations }, options, (data) => {
    console.log(`Skill recommendations for: ${data.query}`);
    for (const item of data.recommendations) {
      console.log(`- ${item.name} (${item.score}): ${item.reasons.join(', ')}`);
    }
  });
}
