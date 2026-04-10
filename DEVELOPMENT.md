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

## Current tool inventory (16 tools)

This fork currently exposes 16 MCP tools.

> Note: parameter names are listed exactly as currently implemented.

### 1) `get_record`

Get a feature or requirement by reference.

- **Required params**
  - `reference: string`
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
  - `reference: string` (format like `ABC-N-213`)
- **Optional params**
  - `includeParent?: boolean` (default `false`)
- **Backend**
  - GraphQL query with optional parent relationship inclusion.
- **Returns**
  - Raw GraphQL page object as pretty JSON text.

### 3) `search_documents`

Search Aha! documents.

- **Required params**
  - `query: string`
- **Optional params**
  - `searchableType?: string` (default `"Page"`)
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
- **Returns (summary projection)**
  - `id`, `name`, `release_date`

### 6) `list_epics`

List epics for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/epics`
- **Returns (summary projection)**
  - `reference_num`, `name`

### 7) `list_features`

List features for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/features`
- **Returns (summary projection)**
  - `reference_num`, `name`

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
- **Important inconsistency**
  - `release_id` is validated as required but is **not currently included** in the REST payload.
- **Returns**
  - Full REST create response object.

### 10) `update_epic`

Update an epic by reference number.

- **Required params**
  - `reference_num: string`
- **Optional params**
  - `name?: string`
  - `description?: string`
- **Backend**
  - REST `PUT /api/v1/epics/{reference_num}` with `{ epic: ... }`
- **Validation behavior**
  - Requires at least one of `name` or `description`.
  - Uses truthy checks, so empty-string updates are rejected implicitly.
- **Returns**
  - Full REST update response object.

### 11) `update_feature`

Update a feature by reference number.

- **Required params**
  - `reference_num: string` (validated as feature format)
- **Optional params**
  - `name?: string`
  - `description?: string`
- **Backend**
  - REST `PUT /api/v1/features/{reference_num}` with `{ feature: ... }`
- **Validation behavior**
  - Requires at least one of `name` or `description`.
  - Uses `undefined` checks, so explicit empty-string fields are allowed.
- **Returns**
  - Full REST update response object.

### 12) `get_epic`

Get an epic by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/epics/{reference_num}`
- **Returns**
  - Full REST epic response object.

### 13) `get_initiative`

Get an initiative by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/initiatives/{reference_num}`
- **Returns**
  - Full REST initiative response object.

### 14) `get_goal`

Get a goal by reference number.

- **Required params**
  - `reference_num: string`
- **Backend**
  - REST `GET /api/v1/goals/{reference_num}`
- **Returns**
  - Full REST goal response object.

### 15) `list_initiatives`

List initiatives for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/initiatives`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `reference_num`, `name`

### 16) `list_goals`

List goals for a product/workspace.

- **Required params**
  - `product_id: string`
- **Backend**
  - REST `GET /api/v1/products/{product_id}/goals`
  - Uses internal pagination loop to fetch all pages.
- **Returns (summary projection)**
  - `reference_num`, `name`

---

## Key design decisions in this fork

1. **Expanded tool surface via REST-first additions**
   - Upstream had 3 tools; this fork added CRUD/read/list coverage for epics/features plus initiative/goal reads and lists.

2. **Human-readable summary returns for list endpoints**
   - Most list tools intentionally return compact summaries instead of full payloads.

3. **Problem statement formatting helper**
   - Create/update on feature/epic applies a shared HTML formatter for descriptions to encourage structured records.

4. **Pagination helper for some list endpoints**
   - `list_initiatives` and `list_goals` page through all results; other list endpoints currently do single-request fetches.

---

## Known inconsistencies and technical debt

These are worth knowing before making further changes:

1. **Mixed identifier naming across tools**
   - Some tools use `reference`, others use `reference_num`.
   - This increases prompt and client complexity.

2. **Mixed backend protocols (GraphQL + REST)**
   - Different error shapes, field availability, and response conventions.

3. **`create_feature` required-but-unused `release_id`**
   - API contract and implementation are out of sync.

4. **Update validation semantics differ between feature and epic**
   - `update_feature` uses `undefined` checks.
   - `update_epic` uses truthy checks.
   - Result: empty-string update behavior is inconsistent.

5. **Description formatter behavior is opinionated**
   - Auto-injects fixed HTML section structure.
   - May be surprising for customers expecting literal pass-through text.

6. **List endpoint behavior is inconsistent**
   - Initiatives/goals fetch all pages; releases/features/epics do not currently use the same helper.

7. **Tool docs lag implementation**
   - `README.md` currently documents only the original 3 tools.

---

## Backlog (append-only)

> Keep this section easy to extend. Add new items at the top with date + owner when known.

### Open

- [ ] **Support `initiative_reference_num` on `update_epic`**
  - **Why:** Aha! API supports linking an epic to an initiative via `initiative_reference_num`, but this tool does not expose it yet.
  - **Expected change:**
    - Add optional `initiative_reference_num: string` parameter to MCP schema for `update_epic`.
    - Pass the field through in the REST payload (`{ epic: { ... } }`).
    - Update docs/tests accordingly.

- [ ] Align create/update contracts for `release_id` and ensure `create_feature` payload includes required fields.

- [ ] Standardize identifier parameter naming (`reference` vs `reference_num`) or provide aliases.

- [ ] Decide and document whether description formatting should be opt-in, opt-out, or always pass-through.

- [ ] Normalize list pagination behavior across all list tools.

- [ ] Expand README tool documentation from 3 tools to full inventory.

### Completed

- (none yet)

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

