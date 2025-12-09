# Aha! Page Lookup Skill

## Purpose
This skill enables you to retrieve Aha! documentation pages by their reference numbers. Use this when users want to access knowledge base articles, product documentation, or notes stored in Aha!.

## When to Use This Skill
- User mentions an Aha! page reference (format: `PREFIX-N-NUMBER`, e.g., `ABC-N-213`)
- User asks about documentation, notes, or knowledge base articles in Aha!
- User wants to read a specific Aha! page or document
- User needs to understand the documentation hierarchy (parent/child pages)

## Reference Number Pattern
| Type | Pattern | Examples |
|------|---------|----------|
| Page/Note | `PREFIX-N-NUMBER` | ABC-N-213, DOCS-N-100, KB-N-456 |

The "N" in the middle indicates this is a Note/Page type record.

## How to Use
When connected to the Aha! MCP server, use the `get_page` tool:

```
Tool: get_page
Parameters:
  - reference: "ABC-N-213" (the Aha! page reference number)
  - includeParent: true/false (optional, default: false)
```

## Parameters Explained
- **reference** (required): The page reference number
- **includeParent** (optional): Set to `true` to also retrieve information about the parent page in the hierarchy

## Response Interpretation
The tool returns:
- **name**: The page title
- **description.markdownBody**: The page content in Markdown format
- **children**: List of child pages (name and referenceNum)
- **parent** (if includeParent=true): Parent page info (name and referenceNum)

## Example Interactions

**User**: "Show me the page ABC-N-213"
**Action**: Call `get_page` with reference "ABC-N-213"
**Response**: Display the page title and content

**User**: "What's the parent of page DOCS-N-100?"
**Action**: Call `get_page` with reference "DOCS-N-100" and includeParent=true
**Response**: Show the page info along with its parent page details

**User**: "What child pages does KB-N-50 have?"
**Action**: Call `get_page` with reference "KB-N-50"
**Response**: List all the child pages under this page

## Error Handling
- If page not found: Inform user the reference may be incorrect or they may lack access
- If invalid format: Explain the correct format (PREFIX-N-NUMBER)
