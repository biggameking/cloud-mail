import path from 'node:path';

import { inspectGitPublishReadiness } from './git-publish-readiness.mjs';

export async function runGitPublishReadinessCommand(options, templateRoot, templateManifest, output) {
  if (!options.repo) throw new Error('repo publish-readiness requires --repo <dir>');
  const repo = path.resolve(String(options.repo));
  const result = await inspectGitPublishReadiness(repo, {
    fetch: options.fetch === true,
    verifyHost: options['verify-host'] === true,
    defaultBranch: options['default-branch'] || '',
    wipBranches: options['wip-branches'] || '',
    accountsDir: path.resolve(String(
      options.accounts || path.join(templateRoot, 'registry', 'developer-account-records'),
    )),
    templateBinding: repo === path.resolve(templateRoot)
      ? templateManifest.gitHosting
      : null,
  });
  output(result, options, (data) => {
    console.log(`Git publish readiness: ${data.status}`);
    console.log(`Repository: ${data.repo}`);
    console.log(`Branch: ${data.branches?.current || 'DETACHED'} (default=${data.branches?.default || 'unknown'})`);
    console.log(`Worktree: dirty=${data.repository?.dirtyCount || 0}, untracked=${data.hygiene?.untracked?.length || 0}`);
    if (data.hosting?.kind === 'github') {
      console.log(`GitHub: ${data.hosting.github.nameWithOwner} via ${data.hosting.binding?.binding?.accountRef || 'UNBOUND'}`);
    }
    for (const reason of data.blockingReasons || []) console.log(`- BLOCK: ${reason}`);
    for (const reason of data.reviewReasons || []) console.log(`- REVIEW: ${reason}`);
    for (const action of data.actions || []) console.log(`  action: ${action}`);
  });
  if (!result.ready) process.exitCode = 1;
  return result;
}
