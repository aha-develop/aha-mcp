# Aha! Document Search Skill

## Purpose
This skill enables you to search across Aha! documents to find relevant pages, features, and other content. Use this when users want to find information but don't know the specific reference number.

## When to Use This Skill
- User wants to find documents about a specific topic
- User is looking for pages related to a keyword or phrase
- User needs to discover what documentation exists on a subject
- User asks "find", "search", or "look for" documents in Aha!

## How to Use
When connected to the Aha! MCP server, use the `search_documents` tool:

```
Tool: search_documents
Parameters:
  - query: "product roadmap" (the search terms)
  - searchableType: "Page" (optional, default: "Page")
```

## Parameters Explained
- **query** (required): The search terms/keywords to find
- **searchableType** (optional): Type of document to search. Default is "Page"

## Response Interpretation
The tool returns a search results object with:
- **nodes**: Array of matching documents, each containing:
  - **name**: Document title
  - **url**: Direct URL to the document in Aha!
  - **searchableId**: The reference ID
  - **searchableType**: Type of document (Page, Feature, etc.)
- **currentPage**: Current page of results
- **totalCount**: Total number of matching documents
- **totalPages**: Total pages of results
- **isLastPage**: Whether this is the last page of results

## Example Interactions

**User**: "Find all pages about the Q2 roadmap"
**Action**: Call `search_documents` with query "Q2 roadmap"
**Response**: List the matching pages with their names and URLs

**User**: "Search for launch planning documentation"
**Action**: Call `search_documents` with query "launch planning"
**Response**: Present the search results, highlighting relevant documents

**User**: "What documentation do we have about API integrations?"
**Action**: Call `search_documents` with query "API integrations"
**Response**: Summarize the found documents and offer to retrieve specific ones

## Tips for Effective Searching
1. Use specific keywords rather than generic terms
2. Try different word variations if initial search yields few results
3. After finding relevant documents, use `get_page` to retrieve full content
4. Combine with `get_record` if search results include features/requirements

## Error Handling
- If no results: Suggest alternative search terms or broader queries
- If too many results: Suggest more specific search terms
