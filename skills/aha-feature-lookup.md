# Aha! Feature & Requirement Lookup Skill

## Purpose
This skill enables you to look up Aha! features and requirements by their reference numbers. Use this when users mention Aha! record IDs like "DEVELOP-123" or requirement IDs like "ADT-123-1".

## When to Use This Skill
- User mentions an Aha! feature reference (format: `PREFIX-NUMBER`, e.g., `DEVELOP-123`, `PRODUCT-456`)
- User mentions an Aha! requirement reference (format: `PREFIX-NUMBER-NUMBER`, e.g., `ADT-123-1`, `DEV-456-2`)
- User asks about the status, description, or details of an Aha! record
- User wants to understand what a specific feature or requirement contains

## Reference Number Patterns
| Type | Pattern | Examples |
|------|---------|----------|
| Feature | `PREFIX-NUMBER` | DEVELOP-123, PRODUCT-456, ACT-789 |
| Requirement | `PREFIX-NUMBER-NUMBER` | ADT-123-1, DEV-456-2, PROD-789-3 |

## How to Use
When connected to the Aha! MCP server, use the `get_record` tool:

```
Tool: get_record
Parameters:
  - reference: "DEVELOP-123" (the Aha! reference number)
```

## Response Interpretation
The tool returns:
- **name**: The title/name of the feature or requirement
- **description.markdownBody**: The detailed description in Markdown format

## Example Interactions

**User**: "What's DEVELOP-123 about?"
**Action**: Call `get_record` with reference "DEVELOP-123"
**Response**: Summarize the feature name and description for the user

**User**: "Tell me about requirement ADT-456-2"
**Action**: Call `get_record` with reference "ADT-456-2"
**Response**: Explain the requirement's purpose and details

## Error Handling
- If record not found: Inform user the reference may be incorrect or they may lack access
- If invalid format: Explain the correct format (PREFIX-NUMBER for features, PREFIX-NUMBER-NUMBER for requirements)
