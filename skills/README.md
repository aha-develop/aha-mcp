# Aha! Skills for Claude.ai

This repository contains custom skills that enable Claude.ai to work effectively with your Aha! product management data.

## What Are These Skills?

These skills are instruction sets that teach Claude how to interact with the Aha! MCP (Model Context Protocol) server. When added to your Claude.ai project, they enable Claude to:

1. **Look up Features & Requirements** - Retrieve details about specific Aha! features (DEVELOP-123) and requirements (ADT-123-1)
2. **Access Documentation Pages** - Read Aha! knowledge base pages, notes, and documentation (ABC-N-213)
3. **Search Documents** - Find relevant pages and documents across your Aha! workspace

## Available Skills

| Skill File | Purpose |
|------------|---------|
| `aha-feature-lookup.md` | Look up Aha! features and requirements by reference number |
| `aha-page-lookup.md` | Retrieve Aha! documentation pages with hierarchy info |
| `aha-document-search.md` | Search across Aha! documents to find relevant content |

---

## How to Add Skills to Claude.ai

### Prerequisites

Before adding skills, you must have the Aha! MCP server configured. See the [aha-mcp repository](../aha-mcp/README.md) for MCP setup instructions.

### Step 1: Create a Project in Claude.ai

1. Go to [claude.ai](https://claude.ai)
2. Click on **"Projects"** in the left sidebar
3. Click **"Create Project"**
4. Name your project (e.g., "Aha! Product Management Assistant")
5. Click **"Create"**

### Step 2: Add Skills as Project Knowledge

1. Open your newly created project
2. Click on **"Project Knowledge"** (or the book icon)
3. Click **"Add Content"** → **"Add Text"**
4. Copy the entire contents of each skill file:
   - Copy contents of `aha-feature-lookup.md`
   - Click "Add Content" → "Add Text" again
   - Copy contents of `aha-page-lookup.md`
   - Repeat for `aha-document-search.md`
5. Each skill will be added as a knowledge document

### Step 3: Configure Custom Instructions (Optional)

For even better results, add custom instructions to your project:

1. In your project, click **"Custom Instructions"**
2. Add the following:

```
You are an Aha! product management assistant. When users mention Aha! reference numbers, use the appropriate MCP tools to look them up:

- Feature references (DEVELOP-123): Use get_record tool
- Requirement references (ADT-123-1): Use get_record tool
- Page references (ABC-N-213): Use get_page tool
- Searching for documents: Use search_documents tool

Always provide helpful summaries of the retrieved information and offer to look up related items.
```

### Step 4: Connect MCP Server (Required for Tool Access)

For Claude.ai to actually execute the Aha! tools, you need MCP server access:

**Option A: Claude Desktop App (Recommended)**
1. Install Claude Desktop from [claude.ai/download](https://claude.ai/download)
2. Configure the MCP server in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "aha-mcp@latest"],
      "env": {
        "AHA_API_TOKEN": "your-api-token-here",
        "AHA_DOMAIN": "your-company"
      }
    }
  }
}
```

Config file locations:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Option B: Claude.ai Web with MCP Integration**
- MCP integration for Claude.ai web is being rolled out gradually
- Check [claude.ai/settings](https://claude.ai/settings) for MCP configuration options

---

## What Each Skill Can Do

### 1. Aha! Feature Lookup Skill

**Capabilities:**
- Retrieve feature details by reference number (e.g., DEVELOP-123)
- Retrieve requirement details (e.g., ADT-123-1)
- Get feature names, descriptions, and status

**Example prompts:**
- "What's DEVELOP-123 about?"
- "Get me the details of feature PRODUCT-456"
- "Show requirement ADT-789-2"

### 2. Aha! Page Lookup Skill

**Capabilities:**
- Retrieve documentation pages by reference (e.g., ABC-N-213)
- View page hierarchy (parent/child relationships)
- Access knowledge base content

**Example prompts:**
- "Show me page DOCS-N-100"
- "What child pages does KB-N-50 have?"
- "Get the parent of page ABC-N-213"

### 3. Aha! Document Search Skill

**Capabilities:**
- Search across all Aha! documents
- Find pages by keyword or topic
- Discover relevant documentation

**Example prompts:**
- "Find all pages about the Q2 roadmap"
- "Search for API documentation"
- "What documentation do we have about user authentication?"

---

## Example Workflow

Here's how you might use these skills together:

1. **Search**: "Find documentation about our mobile app features"
2. **Claude searches** and returns a list of matching pages
3. **Deep dive**: "Show me page MOBILE-N-234"
4. **Claude retrieves** the full page content
5. **Related features**: "What's the status of MOBILE-567?"
6. **Claude looks up** the feature and provides details

---

## Troubleshooting

### "Tool not available" errors
- Ensure the Aha! MCP server is properly configured
- Verify your AHA_API_TOKEN is valid
- Check that AHA_DOMAIN is correct

### "Reference not found" errors
- Verify the reference number format is correct
- Ensure you have access to the Aha! workspace containing that record
- Check if the record exists in Aha!

### Skills not working as expected
- Make sure all skill files are added to Project Knowledge
- Try adding the custom instructions for better context
- Be specific with reference numbers in your prompts

---

## Getting Your Aha! API Token

1. Log in to your Aha! account at `yourcompany.aha.io`
2. Go to **Settings** → **Personal** → **Developer** → **API Keys**
3. Or visit directly: [secure.aha.io/settings/api_keys](https://secure.aha.io/settings/api_keys)
4. Click **"Create new API key"**
5. Copy the token immediately (it won't be shown again!)

---

## Support

For issues with:
- **Aha! MCP Server**: See [aha-mcp repository](https://github.com/aha-develop/aha-mcp)
- **Claude.ai**: See [Claude Support](https://support.anthropic.com)
- **Aha! API**: See [Aha! API Documentation](https://www.aha.io/api)
