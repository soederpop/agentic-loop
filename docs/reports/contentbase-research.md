---
tags: []
status: planning
relatedReports: []
---

# Contentbase research

## Goal
Research github.com/soederpop/contentbase to understand what it is, how it works, whether it is unique, competitors/adjacent tools, and what can be built with it. Prefer primary sources and concrete architectural details.

## Research questions
- What is Contentbase and how does it work technically?
- What capabilities and examples does the repo show?
- What competing or adjacent projects exist in the content-as-data / markdown-as-database / local-first content indexing space, and how does Contentbase compare?
- Based on Contentbase capabilities, what realistic applications, products, or internal tools could be built with it?

## Findings

### 1) What Contentbase is
Contentbase describes itself as “An ORM for your Markdown.” More concretely, it treats a folder of Markdown and MDX files as a typed, queryable database. You define models with Zod schemas, extract structured data from document sections, traverse relationships between documents, validate content, and query everything through a fluent API.[1][2][3]

This is not just a parser library. It spans:
- a TypeScript library for modeling/querying markdown collections,[2][6][8]
- a CLI (`cnotes` / `contentbase`) for creating, validating, extracting, serving, searching, and teaching from a collection,[4][9]
- an HTTP API and MCP server layer for exposing the collection to apps and AI tools.[3][9]

### 2) The problem it is trying to solve
The README frames the pain clearly: teams already keep important knowledge in Markdown—specs, runbooks, stories, docs, design decisions—but once they need to query across files, validate frontmatter, or extract structure from headings/lists, they end up writing brittle one-off scripts.[3]

Contentbase tries to make markdown content behave like an application data layer without moving that content into a traditional database or CMS. Its value proposition is basically:
- keep markdown/MDX as the source of truth,
- add types and validation with Zod,
- derive structure from document conventions (headings, lists, file paths, frontmatter),
- expose the result as queryable domain models.[2][3][6][8]

### 3) How it works technically
At the collection level, Contentbase recursively loads `.md` / `.mdx` files from a root path, parses frontmatter with `gray-matter`, stores metadata/content/file stats, and lazily creates `Document` instances when accessed.[4]

At the document level, it uses the unified/remark ecosystem to parse Markdown into MDAST, then exposes:
- AST querying via `AstQuery`,
- node shortcuts for headings/links/tables/code blocks,
- section extraction by heading,
- immutable or mutable section edits (`removeSection`, `replaceSectionContent`, `appendToSection`, etc.),
- serialization and persistence back to disk.[7]

At the model level, `defineModel()` creates model definitions with:
- `prefix`-based matching,
- Zod `meta` schemas,
- `sections` for typed data extracted from headings,
- `relationships` (`hasMany`, `belongsTo`),
- `computed` values,
- reusable `scopes`,
- path `pattern` inference,
- `exclude` patterns,
- optional generated descriptions.[6]

At runtime, `createModelInstance()` merges defaults + path-pattern metadata + frontmatter, parses metadata through Zod, lazily extracts section data, attaches relationship accessors, computes derived properties, validates meta/sections, and serializes instances to JSON.[8]

So the core architecture is roughly:
1. file tree -> collection items,
2. markdown/frontmatter -> documents + AST,
3. model definitions -> typed instances,
4. fluent queries / JSON DSL / HTTP / MCP -> consumable interfaces.[3][4][6][7][8][9]

### 4) What feels distinctive or genuinely interesting
A few things stand out as more unusual than ordinary “content in files” tooling:

#### a) It treats headings and sections as schema-backed data
A heading like `## Acceptance Criteria` can become a typed property such as `string[]`, extracted from list items below that heading and validated with Zod.[2][3]

That is more structured than ordinary frontmatter-centric tools. Many systems validate frontmatter; fewer treat the body itself as queryable structured data with typed extractors.

#### b) It derives relationships from document structure
`hasMany()` can interpret subheadings under a parent heading as child documents, and `belongsTo()` can resolve parent references from frontmatter. This gives a lightweight relational model over markdown collections without requiring a separate DB schema or explicit IDs everywhere.[2][3][8]

#### c) It combines library, CLI, HTTP API, and MCP server in one package
A lot of markdown tooling stops at build-time transforms. Contentbase also exposes the collection operationally: validate it, serve it, query it over JSON, run actions, generate LLM context, expose it via MCP, and even run semantic search.[3][9]

#### d) It treats markdown as editable structured content, not only as publishable pages
The `Document` API supports section replacement, insertion, extraction, and saving, which opens up workflow automation and content refactoring use cases beyond static site generation.[7]

### 5) Is it unique?
Short answer: **not completely unique in ingredients, but fairly unique in combination**.

Contentbase is not the only tool that offers typed content schemas, markdown-in-files workflows, or content APIs. But its particular bundle is unusual:
- typed markdown/MDX modeling with Zod,[2][6]
- body-section extraction into typed fields,[2][3]
- relationship modeling across documents,[2][3][8]
- AST querying and mutation,[7]
- fluent query builder plus JSON query DSL,[3]
- semantic search over the same contentbase,[3]
- CLI + REST + MCP interfaces.[3][9]

That combination makes it feel less like a CMS and less like a static site generator plugin, and more like a **local-first content runtime / markdown database toolkit**.

So I would describe it as **distinctive** rather than totally category-defining. It pulls together concepts that exist elsewhere, but in a way that is uncommon and potentially powerful.

### 6) Competitors and adjacent tools
The closest comparisons are mostly adjacent rather than exact substitutes.

#### Contentlayer
Contentlayer is probably the nearest technical cousin in spirit. It positions itself as a content SDK that validates and transforms content into type-safe JSON data you can import into apps.[10]

Where Contentlayer overlaps:
- type-safe content models,
- markdown as source material,
- validation and generated types.[10]

Where Contentbase seems broader/different:
- Contentbase emphasizes queryability, relationships, AST extraction, runtime document operations, REST/MCP serving, and CLI workflows.[3][7][9]
- Contentlayer is more centered on build-time app integration and importing generated data into your app bundle.[10]

#### Keystatic
Keystatic is a codebase-native CMS for Markdown/JSON/YAML with TypeScript API and no database.[11]

Overlap:
- file-based content,
- no separate DB,
- strong dev workflow story.[11]

Difference:
- Keystatic is mainly about editorial UX and admin UI for humans.[11]
- Contentbase is mainly about treating markdown as a structured/queryable runtime data layer, including AST and agent-facing APIs.[3][7][9]

#### Decap CMS
Decap CMS is another Git-based CMS for static-site workflows.[12]

Overlap:
- content stored in Git,
- markdown-centric workflows.[12]

Difference:
- Decap is primarily an editor/admin layer for content teams.[12]
- Contentbase is primarily a modeling/querying/automation layer for developers and systems.[3][9]

#### Docusaurus / Eleventy
These are not direct competitors, but important adjacent tools because many teams use them to organize markdown docs.[13][14]

Overlap:
- markdown collections,
- frontmatter and content structure,
- site/documentation generation.[13][14]

Difference:
- they are publishing frameworks/site generators first,[13][14]
- while Contentbase is trying to make markdown behave like application data and operational content infrastructure.[3][9]

### 7) Where Contentbase appears stronger than the adjacent field
Relative to the tools above, Contentbase looks strongest when you want markdown to be:
- **typed**, not just rendered,[2][6]
- **queryable**, not just imported or published,[3]
- **structurally extracted from headings/body**, not just frontmatter-driven,[2][7]
- **served to other systems or agents**, not only built into a website.[3][9]

That makes it especially interesting for internal knowledge systems, product/process documentation, AI context pipelines, and ops/document-driven workflows.

### 8) Where it is weaker or less mature than established competitors
There are also clear limits:
- It is early-stage/small by visible adoption signals (small repo/community footprint compared with Contentlayer, Docusaurus, Keystatic, etc.).[1][10][11]
- It appears centered on the author/developer workflow rather than polished editor UX for non-technical users.[3][9][11][12]
- Its ecosystem is smaller and more bespoke than established static-site/content ecosystems.[1][10][13][14]
- It depends heavily on conventions you define yourself—great for flexibility, but that means more schema/design work than opinionated CMSes.[3][6]

So if the question is “is it more mature than competitors?” the answer is clearly no. If the question is “does it combine capabilities in a novel way?” then yes, fairly so.

### 9) What you could realistically build with it
Here are the strongest practical categories.

#### a) A docs/knowledge API over markdown
Use markdown files as the canonical source for engineering docs, playbooks, or policies, and expose them through:
- REST endpoints,
- query DSL,
- semantic search,
- MCP tools for agents.[3][9]

This could power internal search portals, support copilots, or docs-aware assistants.

#### b) Product/spec systems
The examples in the README strongly fit epics/stories/acceptance criteria. You could model:
- epics,
- stories,
- requirements,
- ADRs,
- goals,
- plans,
- reports,
all in markdown, then query relationships and validate that required fields/sections exist.[2][3][5]

This is especially compelling for teams that already do product/process work in docs but want more structure without moving to Jira/Notion/custom DB.

#### c) LLM/agent context infrastructure
The `teach`, `extract`, `serve`, and `mcp` features are strong signals here.[3][9]
You could build:
- agent-readable knowledge bases,
- project memory systems,
- prompt context packers,
- retrieval pipelines over trusted markdown content,
- human-maintained “source of truth” docs that AI agents can query safely.

This may actually be one of its most natural use cases.

#### d) Lightweight internal CMS / content ops backend
Because it supports CRUD-ish document serving, validation, actions, and semantic/text search, you could use it as the backend for a lightweight internal publishing tool or documentation console—especially if you build your own UI on top of its REST API.[3][7][9]

#### e) Structured reporting and synthesis systems
Because you can define models like `Report`, `Idea`, `Tutorial`, `Example`, etc., and then export/query them, you could build:
- research repositories,
- decision logs,
- innovation backlogs,
- due-diligence/report archives,
- reusable case-study libraries.[5]

#### f) Migration and refactoring tools for markdown corpora
The AST and section mutation APIs make it plausible to build automated cleanup/refactor tools:
- normalize headings,
- split/merge sections,
- enforce templates,
- backfill default metadata,
- generate combined extracts or summaries.[7][9]

### 10) Best-fit users
Contentbase seems best suited for:
- technical teams who already keep lots of process/product knowledge in markdown,
- teams that want typed validation and queries without moving to a CMS/database,
- AI/agent-heavy workflows where markdown should be both human-authored and machine-queryable,
- internal tool builders who want a local-first content backend.

It seems less ideal for:
- marketing/editorial teams needing polished non-technical authoring UI out of the box,
- teams that primarily need a static site generator rather than a content runtime,
- organizations wanting a large ecosystem and battle-tested enterprise CMS conventions.[11][12][13][14]

### 11) Bottom line
Contentbase is best understood as a **markdown-native structured data layer**: part ORM, part AST toolkit, part CLI, part API server, part AI-facing content backend.[2][3][7][9]

It is **not fully unique**, because typed content tools, Git-backed CMSes, and markdown site systems already exist.[10][11][12][13][14]
But it **is unusual in how many of those ideas it combines in one coherent package**, especially:
- schema-validated frontmatter,
- typed extraction from body sections,
- relationships between docs,
- query DSL,
- semantic search,
- REST + MCP serving.[3]

If it matures, its strongest niche is probably: **turning markdown collections into a real operational knowledge/database layer for developers and AI systems**.

## Caveats
- I did not find evidence of broad market adoption yet; the repo looks early and relatively small.[1]
- The parallel research job failed due to tool-call execution issues, so this report is based on direct manual inspection of sources rather than forked subresearch output.

## Sources
[1] Contentbase GitHub repository overview
[2] Contentbase README overview
[3] Contentbase README detailed docs
[4] Contentbase package.json
[5] Contentbase example models.ts
[6] Contentbase src/define-model.ts
[7] Contentbase src/document.ts
[8] Contentbase src/model-instance.ts
[9] Contentbase CLI reference
[10] Contentlayer homepage
[11] Keystatic homepage
[12] Decap CMS homepage
[13] Docusaurus docs introduction
[14] Eleventy data/docs page
