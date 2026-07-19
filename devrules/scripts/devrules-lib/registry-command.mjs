import path from 'node:path';
import { nowIso, writeTextIfChanged } from './fs-actions.mjs';
import { withFileLock } from './safe-files.mjs';
import { workspaceRootStatus } from './workspace-runtime.mjs';
import {
  buildRegistry,
  mergeRegistryAuthorityRecords,
  readRegistryAuthorityRecord,
  registryRecordId,
  validateRegistryAuthorityRecords,
  writeRegistryAuthorityRecords,
} from './device-registry.mjs';

export async function commandRegistryInspect(options, context) {
  const { root } = await context.workspaceOptions(options);
  const currentRegistry = await buildRegistry(root, context);
  const registryDir = path.join(context.templateRoot, 'registry');
  const merged = await mergeRegistryAuthorityRecords(registryDir, currentRegistry);
  const registry = {
    ...currentRegistry,
    devices: merged.devices,
    projects: merged.projects,
  };
  context.output({ root, registry }, options, (data) => {
    console.log(`Registry inspect for ${data.root}`);
    console.log(`Devices: ${data.registry.devices.devices.length}`);
    console.log(`Projects: ${data.registry.projects.projects.length}`);
    console.log(`Skills: ${data.registry.skills.totalSkills}`);
    console.log(`Needs review: ${data.registry.projects.summary.needsReview}`);
  });
}

export async function commandRegistryRefresh(options, context) {
  const apply = context.isApply(options);
  const { root } = await context.workspaceOptions(options);
  const rootStatus = await workspaceRootStatus(root);
  if (!rootStatus.available) throw new Error(`workspace root is unavailable: ${root} (${rootStatus.reason})`);
  const registry = await buildRegistry(root, context);
  const registryDir = path.join(context.templateRoot, 'registry');
  const refresh = async () => {
    const actions = [];
    await validateRegistryAuthorityRecords(registryDir);
    await writeRegistryAuthorityRecords(registryDir, registry, apply, actions);
    const merged = await mergeRegistryAuthorityRecords(registryDir, registry, { currentOverridesRetirement: true });
    return { root, apply, actions, summary: merged.projects.summary, totalSkills: registry.skills.totalSkills };
  };
  const data = apply
    ? await withFileLock(path.join(registryDir, '.refresh.lock'), refresh)
    : await refresh();
  context.output(data, options, (value) => {
    console.log(`${value.apply ? 'Applied' : 'Dry-run'} registry refresh for ${value.root}`);
    console.log(`Projects: compliant=${value.summary.compliant}, needsReview=${value.summary.needsReview}`);
    console.log(`Skills: ${value.totalSkills}`);
    for (const action of value.actions) console.log(`- ${action.action}: ${action.path || ''} (${action.reason})`);
  });
}

export async function commandRegistryRetire(options, context) {
  const apply = context.isApply(options);
  const type = String(options.type || '');
  const id = String(options.id || '').trim();
  if (!['device', 'workspace'].includes(type)) throw new Error('registry retire requires --type device|workspace');
  if (!id) throw new Error('registry retire requires --id <id>');
  const registryDir = path.join(context.templateRoot, 'registry');
  const retire = async () => {
    const actions = [];
    await validateRegistryAuthorityRecords(registryDir);
    const recordPath = path.join(registryDir, `${type}-records`, `${registryRecordId(id)}.json`);
    const previousRecord = await readRegistryAuthorityRecord(recordPath, type, id);
    const retiredRecord = {
      ...(previousRecord || {}),
      schemaVersion: 1,
      status: 'retired',
      recordType: type,
      recordId: id,
      retiredAt: nowIso(),
    };
    await writeTextIfChanged(recordPath, `${JSON.stringify(retiredRecord, null, 2)}\n`, apply, actions, `retire ${type} authority record`);
    return { schemaVersion: 1, apply, type, id, recordPath, actions };
  };
  const result = apply
    ? await withFileLock(path.join(registryDir, '.refresh.lock'), retire)
    : await retire();
  context.output(result, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} registry retirement: ${data.type} ${data.id}`);
    for (const action of data.actions) console.log(`- ${action.action}: ${action.path || ''} (${action.reason})`);
  });
}
