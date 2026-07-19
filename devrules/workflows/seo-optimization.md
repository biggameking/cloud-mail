---
description: Generic SEO/AEO/GEO workflow for web products and content surfaces.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# SEO/AEO/GEO Optimization Workflow

Use this workflow when improving discoverability for search engines, answer engines, or AI citation surfaces.

## Definitions

| Type | Goal |
| --- | --- |
| SEO | Improve search engine crawling, ranking, snippets, and click-through. |
| AEO | Make content directly answerable by answer engines and featured snippets. |
| GEO | Make content trustworthy and citeable by generative AI systems. |

## Phase 1: Project Fit

Identify:

- Target pages or routes.
- Audience and search intent.
- Primary market/language.
- Framework and rendering mode.
- Whether pages are static, server-rendered, client-rendered, or hybrid.

## Phase 2: Technical Foundation

Check:

- Unique title and description.
- Canonical URL.
- Open Graph and social metadata.
- `robots.txt` and sitemap.
- Structured data where appropriate.
- Crawlable content without requiring user login.
- Performance basics for Core Web Vitals.
- Locale alternates for multilingual sites.

## Phase 3: Content Structure

For answerability:

- Put the direct answer near the top.
- Use clear headings.
- Include concise definitions, steps, comparisons, and FAQs where useful.
- Avoid hiding critical content behind client-only rendering when indexing matters.

For citation:

- Include author, date, source, methodology, examples, or evidence where relevant.
- Keep claims specific and verifiable.
- Avoid generic filler content.

## Phase 4: Schema Selection

Choose schema based on page type:

| Page type | Possible schema |
| --- | --- |
| Article or guide | `Article`, `BlogPosting`, `HowTo`, `FAQPage` |
| Product or SaaS page | `Product`, `SoftwareApplication`, `Organization` |
| Documentation | `TechArticle`, `BreadcrumbList` |
| Local business or venue | `LocalBusiness`, `Place` |
| Video or media | `VideoObject`, `ImageObject` |

Use only schema that matches visible page content.

## Phase 5: Validation

Run relevant checks:

- Inspect rendered HTML metadata.
- Validate structured data.
- Generate or verify sitemap.
- Check canonical and locale alternates.
- Run a browser smoke test for the target page.
- Verify content is accessible in the rendered HTML where SEO matters.

## Content Brief Template

```markdown
# Page or Article Title

## Intent

What question or need this page answers.

## Audience

Who the page is for.

## Primary Queries

- Query 1
- Query 2

## Structure

- Direct answer
- Context
- Steps or comparison
- Examples
- FAQ

## Required Metadata

- Title:
- Description:
- Canonical:
- Schema:
```

## Memory Update

Record reusable SEO patterns in project lessons. Cross-project improvements belong in evolution suggestions.

Last updated: 2026-06-11
