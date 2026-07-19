// Pure routing helpers shared by the installed Cursor hook and the
// repository routing-card generator. Keep this module side-effect free so it
// can be copied next to the user-level hook and exercised in isolation.

export function mergeHookRegistries(sharedRegistry, localRegistry) {
  const merged = new Map();
  for (const registry of [sharedRegistry, localRegistry]) {
    for (const hook of Array.isArray(registry?.hooks) ? registry.hooks : []) {
      if (!hook?.id) continue;
      // Map#set preserves the original order for an existing key while
      // replacing its value, so a local hook overrides the shared definition
      // without duplicating the routing-card row.
      merged.set(hook.id, hook);
    }
  }
  return [...merged.values()];
}

export function globToRegExp(pattern) {
  let source = String(pattern);
  source = source.replace(/[.+^$()|[\]\\]/g, '\\$&');
  source = source.replace(/\{([^}]+)\}/g, (_, body) => `(?:${body.split(',').join('|')})`);
  source = source
    .replace(/\*\*\//g, '\u0001')
    .replace(/\/\*\*/g, '\u0002')
    .replace(/\*\*/g, '\u0003')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0002/g, '(?:/.*)?')
    .replace(/\u0003/g, '.*');
  return new RegExp(`^${source}$`, 'i');
}

const ROUTE_ACTIVATIONS = new Set(['always', 'conditional', 'explicit']);

function targetToken(value) {
  return String(value || '').trim().match(/(?:devrules\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md\b/)?.[0] || '';
}

function legacyConditionText(value, target) {
  return String(value || '')
    .replace(target, '')
    .replace(/^\s*(?:and|plus)\s+/i, '')
    .trim();
}

export function normalizeRouteEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const target = String(entry.target || '').trim();
    if (!target) return null;
    const activation = ROUTE_ACTIVATIONS.has(entry.activation) ? entry.activation : 'explicit';
    return {
      ...entry,
      target,
      activation,
      primary: entry.primary === true,
    };
  }

  if (typeof entry !== 'string') return null;
  const target = targetToken(entry);
  if (!target) return null;
  const conditionText = legacyConditionText(entry, target);
  return {
    target,
    activation: conditionText ? 'conditional' : 'always',
    primary: false,
    // Legacy local overrides are parsed for compatibility, but prose cannot be
    // proved by the runtime and therefore must never become an automatic route.
    condition: conditionText ? { type: 'legacy_text', text: conditionText } : undefined,
  };
}

export function evaluateRouteCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return false;
  if (Array.isArray(condition.all)) {
    return condition.all.length > 0 && condition.all.every((item) => evaluateRouteCondition(item, context));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.length > 0 && condition.any.some((item) => evaluateRouteCondition(item, context));
  }
  if (condition.not) return !evaluateRouteCondition(condition.not, context);
  if (condition.type === 'legacy_text' || condition.type === 'manual') return false;
  if (typeof condition.fact === 'string') {
    const actual = context.facts?.[condition.fact];
    if (Object.hasOwn(condition, 'equals')) return actual === condition.equals;
    if (Array.isArray(condition.in)) return condition.in.includes(actual);
    return actual === true;
  }
  if (condition.source === 'context' && typeof condition.pattern === 'string') {
    try {
      return new RegExp(condition.pattern, condition.flags || 'i').test(String(context.text || ''));
    } catch {
      return false;
    }
  }
  return false;
}

function eligibleRoute(entry, context) {
  if (entry.activation === 'always') return true;
  if (entry.activation === 'conditional') return evaluateRouteCondition(entry.condition, context);
  return false;
}

export function selectRouteEntry(entries, { expectedTarget = '', context = {} } = {}) {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map(normalizeRouteEntry)
    .filter(Boolean);
  const eligible = normalized.filter((entry) => eligibleRoute(entry, context));
  const primary = eligible.find((entry) => entry.primary);
  if (primary) return primary;
  if (expectedTarget) {
    const own = eligible.find((entry) => pathBasename(entry.target) === expectedTarget);
    if (own) return own;
  }
  return eligible.find((entry) => entry.activation === 'always') || eligible[0] || null;
}

export function selectHookTarget(hook, { prefix = '', context = {} } = {}) {
  const workflow = selectRouteEntry(hook?.workflows, {
    expectedTarget: hook?.id ? `${hook.id}.md` : '',
    context,
  });
  if (workflow) return joinRoutePrefix(prefix, 'workflows', workflow.target);
  const read = selectRouteEntry(hook?.read, { context });
  if (read) return joinRoutePrefix(prefix, '', read.target);
  return joinRoutePrefix(prefix, '', 'always-readme.md');
}

function pathBasename(target) {
  return String(target).replace(/\\/g, '/').split('/').pop() || '';
}

function joinRoutePrefix(prefix, directory, target) {
  const cleanTarget = String(target).replace(/\\/g, '/').replace(/^\.\//, '');
  if (cleanTarget.startsWith('devrules/')) return cleanTarget;
  const cleanPrefix = String(prefix || '').replace(/\\/g, '/').replace(/^\.\/$/, '.').replace(/\/$/, '');
  const cleanDirectory = directory && !cleanTarget.startsWith(`${directory}/`) ? directory : '';
  const parts = [cleanPrefix, cleanDirectory, cleanTarget].filter(Boolean);
  return parts.join('/').replace(/^\.\//, './');
}
