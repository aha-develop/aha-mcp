# aha-mcp

Model Context Protocol (MCP) server for accessing Aha! records through the MCP. This integration enables seamless interaction with Aha! features, requirements, and pages directly through the Model Context Protocol. You can read, create, and update features, query releases, and add comments to features.

## Prerequisites

- Node.js v20 or higher
- npm (usually comes with Node.js)
- An Aha! account with API access

## Installation

### Using npx

```bash
npx -y aha-mcp@latest
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/aha-develop/aha-mcp.git
cd aha-mcp

# Install dependencies
npm install

# Run the server
npm run mcp-start
```

## Authentication Setup

1. Log in to your Aha! account at `<yourcompany>.aha.io`
2. Visit [secure.aha.io/settings/api_keys](https://secure.aha.io/settings/api_keys)
3. Click "Create new API key"
4. Copy the token immediately (it won't be shown again)

For more details about authentication and API usage, see the [Aha! API documentation](https://www.aha.io/api).

## Environment Variables

This MCP server requires the following environment variables:

- `AHA_API_TOKEN`: Your Aha! API token
- `AHA_DOMAIN`: Your Aha! domain (e.g., yourcompany if you access aha at yourcompany.aha.io)
- `AHA_PRODUCT_ID`: (Optional) Default product ID to use for the `get_releases` tool when no productId parameter is provided
- `AHA_USER_EMAIL`: (Optional) Default user email address to use when assigning features. If set, you can assign features to yourself without specifying the email each time. Also used by the `get_configured_user` tool to return the configured user's email and user ID.

## IDE Integration

For security reasons, we recommend using your preferred secure method for managing environment variables rather than storing API tokens directly in editor configurations. Each editor has different security models and capabilities for handling sensitive information.

Below are examples of how to configure various editors to use the aha-mcp server. You should adapt these examples to use your preferred secure method for providing the required environment variables.

### VSCode

The instructions below were copied from the instructions [found here](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server).

Add this to your `.vscode/settings.json`, using your preferred method to securely provide the environment variables:

```json
{
  "mcp": {
    "servers": {
      "aha-mcp": {
        "command": "npx",
        "args": ["-y", "aha-mcp"]
        // Environment variables should be provided through your preferred secure method
      }
    }
  }
}
```

### Cursor

1. Go to Cursor Settings > MCP
2. Click + Add new Global MCP Server
3. Add a configuration similar to:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "aha-mcp"]
      // Environment variables should be provided through your preferred secure method
    }
  }
}
```

### Cline

Add a configuration to your `cline_mcp_settings.json` via Cline MCP Server settings:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "aha-mcp"]
      // Environment variables should be provided through your preferred secure method
    }
  }
}
```

### RooCode

Open the MCP settings by either:

- Clicking "Edit MCP Settings" in RooCode settings, or
- Using the "RooCode: Open MCP Config" command in VS Code's command palette

Then add:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "aha-mcp"]
      // Environment variables should be provided through your preferred secure method
    }
  }
}
```

### Claude Desktop

Add a configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "aha-mcp"]
      // Environment variables should be provided through your preferred secure method
    }
  }
}
```

## Available MCP Tools

### 1. get_record

Retrieves an Aha! feature or requirement by reference number.

**Parameters:**

- `reference` (required): Reference number of the feature or requirement (e.g., "DEVELOP-123")

**Example:**

```json
{
  "reference": "DEVELOP-123"
}
```

**Response:**

```json
{
  "reference_num": "DEVELOP-123",
  "name": "Feature name",
  "description": "Feature description",
  "workflow_status": {
    "name": "In development",
    "id": "123456"
  }
}
```

### 2. get_page

Gets an Aha! page by reference number.

**Parameters:**

- `reference` (required): Reference number of the page (e.g., "ABC-N-213")
- `includeParent` (optional): Include parent page information. Defaults to false.

**Example:**

```json
{
  "reference": "ABC-N-213",
  "includeParent": true
}
```

**Response:**

```json
{
  "reference_num": "ABC-N-213",
  "name": "Page title",
  "body": "Page content",
  "parent": {
    "reference_num": "ABC-N-200",
    "name": "Parent page"
  }
}
```

### 3. search_documents

Searches for Aha! documents.

**Parameters:**

- `query` (required): Search query string
- `searchableType` (optional): Type of document to search for (e.g., "Page"). Defaults to "Page"

**Example:**

```json
{
  "query": "product roadmap",
  "searchableType": "Page"
}
```

**Response:**

```json
{
  "results": [
    {
      "reference_num": "ABC-N-123",
      "name": "Product Roadmap 2025",
      "type": "Page",
      "url": "https://company.aha.io/pages/ABC-N-123"
    }
  ],
  "total_results": 1
}
```

### 4. get_releases

Query releases for a product. Useful for finding valid release IDs when creating or updating features.

**Parameters:**

- `productId` (optional): Product ID to query releases for. If not provided, will use the value from `AHA_PRODUCT_ID` environment variable if set.

**Example:**

```json
{
  "productId": "123456"
}
```

**Example without productId (uses AHA_PRODUCT_ID from config):**

```json
{}
```

**Response:**

```json
[
  {
    "id": "789012",
    "name": "Q1 2025 Release",
    "releaseDate": "2025-03-31",
    "referenceNum": "REL-2025-Q1"
  },
  {
    "id": "789013",
    "name": "Q2 2025 Release",
    "releaseDate": "2025-06-30",
    "referenceNum": "REL-2025-Q2"
  }
]
```

### 5. get_workflow_statuses

Query workflow statuses for a project. Useful for finding valid workflow status IDs when updating features.

**Parameters:**

- `projectId` (required): Project ID to query workflow statuses for

**Example:**

```json
{
  "projectId": "123456"
}
```

**Response:**

```json
[
  {
    "id": "333444",
    "name": "In Progress"
  },
  {
    "id": "555666",
    "name": "In Review"
  },
  {
    "id": "777888",
    "name": "Done"
  }
]
```

### 6. create_feature

Create a new feature in Aha!.

**Parameters:**

- `name` (required): Feature name/title
- `description` (required): Feature description
- `releaseId` (required): Release ID where the feature will be created

**Example:**

```json
{
  "name": "New Dashboard Feature",
  "description": "Add a new dashboard view for analytics",
  "releaseId": "789012"
}
```

**Response:**

```json
{
  "id": "345678",
  "name": "New Dashboard Feature",
  "referenceNum": "DEVELOP-456",
  "description": {
    "markdownBody": "Add a new dashboard view for analytics"
  }
}
```

### 7. update_feature

Update key properties of an existing feature. You can update any combination of release, assignment, and workflow status.

**Parameters:**

- `reference` (required): Feature reference number (e.g., "DEVELOP-123")
- `release` (optional): Release ID to assign the feature to
- `assignedToUser` (optional): User ID to assign the feature to
- `assignedToUserEmail` (optional): Email address of user to assign the feature to (alternative to assignedToUser)
- `workflowStatus` (optional): Workflow status ID or name to set for the feature. If a name is provided (e.g., "In Review"), it will be automatically looked up and converted to the corresponding ID.

**Example:**

```json
{
  "reference": "DEVELOP-123",
  "release": "789013",
  "assignedToUser": "111222",
  "workflowStatus": "333444"
}
```

**Response:**

```json
{
  "id": "345678",
  "name": "Feature name",
  "referenceNum": "DEVELOP-123",
  "release": {
    "id": "789013",
    "name": "Q2 2025 Release"
  },
  "assignedToUser": {
    "id": "111222",
    "name": "John Doe"
  },
  "workflowStatus": {
    "id": "333444",
    "name": "In Progress"
  }
}
```

### 8. add_feature_comment

Add a comment to an existing feature. Comments are additive and separate from the feature description.

**Parameters:**

- `reference` (required): Feature reference number (e.g., "DEVELOP-123")
- `comment` (required): Comment text to add to the feature

**Example:**

```json
{
  "reference": "DEVELOP-123",
  "comment": "This feature is ready for QA testing."
}
```

**Response:**

```json
{
  "success": true,
  "feature": {
    "id": "345678",
    "referenceNum": "DEVELOP-123"
  },
  "message": "Comment added successfully"
}
```

### 9. get_user_by_email

Get a user ID by email address. Useful for finding user IDs when assigning features.

**Parameters:**

- `email` (required): Email address to look up

**Example:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "id": "111222",
  "email": "user@example.com"
}
```

### 10. get_configured_user

Get the configured user email and user ID from the `AHA_USER_EMAIL` environment variable. This tool reads the configured email and resolves the corresponding user ID, returning both in a single call. This is useful for AI assistants that need to determine the current user without reading git config or parsing MCP config files.

**Parameters:**

- None (reads from `AHA_USER_EMAIL` environment variable)

**Example:**

```json
{}
```

**Response:**

```json
{
  "email": "user@example.com",
  "userId": "111222"
}
```

**Note:** This tool requires `AHA_USER_EMAIL` to be set in the environment. If not configured, it will return an error.

## Example Queries

### Reading Data
- "Get feature DEVELOP-123"
- "Fetch the product roadmap page ABC-N-213"
- "Search for pages about launch planning"
- "Get requirement ADT-123-1"
- "Find all pages mentioning Q2 goals"
- "Get all releases for product 123456"
- "Get workflow statuses for project 123456"
- "Get the configured user email and ID"

### Creating and Updating
- "Create a new feature called 'User Authentication' with description 'Add login functionality' in release 789012"
- "Update feature DEVELOP-123 to assign it to user 111222"
- "Change the status of feature DEVELOP-123 to 'In Progress'"
- "Move feature DEVELOP-123 to release 789013"
- "Add a comment to feature DEVELOP-123 saying 'Ready for review'"

## Configuration Options

| Variable          | Description                                                                    | Default  |
| ----------------- | ------------------------------------------------------------------------------ | -------- |
| `AHA_API_TOKEN`   | Your Aha! API token                                                            | Required |
| `AHA_DOMAIN`      | Your Aha! domain (e.g., yourcompany.aha.io)                                    | Required |
| `AHA_PRODUCT_ID`  | Default product ID for `get_releases` tool (optional)                          | None     |
| `AHA_USER_EMAIL`  | Default user email for assigning features and `get_configured_user` tool (optional) | None     |
| `LOG_LEVEL`       | Logging level (debug, info, warn, error)                                       | info     |
| `PORT`            | Port for SSE transport                                                         | 3000     |
| `TRANSPORT`       | Transport type (stdio or sse)                                                   | stdio    |

## Troubleshooting

<details>
<summary>Common Issues</summary>

1. Authentication errors:

   - Verify your API token is correct and properly set in your environment
   - Ensure the token has the necessary permissions in Aha!
   - Confirm you're using the correct Aha! domain

2. Server won't start:

   - Ensure all dependencies are installed
   - Check the Node.js version is v20 or higher
   - Verify the TypeScript compilation succeeds
   - Confirm environment variables are properly set and accessible

3. Connection issues:

   - Check your network connection
   - Verify your Aha! domain is accessible
   - Ensure your API token has not expired

4. API Request failures:

   - Check the reference numbers are correct
   - Verify the searchable type is valid
   - Ensure you have permissions to access the requested resources

5. Environment variable issues:
   - Make sure environment variables are properly set and accessible to the MCP server
   - Check that your secure storage method is correctly configured
   - Verify that the environment variables are being passed to the MCP server process
   </details>
