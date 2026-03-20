# Contentbase Query DSL Overview

A power-user reference for querying structured markdown collections.

---

## Cheat Sheet

### Operators

| Operator | DSL Key | Builder Method | What it does |
|----------|---------|----------------|-------------|
| Equal | `$eq` (or literal) | `.where(path, value)` | Exact match (`===` or deep JSON equality) |
| Not Equal | `$neq` | `.where(path, "neq", value)` | Negation of eq |
| In | `$in` (or array literal) | `.whereIn(path, [])` | Value is one of the given array items |
| Not In | `$notIn` | `.whereNotIn(path, [])` | Value is none of the given items |
| Greater Than | `$gt` | `.whereGt(path, n)` | `actual > expected` |
| Less Than | `$lt` | `.whereLt(path, n)` | `actual < expected` |
| Greater or Equal | `$gte` | `.whereGte(path, n)` | `actual >= expected` |
| Less or Equal | `$lte` | `.whereLte(path, n)` | `actual <= expected` |
| Contains | `$contains` | `.whereContains(path, str)` | Substring match (string only) |
| Starts With | `$startsWith` | `.whereStartsWith(path, str)` | String prefix match |
| Ends With | `$endsWith` | `.whereEndsWith(path, str)` | String suffix match |
| Regex | `$regex` | `.whereRegex(path, pattern)` | Regex test (string or RegExp; max 200 chars in DSL) |
| Exists | `$exists` | `.whereExists(path)` / `.whereNotExists(path)` | Field is non-null (`true`) or null/undefined (`false`) |

### Implicit Operators (DSL shorthand)

```jsonc
// Literal value => implicit $eq
{ "meta.status": "approved" }

// Array value => implicit $in
{ "meta.status": ["approved", "pending"] }

// Operator object => explicit
{ "meta.turns": { "$gt": 10 } }

// Multiple operators on same field => AND
{ "meta.turns": { "$gte": 5, "$lte": 20 } }
```

### Query Execution Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `.fetchAll()` | `T[]` | All matching instances |
| `.first()` | `T \| undefined` | First match |
| `.last()` | `T \| undefined` | Last match |
| `.count()` | `number` | Count of matches |

### Chainable Modifiers

```typescript
collection.query(Model)
  .where(...)           // filter conditions (chainable, AND logic)
  .scope("approved")    // apply named model scope
  .include("plans")     // eager-load relationships
  .sort("meta.status", "desc")
  .limit(10)
  .offset(20)
  .fetchAll()
```

---

## The DSL Surface Area

### Two Interfaces

Contentbase exposes the same query logic through two interfaces:

1. **Programmatic (TypeScript)** -- `collection.query(Model).where(...).fetchAll()`
2. **Declarative JSON (MCP / REST)** -- a MongoDB-style object passed to `executeQueryDSL()`

The JSON shape:

```typescript
{
  model: string               // Required. Model name or unique prefix.
  where?: Record<string, any> // Filter conditions (MongoDB-style)
  sort?: Record<string, "asc"|"desc"> | Array<{path, direction}>
  select?: string[]           // Field whitelist for output
  related?: string[]          // Relationship names to eager-load
  scopes?: string[]           // Named scopes to apply before filters
  limit?: number              // Result cap (>= 0, integer)
  offset?: number             // Skip count (>= 0, integer)
  method?: "fetchAll" | "first" | "last" | "count"  // default: fetchAll
}
```

### What You Can Query On

| Path Pattern | Example | Accesses |
|-------------|---------|----------|
| `meta.<field>` | `meta.status` | Frontmatter YAML fields |
| `title` | `title` | Document title (H1 / filename) |
| `id` | `id` | Document path ID (`tasks/one-off/my-task`) |
| `sections.<name>` | `sections.verification` | Extracted section data |
| `computed.<name>` | `computed.executionOrder` | Computed properties |
| Nested dot paths | `meta.inputs.name.type` | Arbitrary depth traversal |

Path resolution uses `path.split(".").reduce((acc, key) => acc?.[key], instance)` -- null-safe via optional chaining.

### Boolean Logic

All `where` conditions are **AND**-combined. There is no explicit `$or` operator. To achieve OR semantics, run separate queries or use `$in` on a single field.

### Security

Paths are validated against forbidden segments: `__proto__`, `constructor`, `prototype`. Regex patterns are capped at 200 characters. All parsing uses Zod validation.

---

## Examples (12+)

All examples use the models defined in [`docs/models.ts`](../../docs/models.ts). The `docs` variable is `container.docs` (a `contentDb` feature instance). `collection` is loaded via `await docs.load()`.

### Ideas

**1. All spark ideas (default status)**

```typescript
// Programmatic
const sparks = await docs.query(Idea)
  .where("meta.status", "spark")
  .fetchAll()
// Returns: Idea[] where status === "spark"
```

```jsonc
// MCP DSL
{ "model": "Idea", "where": { "meta.status": "spark" } }
```

**2. Ideas aligned to a specific goal**

```typescript
const goalIdeas = await docs.query(Idea)
  .where("meta.goal", "monetize-luca")
  .fetchAll()
// Returns: Idea[] whose goal field matches the slug
```

**3. Ideas with a specific tag**

```typescript
const tagged = await docs.query(Idea)
  .whereContains("meta.tags", "infrastructure")
  .fetchAll()
// Note: $contains on an array field won't work as expected (it's a string op).
// For array membership, use the eq operator on the array element directly,
// or fetch all and filter in JS. See Pitfalls section.
```

**4. Ideas that are either exploring or ready**

```typescript
const active = await docs.query(Idea)
  .whereIn("meta.status", ["exploring", "ready"])
  .fetchAll()
// Returns: Ideas in either status
```

```jsonc
// MCP DSL
{ "model": "Idea", "where": { "meta.status": ["exploring", "ready"] } }
```

### Projects

**5. Approved projects (using scope)**

```typescript
const approved = await docs.query(Project)
  .scope("approved")
  .fetchAll()
// Returns: Project[] with status "approved"
// Scope is defined in models.ts: (q) => q.where("meta.status", "approved")
```

**6. Projects with their plans eagerly loaded**

```typescript
const projects = await docs.query(Project)
  .include("plans", "goal")
  .fetchAll()
// Returns: Project[] with .toJSON() including related plans and goal data
```

### Plans

**7. Plans belonging to a specific project**

```typescript
const plans = await docs.query(Plan)
  .where("meta.project", "assistant-presenter")
  .fetchAll()
// Returns: Plan[] linked to that project slug
```

**8. Completed plans with cost data**

```typescript
const expensive = await docs.query(Plan)
  .where("meta.status", "completed")
  .whereExists("meta.costUsd")
  .sort("meta.costUsd", "desc")
  .fetchAll()
// Returns: Completed plans sorted by cost, most expensive first
```

```jsonc
// MCP DSL
{
  "model": "Plan",
  "where": {
    "meta.status": "completed",
    "meta.costUsd": { "$exists": true }
  },
  "sort": { "meta.costUsd": "desc" }
}
```

**9. Plans that have verification criteria defined**

```typescript
const verified = await docs.query(Plan)
  .whereExists("sections.verification")
  .fetchAll()
// Returns: Plans where the "Test plan" / "Validation" section was extracted
```

### Tasks

**10. One-off tasks (scheduled "once")**

```typescript
const oneOff = await docs.query(Task)
  .where("meta.schedule", "once")
  .fetchAll()
// Returns: Task[] with schedule === "once"
```

**11. Repeatable tasks that haven't run yet**

```typescript
const fresh = await docs.query(Task)
  .whereNotExists("meta.lastRanAt")
  .fetchAll()
// Returns: Tasks that have never been executed
```

```jsonc
// MCP DSL
{ "model": "Task", "where": { "meta.lastRanAt": { "$exists": false } } }
```

**12. Tasks assigned to a specific agent**

```typescript
const claudeTasks = await docs.query(Task)
  .where("meta.agent", "claude")
  .where("meta.running", false)
  .fetchAll()
// Returns: Non-running tasks assigned to claude
```

### Reports

**13. Reports by tag (using regex)**

```typescript
const infraReports = await docs.query(Report)
  .whereRegex("meta.tags", "infra")
  .fetchAll()
// Note: meta.tags is an array -- regex runs against String(array).
// For reliable array filtering, see Pitfalls section.
```

### Goals

**14. Short-horizon goals**

```typescript
const shortGoals = await docs.query(Goal)
  .where("meta.horizon", "short")
  .fetchAll()
```

### Pagination + Sort

**15. Paginated plans sorted by completion date**

```typescript
const page2 = await docs.query(Plan)
  .where("meta.status", "completed")
  .sort("meta.completedAt", "desc")
  .limit(5)
  .offset(5)
  .fetchAll()
// Returns: Plans 6-10 by completion date
```

```jsonc
// MCP DSL
{
  "model": "Plan",
  "where": { "meta.status": "completed" },
  "sort": { "meta.completedAt": "desc" },
  "limit": 5,
  "offset": 5
}
```

---

## How It Maps to Models

### Field Types and Querying

| Zod Type | Query Behavior |
|----------|---------------|
| `z.string()` | `eq`, `contains`, `startsWith`, `endsWith`, `regex` all work naturally |
| `z.number()` | `eq`, `gt`, `lt`, `gte`, `lte` work as expected |
| `z.boolean()` | `eq` with `true`/`false` |
| `z.enum([...])` | `eq` for single value, `in` for multiple |
| `z.array(z.string())` | See Pitfalls -- operators test against the array object, not individual elements |
| `z.object({...})` | Access nested fields via dot notation: `meta.inputs.name.type` |
| `.optional()` | Field may be undefined; use `$exists` to check presence |
| `.default(val)` | Zod fills the default when creating instances -- documents without the field in frontmatter get the default |

### Frontmatter vs Body vs Headings

- **Frontmatter fields**: Queried via `meta.<field>`. This is the primary query surface.
- **Document body**: Not directly queryable through the DSL. Use the MCP `search_content` tool for full-text regex search across bodies.
- **Extracted sections**: Queryable via `sections.<name>` after extraction. Sections are lazily extracted and cached.
- **Headings**: Not directly queryable. The title (H1) is available as `title`.

### Missing Fields and Defaults

When a field is missing from frontmatter:
1. Zod `.default()` fills it during model instance creation
2. `.optional()` fields resolve to `undefined`
3. `$exists: false` matches `undefined` and `null`
4. Comparison operators (`$gt`, `$lt`, etc.) against `undefined` follow JS semantics (`undefined > 5` is `false`)
5. In sorting, nulls go to **end** for ascending, **start** for descending

---

## Generalization Guide

Given a new model definition, here's how to know what's queryable.

### Step 1: Read the Meta Schema

Every queryable field lives in the `meta: z.object({...})` block. Each key becomes `meta.<key>`.

```typescript
const MyModel = defineModel("MyModel", {
  prefix: "things",
  meta: z.object({
    priority: z.number().default(0),      // => meta.priority (number)
    tags: z.array(z.string()).default([]), // => meta.tags (array)
    owner: z.string().optional(),          // => meta.owner (string | undefined)
  }),
})
```

### Step 2: Check Sections

Sections defined in `sections: {}` become accessible at `sections.<name>`. They are extracted from the markdown body using AST queries.

### Step 3: Check Computed Properties

Computed properties in `computed: {}` are accessible at `computed.<name>`. They run functions against the document instance.

### Step 4: Check Relationships and Scopes

- `relationships` define `include()` targets
- `scopes` define reusable named filter presets

### Naming Conventions

- **Field paths** always use dot notation: `meta.status`, `sections.overview`
- **Model references** use the model name string: `"Plan"`, `"Project"`, or a unique prefix like `"plans"`
- **Relationship foreign keys** are slug strings matching document path IDs

### Pitfalls

**Array fields**: The `$in` operator checks if `actualValue` is **in** the expected array, not whether the actual array **contains** an element. For an array field like `meta.tags: ["a", "b"]`:
- `where("meta.tags", ["a", "b"])` -- this checks if the tags array value is IN `["a", "b"]`, which uses `===` comparison. It does NOT check array membership.
- To test if a tag array contains a specific value, fetch all and filter in code, or use `$regex` against the stringified array (fragile).

**Null vs undefined**: `$exists: true` requires the value to be both non-null AND non-undefined. Optional fields without values are `undefined`, not `null`.

**Type coercion**: Operators don't coerce types. `$gt` on a string field against a number will use JS string/number comparison semantics (likely not what you want).

**`eq` deep comparison**: The `eq` operator falls back to `JSON.stringify` comparison when `===` fails. This means `{ a: 1 }` equals `{ a: 1 }` but object key order matters.

**`whereIn` filters falsy values**: The `whereIn` builder method calls `values.filter(Boolean)`, which strips `0`, `""`, `false`, and `null` from the array. Use `.where(path, "in", values)` directly to avoid this.

---

## Implementation Notes

### Architecture (3 layers)

```
QueryDSL (JSON)  -->  QueryBuilder  -->  Operator Functions
     |                     |                    |
  parse + validate    accumulate           evaluate per-doc
```

### Key Source Files

| File | Role |
|------|------|
| [`contentbase/src/query/operators.ts`](../../contentbase/src/query/operators.ts) | 13 operator functions (37 lines) |
| [`contentbase/src/query/query-builder.ts`](../../contentbase/src/query/query-builder.ts) | `QueryBuilder` class -- accumulates `Condition[]` (110 lines) |
| [`contentbase/src/query/collection-query.ts`](../../contentbase/src/query/collection-query.ts) | `CollectionQuery<T>` -- typed query executor with sort/limit/include (237 lines) |
| [`contentbase/src/query/query-dsl.ts`](../../contentbase/src/query/query-dsl.ts) | DSL schema, `parseWhereClause()`, `executeQueryDSL()` (260 lines) |
| [`contentbase/src/query/index.ts`](../../contentbase/src/query/index.ts) | Re-exports |

### No AST / No Index

The query system does **not** compile to an AST or build indexes. Evaluation is a linear scan:

1. Iterate every document `pathId` in the collection
2. Match document to model definition by prefix (or `_model` frontmatter)
3. Create a model instance (applies Zod defaults, extracts sections lazily)
4. Test every condition against the instance using `getNestedValue()` + operator function
5. Collect passing instances, then sort, paginate, and return

For small-to-medium collections (hundreds of docs), this is fast. For thousands of documents, every query touches every file.

### Evaluation Flow (detail)

```
executeQueryDSL(collection, dsl)
  1. resolveModelDef(collection, dsl.model)       -- find model by name or prefix
  2. collection.query(def)                         -- create CollectionQuery
  3. Apply scopes (each calls .where() internally)
  4. parseWhereClause(dsl.where) -> Condition[]    -- parse DSL to conditions
  5. Apply conditions via q.where(path, op, value)
  6. parseSortClause(dsl.sort) -> SortSpec[]
  7. Apply sorts, limit, offset
  8. Execute method (fetchAll/first/last/count)
  9. Apply field selection (select) on output
```

### Sort Behavior

- Multi-field sort supported (first sort is primary)
- Null values: pushed to **end** in ascending, **start** in descending
- Comparison: `<` / `>` operators (works for strings, numbers, dates-as-strings)

### MCP Integration

The MCP server at provided by contentbase 
- `query(options)` -- accepts the full `QueryDSL` object
- `search_content(pattern, model?, caseSensitive?)` -- full-text regex across document bodies
- `text_search(pattern, expanded?, ignoreCase?)` -- file-level text search

The REST API at `/api/query` accepts:
- `GET` with JSON-serialized `where` query param
- `POST` with full `QueryDSL` body
