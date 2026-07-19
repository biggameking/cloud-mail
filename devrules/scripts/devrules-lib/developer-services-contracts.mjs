export const AUTOMATION_METHODS = new Set([
  'mcp-oauth',
  'mcp-bearer',
  'cli',
  'rest-api',
  'browser',
  'dashboard-only',
]);

export const BINDING_ROLES = new Set([
  'primary',
  'secondary',
  'alternative',
  'failover',
  'migration-source',
  'migration-target',
  'testing',
  'analytics',
  'shared',
]);

export const BINDING_STATUSES = new Set(['draft', 'active', 'blocked', 'deprecated', 'retired']);
export const ACCOUNT_STATUSES = new Set(['draft', 'active', 'read-only', 'blocked', 'retired']);
export const AUTOMATION_STATUSES = new Set(['planned', 'configured', 'verified', 'blocked', 'retired']);
export const SELECTION_MODES = new Set([
  'fixed',
  'build-time',
  'runtime-selectable',
  'operator-selected',
  'failover',
  'migration',
]);
export const DATA_RELATIONSHIPS = new Set([
  'independent',
  'mirrored',
  'migrating',
  'shared',
  'read-replica',
  'unknown',
]);
export const DATA_AUTHORITY_MODES = new Set([
  'authoritative',
  'authoritative-when-selected',
  'source',
  'target',
  'replica',
  'cache',
  'none',
]);
export const ENVIRONMENT_CLASSIFICATIONS = new Set([
  'public',
  'secret',
  'privileged-secret',
  'identity',
  'local-only',
  'runtime-secret',
  'ci-secret',
]);
