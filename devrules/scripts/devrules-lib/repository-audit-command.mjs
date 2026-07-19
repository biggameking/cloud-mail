import path from 'node:path';

import {
  auditTemplateContent,
  formatTemplateContentAudit,
  templateContentAuditIssue,
} from './template-content-audit.mjs';

export async function runRepositoryAuditCommand(options, context) {
  if (!options.repo) throw new Error('audit requires --repo <dir>');
  const repo = path.resolve(String(options.repo));
  const templateContent = (await context.isSharedTemplateRoot(repo))
    ? null
    : await auditTemplateContent({
      repoPath: repo,
      templateRoot: context.templateRoot,
      directoryNames: context.directoryNames,
      rootFiles: context.rootFiles,
    });
  const result = await context.auditRepo(repo);
  if (templateContent) {
    result.templateContent = templateContent;
    const issue = templateContentAuditIssue(templateContent);
    result.templateIssues = issue ? [issue] : [];
  }
  context.output(result, options, (data) => {
    console.log(`Audit: ${data.repo}`);
    if (data.templateContent) {
      for (const line of formatTemplateContentAudit(data.templateContent)) console.log(line);
      for (const issue of data.templateIssues || []) {
        console.log(`- [template ${issue.severity}] ${issue.message}`);
      }
    }
    if (data.templateMode) {
      console.log(`Mode: shared template (${data.auditScope === 'local-content' ? 'local content/schema' : data.auditScope || 'content'})`);
      if (data.releaseStateChecked === false) {
        console.log(`Release state: not checked (use ${data.releaseAuditCommand || 'devrules template release-audit'})`);
      }
    } else {
      console.log(`Adoption profile: ${data.adoptionProfile || 'unselected'}`);
      console.log(`Observed adoption level: ${data.maturityLevel}`);
    }
    if (!data.issues.length) {
      console.log('No issues found.');
    } else {
      for (const issue of data.issues) console.log(`- [${issue.severity}] ${issue.message}`);
    }
    if (data.recommendations?.length) {
      console.log('Recommendations:');
      for (const recommendation of data.recommendations) {
        console.log(`- [level ${recommendation.level}] ${recommendation.message}`);
      }
    }
  });
  return result;
}
