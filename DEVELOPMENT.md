# DEVELOPMENT.md

## Purpose of this document

This is the working reference for ongoing development of this fork of `aha-develop/aha-mcp`.

The intent is to help any developer quickly understand:

- what exists in this fork today,
- why certain decisions were made,
- where behavior is inconsistent or surprising,
- and what should be built next.

## Fork goals and guiding principles

### Project goal

Build a **clean, generic Aha! API MCP wrapper** that any Aha! customer can use, rather than a workspace-specific integration.

### Design principles for this fork

1. **Workspace-agnostic defaults**
   - Avoid hardcoded workspace IDs, prefixes, statuses, or naming assumptions.
   - Prefer parameters that map directly to Aha! API fields and are portable across accounts.

2. **Predictable MCP tool contracts**
   - Tool names, parameter names, and response shapes should be consistent across record types.
   - Similar actions (e.g., `create_*`, `update_*`, `get_*`, `list_*`) should behave similarly.

3. **Minimal abstraction over Aha! API semantics**
   - Wrap Aha! APIs in a way that is easy to reason about and debug.
   - When we transform data, it should be explicit and documented (e.g., description-to-HTML conversion).

4. **Safe evolution**
   - Prefer additive changes and deprecations over breaking renames where possible.
   - Keep this file updated as tool behavior changes.

---

## Architecture snapshot

### Runtime and transport

- Language/runtime: TypeScript on Node.js.
- MCP transport: stdio.
- Entry point registers all tools in `ListToolsRequestSchema` and dispatches calls via `CallToolRequestSchema`.

### API usage model

The server currently uses a mixed API strategy:

- **GraphQL (Aha! API v2 GraphQL endpoint)** for:
  - `get_record`
  - `get_page`
  - `search_documents`
- **REST (Aha! API v1 endpoints)** for all other tools.

This split is currently practical but introduces inconsistent response shapes and field semantics.

### Auth and configuration

Required environment variables:

- `AHA_API_TOKEN`
- `AHA_DOMAIN` (workspace subdomain only; code constructs `https://${AHA_DOMAIN}.aha.io/...`)

---

## Current tool inventory (17 tools)

This fork currently exposes 17 MCP tools.

> Note: parameter names are listed exactly as currently implemented.

### 1) `get_record`

Get a feature or requirement by reference.

- **Required params**
  - `reference_num: string`
- **Accepted format (validated)**
  - Feature: `ABC-123`
  - Requirement: `ABC-123-1`
- **Backend**
  - GraphQL query; tool auto-detects feature vs requirement via regex.
- **Returns**
  - Raw GraphQL object as pretty JSON text.

### 2) `get_page`

Get an Aha! note/page by reference.

- **Required params**
  - `reference_num: string` (format like `ABC-N-213`)
- **Optional params**
  - `includeParent?: boolean` (default `false`)
- **Backend**
  - GraphQL query with optional parent relationship inclusion.
- **Returns**
  - Raw GraphQL page object as pretty JSON text.

### 3) `search_documents`

Search Aha! records by full-text query.

- **Required params**
  - `query: string`
- **Optional params**
  - `searchableType?: string` (default `"Page"`)
  - Valid values: `"Feature"`, `"Epic"`, `"Initiative"`, `"Page"`
- **Backend**
  - GraphQL `searchDocuments` query.
  - Internally wrapped as single-item list `[searchableType]`.
- **Returns**
  - Raw GraphQL search response as pretty JSON text.

### 4) `list_products`

List products/workspaces visible to the API token.

- **Params**
  - none
- **Backend**
  - REST `GET /api/v1/products`
- **Returns (summary projection)**
  - `id`, `reference_prefix`, `name`

### 5) `list_releases`

List releases for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/releases`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `id`, `name`, `release_date`

### 6) `list_epics`

List epics for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/epics`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `id`, `reference_num`, `name`

### 7) `list_features`

List features for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/features`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `id`, `reference_num`, `name`

### 8) `create_epic`

Create an epic in a product/workspace.

- **Required params**
  - `product_id: string`
  - `name: string`
  - `release_id: string`
- **Optional params**
  - `description?: string`
- **Backend**
  - REST `POST /api/v1/products/{product_id}/epics` with `{ epic: ... }`
- **Behavior note**
  - `description` is converted into a fixed “Problem / Why this matters / Desired outcome” HTML template unless already containing `<strong>Problem</strong>`.
- **Returns**
  - Full REST create response object.

### 9) `create_feature`

Create a feature in a product/workspace.

- **Required params**
  - `product_id: string`
  - `name: string`
  - `release_id: string` *(currently required by tool schema and validation)*
- **Optional params**
  - `epic_id?: string`
  - `description?: string`
- **Backend**
  - REST `POST /api/v1/products/{product_id}/features` with `{ feature: ... }`
- **Returns**
  - Full REST create response object.

### 10) `update_epic`

Update an epic by reference number.

- **Required params**
  - `reference_num: string`
- **Optional params**
  - `name?: string`
  - `description?: string`
  - `initiative_reference_num?: string` — links epic to an initiative
  - `goal_ids?: number[]` — links epic to goals (numeric IDs from `list_goals`)
- **Backend**
  - REST `PUT /api/v1/epics/{reference_num}` with `{ epic: ... }`
  - `initiative_reference_num` maps to `initiative` field in the REST payload
  - `goal_ids` maps to `goals` field in the REST payload
- **Validation behavior**
  - Requires at least one of `name`, `description`, `initiative_reference_num`, or `goal_ids`.
  - Uses `undefined` checks (aligned with `update_feature`).
- **Returns**
  - Full REST update response object.

### 11) `update_feature`

Update a feature by reference number.

- **Required params**
  - `reference_num: string` (validated as feature format)
- **Optional params**
  - `name?: string`
  - `description?: string`
  - `epic_id?: string` — links feature to an epic
  - `initiative_reference_num?: string` — links feature to an initiative
  - `goal_ids?: number[]` — links feature to goals (numeric IDs from `list_goals`)
- **Backend**
  - REST `PUT /api/v1/features/{reference_num}` with `{ feature: ... }`
  - `epic_id` maps to `epic` field in the REST payload
  - `initiative_reference_num` maps to `initiative` field in the REST payload
  - `goal_ids` maps to `goals` field in the REST payload
- **Validation behavior**
  - Requires at least one of `name`, `description`, `epic_id`, `initiative_reference_num`, or `goal_ids`.
  - Uses `undefined` checks, so explicit empty-string fields are allowed.
- **Returns**
  - Full REST update response object.

### 12) `update_initiative`

Update an initiative by reference number.

- **Required params**
  - `reference_num: string`
  - `product_id: string`
- **Optional params**
  - `name?: string`
  - `description?: string`
  - `goal_ids?: number[]` — links initiative to goals (numeric IDs from `list_goals`)
- **Backend**
  - REST `PUT /api/v1/products/{product_id}/initiatives/{reference_num}` with `{ initiative: ... }`
  - `goal_ids` maps to `goals` field in the REST payload
- **Validation behavior**
  - Requires at least one of `name`, `description`, or `goal_ids`.
  - Uses `undefined` checks.
- **Returns**
  - Full REST update response object.

### 13) `get_epic`

Get an epic by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/epics/{reference_num}`
- **Returns**
  - Full REST epic response object.

### 14) `get_initiative`

Get an initiative by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/initiatives/{reference_num}`
- **Returns**
  - Full REST initiative response object.

### 15) `get_goal`

Get a goal by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/goals/{reference_num}`
- **Returns**
  - Full REST goal response object.

### 16) `list_initiatives`

List initiatives for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/initiatives`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `id`, `reference_num`, `name`

### 17) `list_goals`

List goals for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/goals`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `id`, `reference_num`, `name`

---

## Key design decisions in this fork

1. **Expanded tool surface via REST-first additions**
   - Upstream had 3 tools; this fork added CRUD/read/list coverage for epics/features plus initiative/goal reads and lists.

2. **Human-readable summary returns for list endpoints**
   - Most list tools intentionally return compact summaries instead of full payloads.

3. **Description pass-through contract**
   - Create/update on feature/epic passes `description` through verbatim to Aha!; callers are responsible for supplying well-formed HTML.

4. **Pagination helper for some list endpoints**
   - `list_initiatives` and `list_goals` page through all results; other list endpoints currently do single-request fetches.

---

## Known inconsistencies and technical debt

These are worth knowing before making further changes:

1. **Mixed identifier naming across tools** *(resolved)*
   - All tools now use `reference_num` consistently.

2. **Mixed backend protocols (GraphQL + REST)**
   - Different error shapes, field availability, and response conventions.
   - Accepted as-is; consolidation would require a larger refactor.

3. **`create_feature` required-but-unused `release_id`** *(resolved)*
   - `release_id` is now included in the REST payload.

4. **Update validation semantics differ between feature and epic** *(resolved)*
   - Both `update_feature` and `update_epic` now use `undefined` checks.

5. **Description formatter behavior is opinionated** *(resolved)*
   - Description formatting helper removed; create/update handlers now pass `description` through verbatim.

6. **List endpoint behavior is inconsistent** *(resolved)*
   - All list endpoints (`releases`, `features`, `epics`, `initiatives`, `goals`) now use `fetchAllPages`.

7. **Tool docs lag implementation**
   - `README.md` currently documents only the original 3 tools.

---

## Backlog (append-only)

> Keep this section easy to extend. Add new items at the top with date + owner when known.

### Open

- [ ] Expand README tool documentation from 3 tools to full inventory.

### Completed

- [x] **Standardize identifier parameter naming** — all tools now use `reference_num`; `get_record` and `get_page` previously used `reference`.

- [x] **Fix `create_feature` payload** — `release_id` is now included in the REST body (was required by schema but silently omitted).

- [x] **Normalize list pagination** — `list_releases`, `list_features`, `list_epics` now use `fetchAllPages`; consistent with `list_initiatives` and `list_goals`.

- [x] **Add `id` to `list_features` and `list_epics` summaries** — projection now returns `id`, `reference_num`, `name` (aligned with other list tools).

- [x] **Fix `update_initiative` endpoint** — now uses product-scoped route `/api/v1/products/{product_id}/initiatives/{reference_num}`; `product_id` added as required param.

- [x] **Fix `update_feature` epic link field** — `epic_id` input now maps to `epic` field in the REST payload (API contract correction).

- [x] **Support linking on `update_epic`, `update_feature`, `update_initiative`**
  - Added `initiative_reference_num` and `goal_ids` to `update_epic`.
  - Added `epic_id`, `initiative_reference_num`, and `goal_ids` to `update_feature`.
  - Added new `update_initiative` tool with `goal_ids` support.
  - Also fixed `update_epic` validation to use `undefined` checks (was using truthy checks, inconsistent with `update_feature`).

- [x] **Document `search_documents` searchable types**
  - `searchableType` now documents valid values: `"Feature"`, `"Epic"`, `"Initiative"`, `"Page"`.

- [x] Decide and document whether description formatting should be opt-in, opt-out, or always pass-through.
  - Resolved: description is now always passed through verbatim; formatting is the caller's responsibility.

---

## Suggested near-term roadmap

1. **Contract consistency pass**
   - Fix required-vs-payload mismatches and parameter naming drift.

2. **Documentation parity**
   - Keep `README.md` concise for end users and treat this file as canonical dev-level detail.

3. **Low-friction quality checks**
   - Add basic tests or schema assertions around tool registration and handler payload composition.

4. **Incremental genericity checks**
   - During every new tool addition, explicitly ask: “Would this work unchanged for an arbitrary Aha! customer?”

---

## Maintenance checklist for future contributors

When adding or changing a tool:

1. Update tool schema registration in `src/index.ts`.
2. Update handler logic in `src/handlers.ts`.
3. Validate required parameters match actual API payload usage.
4. Ensure error messages are specific and record-type accurate.
5. Update `README.md` (user-facing) and `DEVELOPMENT.md` (developer-facing).
6. Add backlog items for known gaps discovered but not implemented.

