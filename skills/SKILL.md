---
name: "Aha! Product Management Assistant"
description: "Look up Aha! features, requirements, and pages by reference number. Search Aha! documents. Use when users mention Aha! references like DEVELOP-123, ADT-123-1, or ABC-N-213, or want to find documentation."
---

# Aha! Product Management Assistant

## Purpose
This skill enables you to interact with Aha! product management data through the Aha! MCP server. You can look up features, requirements, documentation pages, and search across all Aha! documents.

## When to Use This Skill
- User mentions an Aha! feature reference (e.g., `DEVELOP-123`, `PRODUCT-456`)
- User mentions an Aha! requirement reference (e.g., `ADT-123-1`, `DEV-456-2`)
- User mentions an Aha! page/note reference (e.g., `ABC-N-213`, `DOCS-N-100`)
- User asks about feature status, descriptions, or details
- User wants to find or search for Aha! documentation
- User asks "what is [REFERENCE]" where REFERENCE looks like an Aha! ID

## Reference Number Patterns

| Type | Pattern | Examples | Tool to Use |
|------|---------|----------|-------------|
| Feature | `PREFIX-NUMBER` | DEVELOP-123, PRODUCT-456, ACT-789 | `get_record` |
| Requirement | `PREFIX-NUMBER-NUMBER` | ADT-123-1, DEV-456-2, PROD-789-3 | `get_record` |
| Page/Note | `PREFIX-N-NUMBER` | ABC-N-213, DOCS-N-100, KB-N-456 | `get_page` |

**Pattern Rules:**
- PREFIX: One or more uppercase letters/numbers (e.g., DEVELOP, ACT, ADT)
- Features: PREFIX followed by hyphen and number
- Requirements: Feature reference followed by hyphen and sub-number
- Pages: PREFIX followed by `-N-` and number (the N indicates Note/Page)

---

## Available Tools

### 1. get_record
Retrieves an Aha! feature or requirement by reference number.

**Parameters:**
- `reference` (required): Reference number (e.g., "DEVELOP-123" or "ADT-123-1")

**Use for:**
- Feature references: `PREFIX-NUMBER`
- Requirement references: `PREFIX-NUMBER-NUMBER`

**Response includes:**
- `name`: Title of the feature/requirement
- `description.markdownBody`: Full description in Markdown

**Example:**
```json
{
  "reference": "DEVELOP-123"
}
```

---

### 2. get_page
Retrieves an Aha! documentation page by reference number.

**Parameters:**
- `reference` (required): Page reference number (e.g., "ABC-N-213")
- `includeParent` (optional): Set to `true` to include parent page info

**Use for:**
- Page/Note references: `PREFIX-N-NUMBER`

**Response includes:**
- `name`: Page title
- `description.markdownBody`: Page content in Markdown
- `children`: List of child pages (name and referenceNum)
- `parent`: Parent page info (if includeParent=true)

**Example:**
```json
{
  "reference": "ABC-N-213",
  "includeParent": true
}
```

---

### 3. search_documents
Searches across Aha! documents to find relevant content.

**Parameters:**
- `query` (required): Search terms/keywords
- `searchableType` (optional): Type of document, defaults to "Page"

**Use for:**
- Finding documents by topic or keyword
- Discovering what documentation exists
- When user doesn't know the exact reference number

**Response includes:**
- `nodes`: Array of matching documents with name, url, searchableId, searchableType
- `totalCount`: Total number of matches
- `totalPages`: Number of result pages

**Example:**
```json
{
  "query": "product roadmap Q2",
  "searchableType": "Page"
}
```

---

## Example Interactions

### Looking up a Feature
**User:** "What's DEVELOP-123 about?"
**Action:** Call `get_record` with reference "DEVELOP-123"
**Response:** Summarize the feature name and description

### Looking up a Requirement
**User:** "Tell me about requirement ADT-456-2"
**Action:** Call `get_record` with reference "ADT-456-2"
**Response:** Explain the requirement's purpose and details

### Retrieving a Page
**User:** "Show me page DOCS-N-100"
**Action:** Call `get_page` with reference "DOCS-N-100"
**Response:** Display the page title and content

### Getting Page Hierarchy
**User:** "What's the parent of KB-N-213?"
**Action:** Call `get_page` with reference "KB-N-213" and includeParent=true
**Response:** Show page info along with parent page details

### Searching Documents
**User:** "Find all pages about the Q2 roadmap"
**Action:** Call `search_documents` with query "Q2 roadmap"
**Response:** List matching pages with names and URLs

### Discovering Documentation
**User:** "What documentation do we have about API integrations?"
**Action:** Call `search_documents` with query "API integrations"
**Response:** Present search results and offer to retrieve specific pages

---

## Error Handling

| Error | Cause | Response |
|-------|-------|----------|
| Record not found | Invalid reference or no access | Inform user the reference may be incorrect or they may lack permissions |
| Invalid format | Reference doesn't match patterns | Explain correct format for the type they're looking for |
| Search returns empty | No matching documents | Suggest alternative search terms or broader queries |
| API error | Connection or auth issues | Advise user to check their Aha! connection and API token |

## Tips for Best Results
1. When a reference is mentioned, identify its type by the pattern before calling the appropriate tool
2. For searches with many results, offer to retrieve specific pages of interest
3. When looking up pages, consider whether parent/child context would be helpful
4. Combine tools: search first to find references, then use get_record or get_page for details
