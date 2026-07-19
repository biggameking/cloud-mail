import {
  ACCOUNT_STATUSES,
  AUTOMATION_METHODS,
  AUTOMATION_STATUSES,
  BINDING_ROLES,
  BINDING_STATUSES,
  DATA_AUTHORITY_MODES,
  DATA_RELATIONSHIPS,
  ENVIRONMENT_CLASSIFICATIONS,
  SELECTION_MODES,
} from './developer-services-contracts.mjs';
import { scanForSecretMaterial } from './developer-services-secret-scan.mjs';

export * from './developer-services-contracts.mjs';
export { scanForSecretMaterial } from './developer-services-secret-scan.mjs';

const ACCOUNT_REF_PATTERN = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._-]*$/;
const RECORD_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function issue(severity, code, filePath, field, message) {
  return { severity, code, file: filePath || '', field, message };
}

function requiredText(record, field, errors, filePath) {
  if (!hasText(record?.[field])) {
    errors.push(issue('error', 'REQUIRED_TEXT', filePath, field, `${field} must be a non-empty string`));
    return '';
  }
  return record[field].trim();
}

function validateEnum(value, allowed, field, errors, filePath) {
  if (!allowed.has(value)) {
    errors.push(issue(
      'error',
      'INVALID_ENUM',
      filePath,
      field,
      `${field} must be one of: ${[...allowed].join(', ')}`,
    ));
  }
}

function validateIdentifier(identifier, field, errors, filePath) {
  if (!isObject(identifier)) {
    errors.push(issue('error', 'INVALID_IDENTIFIER', filePath, field, 'identifier must be an object'));
    return;
  }
  requiredText(identifier, 'kind', errors, filePath);
  const hasValue = hasText(identifier.value);
  const hasSource = hasText(identifier.sourceRef);
  if (hasValue === hasSource) {
    errors.push(issue(
      'error',
      'IDENTIFIER_SOURCE_AMBIGUOUS',
      filePath,
      field,
      'identifier must contain exactly one of value or sourceRef',
    ));
  }
}

function validateAutomationProfile(profile, field, errors, filePath) {
  if (!isObject(profile)) {
    errors.push(issue('error', 'INVALID_AUTOMATION_PROFILE', filePath, field, 'automation profile must be an object'));
    return;
  }
  requiredText(profile, 'profileId', errors, filePath);
  requiredText(profile, 'method', errors, filePath);
  if (hasText(profile.method)) validateEnum(profile.method, AUTOMATION_METHODS, `${field}.method`, errors, filePath);
  if (profile.status !== undefined) validateEnum(profile.status, AUTOMATION_STATUSES, `${field}.status`, errors, filePath);
  if (profile.writesRequireExplicitApproval !== true) {
    errors.push(issue(
      'error',
      'WRITE_APPROVAL_REQUIRED',
      filePath,
      `${field}.writesRequireExplicitApproval`,
      'remote writes must require explicit approval',
    ));
  }
}

export function validateDeveloperServiceAccount(record, options = {}) {
  const filePath = options.filePath || '';
  const errors = scanForSecretMaterial(record, { filePath });
  const warnings = [];

  if (!isObject(record)) {
    errors.push(issue('error', 'INVALID_RECORD', filePath, '', 'account record must be a JSON object'));
    return { valid: false, errors, warnings };
  }
  if (record.schemaVersion !== 1) {
    errors.push(issue('error', 'SCHEMA_VERSION', filePath, 'schemaVersion', 'schemaVersion must be 1'));
  }
  if (record.recordType !== 'developer-service-account') {
    errors.push(issue(
      'error',
      'RECORD_TYPE',
      filePath,
      'recordType',
      'recordType must be developer-service-account',
    ));
  }
  const accountRef = requiredText(record, 'accountRef', errors, filePath);
  const provider = requiredText(record, 'provider', errors, filePath);
  requiredText(record, 'displayName', errors, filePath);
  requiredText(record, 'owner', errors, filePath);
  if (accountRef && !ACCOUNT_REF_PATTERN.test(accountRef)) {
    errors.push(issue('error', 'ACCOUNT_REF_FORMAT', filePath, 'accountRef', 'accountRef must use provider:stable-alias'));
  }
  if (accountRef && provider && accountRef.split(':')[0] !== provider) {
    errors.push(issue('error', 'ACCOUNT_PROVIDER_MISMATCH', filePath, 'provider', 'provider must match accountRef prefix'));
  }
  validateEnum(record.status, ACCOUNT_STATUSES, 'status', errors, filePath);
  if (!isObject(record.identity)) {
    errors.push(issue('error', 'IDENTITY_REQUIRED', filePath, 'identity', 'identity must be an object'));
  } else if (record.status === 'active' && Object.values(record.identity).every((value) => !hasText(value))) {
    warnings.push(issue(
      'warning',
      'IDENTITY_UNVERIFIED',
      filePath,
      'identity',
      'active account should record at least one non-secret provider identity or landmark',
    ));
  }

  const profiles = Array.isArray(record.automationProfiles) ? record.automationProfiles : [];
  if (!Array.isArray(record.automationProfiles)) {
    errors.push(issue('error', 'AUTOMATION_PROFILES_REQUIRED', filePath, 'automationProfiles', 'automationProfiles must be an array'));
  }
  const profileIds = new Set();
  profiles.forEach((profile, index) => {
    const field = `automationProfiles[${index}]`;
    validateAutomationProfile(profile, field, errors, filePath);
    if (!hasText(profile?.profileId)) return;
    if (profileIds.has(profile.profileId)) {
      errors.push(issue('error', 'DUPLICATE_AUTOMATION_PROFILE', filePath, `${field}.profileId`, 'profileId must be unique'));
    }
    profileIds.add(profile.profileId);
    if (accountRef && !profile.profileId.startsWith(`${accountRef}:`)) {
      warnings.push(issue(
        'warning',
        'AUTOMATION_PROFILE_NAMESPACE',
        filePath,
        `${field}.profileId`,
        `profileId should start with ${accountRef}:`,
      ));
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function targetFingerprint(binding) {
  const identities = Array.isArray(binding?.target?.identifiers) ? binding.target.identifiers : [];
  const normalized = identities
    .map((identifier) => `${identifier?.kind || ''}=${identifier?.value || `@${identifier?.sourceRef || ''}`}`)
    .sort()
    .join('|');
  return [binding?.provider, binding?.accountRef, binding?.environment, binding?.target?.kind, normalized].join('::');
}

function selectorFingerprint(selection) {
  const selector = selection?.selector || {};
  return `${selector.type || ''}:${selector.name || ''}:${selector.value || ''}`;
}

function validateBinding(binding, index, account, errors, warnings, filePath) {
  const field = `serviceBindings[${index}]`;
  if (!isObject(binding)) {
    errors.push(issue('error', 'INVALID_BINDING', filePath, field, 'service binding must be an object'));
    return;
  }
  const bindingId = requiredText(binding, 'bindingId', errors, filePath);
  const provider = requiredText(binding, 'provider', errors, filePath);
  const accountRef = requiredText(binding, 'accountRef', errors, filePath);
  requiredText(binding, 'environment', errors, filePath);
  validateEnum(binding.role, BINDING_ROLES, `${field}.role`, errors, filePath);
  validateEnum(binding.status, BINDING_STATUSES, `${field}.status`, errors, filePath);
  if (bindingId && !RECORD_ID_PATTERN.test(bindingId)) {
    errors.push(issue('error', 'BINDING_ID_FORMAT', filePath, `${field}.bindingId`, 'bindingId must be a stable lowercase identifier'));
  }
  if (accountRef && !ACCOUNT_REF_PATTERN.test(accountRef)) {
    errors.push(issue('error', 'ACCOUNT_REF_FORMAT', filePath, `${field}.accountRef`, 'accountRef must use provider:stable-alias'));
  }
  if (account && provider && account.provider !== provider) {
    errors.push(issue('error', 'ACCOUNT_PROVIDER_MISMATCH', filePath, `${field}.provider`, 'binding provider does not match account record'));
  }

  if (!isObject(binding.target)) {
    errors.push(issue('error', 'TARGET_REQUIRED', filePath, `${field}.target`, 'target must be an object'));
  } else {
    requiredText(binding.target, 'kind', errors, filePath);
    const identifiers = Array.isArray(binding.target.identifiers) ? binding.target.identifiers : [];
    if (binding.status === 'active' && identifiers.length === 0) {
      errors.push(issue('error', 'TARGET_IDENTITY_REQUIRED', filePath, `${field}.target.identifiers`, 'active binding needs target identity evidence'));
    }
    identifiers.forEach((identifier, identifierIndex) => validateIdentifier(
      identifier,
      `${field}.target.identifiers[${identifierIndex}]`,
      errors,
      filePath,
    ));
  }

  if (binding.selection !== undefined) {
    if (!isObject(binding.selection)) {
      errors.push(issue('error', 'INVALID_SELECTION', filePath, `${field}.selection`, 'selection must be an object'));
    } else {
      requiredText(binding.selection, 'group', errors, filePath);
      requiredText(binding.selection, 'mode', errors, filePath);
      if (hasText(binding.selection.mode)) {
        validateEnum(binding.selection.mode, SELECTION_MODES, `${field}.selection.mode`, errors, filePath);
      }
      if (!isObject(binding.selection.selector)) {
        errors.push(issue('error', 'SELECTOR_REQUIRED', filePath, `${field}.selection.selector`, 'selector must be an object'));
      } else {
        requiredText(binding.selection.selector, 'type', errors, filePath);
        requiredText(binding.selection.selector, 'name', errors, filePath);
        requiredText(binding.selection.selector, 'value', errors, filePath);
      }
      validateEnum(
        binding.selection.dataRelationship,
        DATA_RELATIONSHIPS,
        `${field}.selection.dataRelationship`,
        errors,
        filePath,
      );
      if (binding.selection.dataRelationship === 'unknown') {
        warnings.push(issue(
          'warning',
          'DATA_RELATIONSHIP_UNKNOWN',
          filePath,
          `${field}.selection.dataRelationship`,
          'document whether selectable backends are independent, mirrored, migrating, or shared before switching',
        ));
      }
      if (!hasText(binding.selection.switchProcedure)) {
        warnings.push(issue(
          'warning',
          'SWITCH_PROCEDURE_MISSING',
          filePath,
          `${field}.selection.switchProcedure`,
          'selectable binding should document the switch procedure',
        ));
      }
    }
  }

  if (!isObject(binding.dataAuthority)) {
    errors.push(issue('error', 'DATA_AUTHORITY_REQUIRED', filePath, `${field}.dataAuthority`, 'dataAuthority must be an object'));
  } else {
    validateEnum(binding.dataAuthority.mode, DATA_AUTHORITY_MODES, `${field}.dataAuthority.mode`, errors, filePath);
  }

  const environmentContract = Array.isArray(binding.environmentContract) ? binding.environmentContract : [];
  if (!Array.isArray(binding.environmentContract)) {
    errors.push(issue('error', 'ENVIRONMENT_CONTRACT_REQUIRED', filePath, `${field}.environmentContract`, 'environmentContract must be an array'));
  }
  const environmentNames = new Set();
  environmentContract.forEach((entry, entryIndex) => {
    const entryField = `${field}.environmentContract[${entryIndex}]`;
    if (!isObject(entry)) {
      errors.push(issue('error', 'INVALID_ENVIRONMENT_ENTRY', filePath, entryField, 'environment entry must be an object'));
      return;
    }
    const name = requiredText(entry, 'name', errors, filePath);
    validateEnum(entry.classification, ENVIRONMENT_CLASSIFICATIONS, `${entryField}.classification`, errors, filePath);
    requiredText(entry, 'sourceRef', errors, filePath);
    if (name && environmentNames.has(name)) {
      errors.push(issue('error', 'DUPLICATE_ENVIRONMENT_NAME', filePath, `${entryField}.name`, 'environment variable name must be unique within a binding'));
    }
    environmentNames.add(name);
  });

  const accountProfiles = new Set((account?.automationProfiles || []).map((profile) => profile.profileId));
  const automation = Array.isArray(binding.automation) ? binding.automation : [];
  if (!Array.isArray(binding.automation)) {
    errors.push(issue('error', 'BINDING_AUTOMATION_REQUIRED', filePath, `${field}.automation`, 'automation must be an array'));
  }
  automation.forEach((entry, entryIndex) => {
    const entryField = `${field}.automation[${entryIndex}]`;
    if (!isObject(entry)) {
      errors.push(issue('error', 'INVALID_BINDING_AUTOMATION', filePath, entryField, 'automation entry must be an object'));
      return;
    }
    const profileRef = requiredText(entry, 'profileRef', errors, filePath);
    if (profileRef && !accountProfiles.has(profileRef)) {
      const target = binding.status === 'active' && entry.status !== 'planned' ? errors : warnings;
      target.push(issue(
        target === errors ? 'error' : 'warning',
        'AUTOMATION_PROFILE_UNRESOLVED',
        filePath,
        `${entryField}.profileRef`,
        `automation profile ${profileRef} is not declared by ${accountRef}`,
      ));
    }
  });
}

export function validateDeveloperServicesProject(record, options = {}) {
  const filePath = options.filePath || '';
  const accountsByRef = options.accountsByRef || new Map();
  const errors = scanForSecretMaterial(record, { filePath });
  const warnings = [];

  if (!isObject(record)) {
    errors.push(issue('error', 'INVALID_RECORD', filePath, '', 'project inventory must be a JSON object'));
    return { valid: false, errors, warnings };
  }
  if (record.schemaVersion !== 1) {
    errors.push(issue('error', 'SCHEMA_VERSION', filePath, 'schemaVersion', 'schemaVersion must be 1'));
  }
  if (record.recordType !== 'developer-services-project') {
    errors.push(issue(
      'error',
      'RECORD_TYPE',
      filePath,
      'recordType',
      'recordType must be developer-services-project',
    ));
  }
  if (!isObject(record.project)) {
    errors.push(issue('error', 'PROJECT_REQUIRED', filePath, 'project', 'project must be an object'));
  } else {
    const projectId = requiredText(record.project, 'id', errors, filePath);
    requiredText(record.project, 'repository', errors, filePath);
    if (projectId && !RECORD_ID_PATTERN.test(projectId)) {
      errors.push(issue('error', 'PROJECT_ID_FORMAT', filePath, 'project.id', 'project.id must be a stable lowercase identifier'));
    }
  }

  const bindings = Array.isArray(record.serviceBindings) ? record.serviceBindings : [];
  if (!Array.isArray(record.serviceBindings)) {
    errors.push(issue('error', 'SERVICE_BINDINGS_REQUIRED', filePath, 'serviceBindings', 'serviceBindings must be an array'));
  }
  const bindingIds = new Set();
  const fingerprints = new Map();
  const accountRefs = new Set();
  bindings.forEach((binding, index) => {
    const account = accountsByRef.get(binding?.accountRef);
    validateBinding(binding, index, account, errors, warnings, filePath);
    if (hasText(binding?.bindingId)) {
      if (bindingIds.has(binding.bindingId)) {
        errors.push(issue('error', 'DUPLICATE_BINDING_ID', filePath, `serviceBindings[${index}].bindingId`, 'bindingId must be unique'));
      }
      bindingIds.add(binding.bindingId);
    }
    if (hasText(binding?.accountRef)) {
      accountRefs.add(binding.accountRef);
      if (!account) {
        const target = binding.status === 'active' ? errors : warnings;
        target.push(issue(
          target === errors ? 'error' : 'warning',
          'ACCOUNT_REF_UNRESOLVED',
          filePath,
          `serviceBindings[${index}].accountRef`,
          `account record ${binding.accountRef} was not found`,
        ));
      }
    }
    const fingerprint = targetFingerprint(binding);
    if (fingerprints.has(fingerprint)) {
      errors.push(issue(
        'error',
        'DUPLICATE_BINDING_TARGET',
        filePath,
        `serviceBindings[${index}]`,
        `binding duplicates target declared by ${fingerprints.get(fingerprint)}`,
      ));
    } else {
      fingerprints.set(fingerprint, binding?.bindingId || `index-${index}`);
    }
  });

  const sameProviderEnvironment = new Map();
  for (const binding of bindings.filter((item) => item?.status !== 'retired')) {
    const key = `${binding?.provider || ''}:${binding?.environment || ''}`;
    if (!sameProviderEnvironment.has(key)) sameProviderEnvironment.set(key, []);
    sameProviderEnvironment.get(key).push(binding);
  }
  for (const group of sameProviderEnvironment.values()) {
    if (group.length < 2) continue;
    const withoutSelection = group.filter((binding) => !hasText(binding?.selection?.group));
    if (withoutSelection.length > 0) {
      warnings.push(issue(
        'warning',
        'MULTIPLE_BINDINGS_WITHOUT_SELECTION',
        filePath,
        'serviceBindings',
        `multiple ${group[0]?.provider} bindings share environment ${group[0]?.environment}; declare selection.group when they are intentional alternatives`,
      ));
    }
  }

  const selectionGroups = new Map();
  for (const binding of bindings.filter((item) => hasText(item?.selection?.group) && item?.status !== 'retired')) {
    const group = binding.selection.group;
    if (!selectionGroups.has(group)) selectionGroups.set(group, []);
    selectionGroups.get(group).push(binding);
  }
  for (const [groupName, group] of selectionGroups) {
    if (group.length < 2) {
      warnings.push(issue(
        'warning',
        'SELECTION_GROUP_SINGLETON',
        filePath,
        'serviceBindings',
        `selection group ${groupName} has only one active binding`,
      ));
    }
    const selectors = new Set();
    let defaults = 0;
    for (const binding of group) {
      const selector = selectorFingerprint(binding.selection);
      if (selectors.has(selector)) {
        errors.push(issue(
          'error',
          'DUPLICATE_SELECTION_SELECTOR',
          filePath,
          'serviceBindings',
          `selection group ${groupName} repeats selector ${selector}`,
        ));
      }
      selectors.add(selector);
      if (binding.selection.default === true) defaults += 1;
    }
    if (defaults > 1) {
      errors.push(issue(
        'error',
        'MULTIPLE_SELECTION_DEFAULTS',
        filePath,
        'serviceBindings',
        `selection group ${groupName} has more than one default binding`,
      ));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      bindings: bindings.length,
      accounts: accountRefs.size,
      selectionGroups: selectionGroups.size,
    },
  };
}

export function validateCrossProjectResources(projects, options = {}) {
  const errors = [];
  const warnings = [];
  const resources = new Map();
  for (const project of projects) {
    for (const binding of project.record?.serviceBindings || []) {
      for (const resource of binding.resources || []) {
        if (!hasText(resource?.resourceRef)) continue;
        const identity = [
          binding.provider,
          binding.accountRef,
          resource.type,
          resource.id || `@${resource.idSourceRef || ''}`,
        ].join('::');
        const prior = resources.get(resource.resourceRef);
        if (prior && prior.identity !== identity) {
          errors.push(issue(
            'error',
            'RESOURCE_REF_CONFLICT',
            project.filePath,
            'serviceBindings.resources',
            `resourceRef ${resource.resourceRef} identifies different resources in ${prior.projectId} and ${project.record?.project?.id}`,
          ));
        } else if (!prior) {
          resources.set(resource.resourceRef, {
            identity,
            projectId: project.record?.project?.id || '',
          });
        }
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
