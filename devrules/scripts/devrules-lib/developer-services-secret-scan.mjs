const FORBIDDEN_SECRET_FIELDS = new Set([
  'apikey',
  'apitoken',
  'authorization',
  'bearertoken',
  'clientsecret',
  'connectionstring',
  'cookie',
  'databasepassword',
  'databaseurl',
  'password',
  'privatekey',
  'secret',
  'secretkey',
  'servicerolekey',
  'token',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function issue(code, filePath, field, message) {
  return { severity: 'error', code, file: filePath || '', field, message };
}

function looksLikePlaceholder(value) {
  const text = String(value || '').trim();
  return !text
    || text.includes('<')
    || text.includes('>')
    || text.includes('...')
    || /^(example|placeholder|redacted|omitted|not-recorded|unknown)$/i.test(text);
}

function secretPatternName(value) {
  if (typeof value !== 'string' || looksLikePlaceholder(value)) return '';
  const text = value.trim();
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return 'private-key';
  if (/\bBearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}\b/i.test(text)) return 'bearer-token';
  if (/\b(?:postgres|postgresql):\/\/[^\s:/]+:[^\s@]+@/i.test(text)) return 'credential-bearing-database-url';
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(text)) return 'jwt';
  if (/\bsb_secret_[A-Za-z0-9_-]{8,}\b/.test(text)) return 'supabase-secret-key';
  if (/\b(?:ghp|github_pat|sk_live|sk_test)_[A-Za-z0-9_-]{12,}\b/.test(text)) return 'token';
  return '';
}

export function scanForSecretMaterial(value, options = {}) {
  const filePath = options.filePath || '';
  const errors = [];

  function visit(current, fieldPath) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${fieldPath}[${index}]`));
      return;
    }
    if (!isObject(current)) {
      const pattern = secretPatternName(current);
      if (pattern) {
        errors.push(issue(
          'SECRET_VALUE_DETECTED',
          filePath,
          fieldPath,
          `possible ${pattern} value must be replaced by a logical secret reference`,
        ));
      }
      return;
    }

    for (const [key, nested] of Object.entries(current)) {
      const nestedPath = fieldPath ? `${fieldPath}.${key}` : key;
      if (FORBIDDEN_SECRET_FIELDS.has(normalizeKey(key))) {
        errors.push(issue(
          'SECRET_FIELD_FORBIDDEN',
          filePath,
          nestedPath,
          `${key} may hold secret material; store a credentialRef, sourceRef, variable name, or secret-store reference instead`,
        ));
      }
      visit(nested, nestedPath);
    }
  }

  visit(value, '');
  return errors;
}
