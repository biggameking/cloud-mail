const BUNDLE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9][A-Za-z0-9-]*)+$/;

export const REQUIRED_DISPOSABLE_REASONS = [
  'clean-device-state',
  'destructive-device-state',
  'identity-sensitive',
  'parallel-ui-worker',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isExampleValue(value) {
  return /replace[-_ ]|(^|\.)example(\.|$)/i.test(String(value || ''));
}

function addIssue(issues, path, message) {
  issues.push({ path, message });
}

function validateBundleId(issues, path, value) {
  if (!nonEmptyString(value) || !BUNDLE_ID_RE.test(value)) {
    addIssue(issues, path, 'must be an exact reverse-DNS bundle identifier');
  } else if (isExampleValue(value)) {
    addIssue(issues, path, 'must replace the template example with the project bundle identifier');
  }
}

export function validateIosSimulatorProfile(profile) {
  const issues = [];
  if (!isRecord(profile)) return { valid: false, issues: [{ path: '$', message: 'must be a JSON object' }] };

  if (profile.schemaVersion !== 1) addIssue(issues, 'schemaVersion', 'must equal 1');
  if (!nonEmptyString(profile.projectId) || isExampleValue(profile.projectId)) addIssue(issues, 'projectId', 'must be a stable project identifier, not a template placeholder');

  const simulator = profile.simulator;
  if (!isRecord(simulator)) {
    addIssue(issues, 'simulator', 'must be an object');
    return { valid: false, issues };
  }

  if (simulator.steadyState !== 'one-persistent-device') {
    addIssue(issues, 'simulator.steadyState', 'must equal one-persistent-device');
  }

  const selector = simulator.deviceSelector;
  if (!isRecord(selector)) addIssue(issues, 'simulator.deviceSelector', 'must be an object');
  else {
    if (!nonEmptyString(selector.name) || isExampleValue(selector.name)) addIssue(issues, 'simulator.deviceSelector.name', 'must name the project device, not a template placeholder');
    if (!nonEmptyString(selector.runtime) || isExampleValue(selector.runtime)) addIssue(issues, 'simulator.deviceSelector.runtime', 'must name the Simulator runtime, not a template placeholder');
  }

  const manual = simulator.manualAcceptance;
  if (!isRecord(manual)) addIssue(issues, 'simulator.manualAcceptance', 'must be an object');
  else {
    validateBundleId(issues, 'simulator.manualAcceptance.bundleId', manual.bundleId);
    if (!nonEmptyString(manual.scheme) || isExampleValue(manual.scheme)) addIssue(issues, 'simulator.manualAcceptance.scheme', 'must name the manual acceptance scheme, not a template placeholder');
    if (manual.preserveAppData !== true) addIssue(issues, 'simulator.manualAcceptance.preserveAppData', 'must equal true');
  }

  const automation = simulator.automation;
  if (!isRecord(automation)) addIssue(issues, 'simulator.automation', 'must be an object');
  else {
    validateBundleId(issues, 'simulator.automation.appBundleId', automation.appBundleId);
    if (!nonEmptyString(automation.scheme) || isExampleValue(automation.scheme)) addIssue(issues, 'simulator.automation.scheme', 'must name the automation scheme, not a template placeholder');
    if (automation.destination !== 'same-device') addIssue(issues, 'simulator.automation.destination', 'must equal same-device');
    if (automation.mutationScope !== 'app-container-only') addIssue(issues, 'simulator.automation.mutationScope', 'must equal app-container-only');
    if (automation.parallelUiWorkers !== 1) addIssue(issues, 'simulator.automation.parallelUiWorkers', 'must equal 1 on the persistent device');
    if (!Array.isArray(automation.runnerBundleIds) || automation.runnerBundleIds.length === 0) {
      addIssue(issues, 'simulator.automation.runnerBundleIds', 'must contain every exact UI-test runner bundle identifier');
    } else {
      automation.runnerBundleIds.forEach((bundleId, index) => validateBundleId(issues, `simulator.automation.runnerBundleIds[${index}]`, bundleId));
    }
  }

  if (manual?.bundleId && automation?.appBundleId && manual.bundleId === automation.appBundleId) {
    addIssue(issues, 'simulator.automation.appBundleId', 'must differ from the manual acceptance bundle identifier');
  }

  const allowlist = simulator.bundleAllowlist;
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    addIssue(issues, 'simulator.bundleAllowlist', 'must list every project-owned app, runner, widget, and extension installed on the device');
  } else {
    const seen = new Set();
    const allowedRoles = new Set(['manual-app', 'automation-app', 'ui-test-runner', 'extension']);
    allowlist.forEach((entry, index) => {
      const entryPath = `simulator.bundleAllowlist[${index}]`;
      if (!isRecord(entry)) {
        addIssue(issues, entryPath, 'must be an object');
        return;
      }
      validateBundleId(issues, `${entryPath}.bundleId`, entry.bundleId);
      if (!allowedRoles.has(entry.role)) addIssue(issues, `${entryPath}.role`, 'must be manual-app, automation-app, ui-test-runner, or extension');
      if (seen.has(entry.bundleId)) addIssue(issues, `${entryPath}.bundleId`, 'must not be duplicated');
      seen.add(entry.bundleId);
    });

    const hasRole = (bundleId, role) => allowlist.some((entry) => entry?.bundleId === bundleId && entry?.role === role);
    if (manual?.bundleId && !hasRole(manual.bundleId, 'manual-app')) {
      addIssue(issues, 'simulator.bundleAllowlist', 'must include the manual acceptance bundle with role manual-app');
    }
    if (automation?.appBundleId && !hasRole(automation.appBundleId, 'automation-app')) {
      addIssue(issues, 'simulator.bundleAllowlist', 'must include the automation bundle with role automation-app');
    }
    for (const runner of automation?.runnerBundleIds || []) {
      if (!hasRole(runner, 'ui-test-runner')) {
        addIssue(issues, 'simulator.bundleAllowlist', `must include runner ${runner} with role ui-test-runner`);
      }
    }
  }

  const exceptions = simulator.disposableDeviceRequiredFor;
  if (!Array.isArray(exceptions)) addIssue(issues, 'simulator.disposableDeviceRequiredFor', 'must be an array');
  else {
    for (const reason of REQUIRED_DISPOSABLE_REASONS) {
      if (!exceptions.includes(reason)) addIssue(issues, 'simulator.disposableDeviceRequiredFor', `must include ${reason}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function summarizeIosSimulatorProfile(profile) {
  const result = validateIosSimulatorProfile(profile);
  return {
    valid: result.valid,
    projectId: profile?.projectId || null,
    device: profile?.simulator?.deviceSelector || null,
    manualBundleId: profile?.simulator?.manualAcceptance?.bundleId || null,
    automationBundleId: profile?.simulator?.automation?.appBundleId || null,
    automationDestination: profile?.simulator?.automation?.destination || null,
    bundleAllowlistCount: Array.isArray(profile?.simulator?.bundleAllowlist) ? profile.simulator.bundleAllowlist.length : 0,
    issues: result.issues,
  };
}
