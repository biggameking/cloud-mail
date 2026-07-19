import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_FILES = ['style.json', 'DESIGN.md', 'evidence.json', 'application.md'];
const REQUIRED_SECTIONS = ['Overview', 'Colors', 'Typography', 'Components', "Do's and Don'ts"];

function readCatalog(libraryRoot) {
  const catalogPath = path.join(libraryRoot, 'catalog.json');
  if (!fs.existsSync(catalogPath)) return { schemaVersion: 1, styles: [] };
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

export function listStyles(libraryRoot) {
  const catalog = readCatalog(libraryRoot);
  return [...(catalog.styles ?? [])].sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveStyle(libraryRoot, idOrPath) {
  const direct = path.resolve(idOrPath);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
  return path.join(path.resolve(libraryRoot), idOrPath);
}

export function validateStyle(styleRoot, { expectedId } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(styleRoot, file))) errors.push(`missing ${file}`);
  }
  if (errors.length > 0) return { valid: false, errors, metadata: null };

  let metadata;
  let evidence;
  try {
    metadata = JSON.parse(fs.readFileSync(path.join(styleRoot, 'style.json'), 'utf8'));
  } catch (error) {
    errors.push(`invalid style.json: ${error.message}`);
  }
  try {
    evidence = JSON.parse(fs.readFileSync(path.join(styleRoot, 'evidence.json'), 'utf8'));
  } catch (error) {
    errors.push(`invalid evidence.json: ${error.message}`);
  }
  if (!metadata) return { valid: false, errors, metadata: null };

  const directoryId = path.basename(styleRoot);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.id ?? '')) errors.push('style id must be kebab-case');
  if (metadata.id !== directoryId) errors.push(`style id ${metadata.id ?? '<missing>'} does not match directory ${directoryId}`);
  if (expectedId && metadata.id !== expectedId) errors.push(`style id ${metadata.id} does not match requested id ${expectedId}`);
  if (!metadata.name || !metadata.version || !metadata.description) errors.push('style.json requires name, version, and description');
  if (metadata.status !== 'published' && metadata.status !== 'draft') errors.push('style status must be draft or published');
  if (!Array.isArray(metadata.sources) || metadata.sources.length === 0) errors.push('style.json requires at least one source');
  if (!evidence || !Array.isArray(evidence.sources) || evidence.sources.length === 0) errors.push('evidence.json requires at least one source');

  const design = fs.readFileSync(path.join(styleRoot, 'DESIGN.md'), 'utf8');
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^## ${escapeRegExp(section)}\\s*$`, 'm').test(design)) errors.push(`DESIGN.md missing ## ${section}`);
  }
  if (!/^---\s*[\r\n]/.test(design)) errors.push('DESIGN.md requires YAML front matter');

  return { valid: errors.length === 0, errors, metadata };
}

export function publishStyle({ sourceRoot, libraryRoot, apply }) {
  const validation = validateStyle(sourceRoot);
  if (!validation.valid) return { status: 'invalid', ...validation };
  const id = validation.metadata.id;
  const destination = path.join(libraryRoot, id);
  if (fs.existsSync(destination)) {
    return { status: 'conflict', id, destination, message: 'published style already exists; edit it explicitly and validate instead of overwriting' };
  }
  if (!apply) return { status: 'planned', id, destination, files: REQUIRED_FILES };

  fs.mkdirSync(libraryRoot, { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  for (const file of REQUIRED_FILES) fs.copyFileSync(path.join(sourceRoot, file), path.join(destination, file));
  writeCatalog(libraryRoot);
  return { status: 'published', id, destination, files: REQUIRED_FILES };
}

export function applyStyle({ styleRoot, targetRoot, apply }) {
  const validation = validateStyle(styleRoot);
  if (!validation.valid) return { status: 'invalid', ...validation };

  const metadata = validation.metadata;
  const outputs = [
    { source: path.join(styleRoot, 'DESIGN.md'), target: path.join(targetRoot, 'DESIGN.md') },
    { source: path.join(styleRoot, 'application.md'), target: path.join(targetRoot, 'docs', 'design', 'style-application.md') },
    {
      content: JSON.stringify({
        schemaVersion: 1,
        style: metadata.id,
        styleVersion: metadata.version,
        source: `devrules/design-styles/${metadata.id}`,
        editableFork: true,
      }, null, 2) + '\n',
      target: path.join(targetRoot, 'docs', 'design', 'style-source.json'),
    },
  ];

  const conflicts = outputs.filter((output) => {
    if (!fs.existsSync(output.target)) return false;
    const expected = output.content ?? fs.readFileSync(output.source, 'utf8');
    return fs.readFileSync(output.target, 'utf8') !== expected;
  }).map((output) => slash(path.relative(targetRoot, output.target)));
  if (conflicts.length > 0) {
    return { status: 'conflict', id: metadata.id, conflicts, message: 'target files differ; merge them through design-change instead of overwriting' };
  }

  const relativeOutputs = outputs.map((output) => slash(path.relative(targetRoot, output.target)));
  if (!apply) return { status: 'planned', id: metadata.id, targetRoot, outputs: relativeOutputs };
  for (const output of outputs) {
    fs.mkdirSync(path.dirname(output.target), { recursive: true });
    fs.writeFileSync(output.target, output.content ?? fs.readFileSync(output.source, 'utf8'), 'utf8');
  }
  return { status: 'applied', id: metadata.id, targetRoot, outputs: relativeOutputs };
}

function writeCatalog(libraryRoot) {
  const styles = [];
  if (fs.existsSync(libraryRoot)) {
    for (const entry of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const validation = validateStyle(path.join(libraryRoot, entry.name));
      if (!validation.valid || validation.metadata.status !== 'published') continue;
      const { id, name, version, description, tags = [], suitableFor = [] } = validation.metadata;
      styles.push({ id, name, version, description, tags, suitableFor });
    }
  }
  styles.sort((a, b) => a.id.localeCompare(b.id));
  const catalog = { schemaVersion: 1, styles };
  fs.mkdirSync(libraryRoot, { recursive: true });
  fs.writeFileSync(path.join(libraryRoot, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  return catalog;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slash(value) {
  return value.split(path.sep).join('/');
}
