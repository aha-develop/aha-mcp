# Installing aha-mcp in Cursor

This guide will help you install and configure the aha-mcp server in Cursor.

## Prerequisites

- Node.js v20 or higher
- npm (usually comes with Node.js)
- An Aha! account with API access
- Cursor IDE
- Access to the @bayerit npm registry

## Installation Steps

### Step 1: Get Your Aha! API Token

1. Log in to your Aha! account at `<yourcompany>.aha.io`
2. Visit [secure.aha.io/settings/api_keys](https://secure.aha.io/settings/api_keys)
3. Click "Create new API key"
4. Copy the token immediately (it won't be shown again)

### Step 2: Configure Cursor

1. Open Cursor Settings (⌘, on macOS or Ctrl+, on Windows/Linux)
2. Navigate to **MCP** settings
3. Click **+ Add new Global MCP Server**
4. Add the following configuration with your environment variables:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "@bayerit/bayer-aha-mcp@1.0.0"],
      "env": {
        "AHA_API_TOKEN": "your-api-token-here",
        "AHA_DOMAIN": "yourcompany",
        "AHA_PRODUCT_ID": "optional-product-id",
        "AHA_USER_EMAIL": "optional-user@example.com"
      }
    }
  }
}
```

**Important:** Replace the following values in the `env` section:
- `"your-api-token-here"` - Your Aha! API token from Step 1
- `"yourcompany"` - Your Aha! domain (e.g., if you access Aha! at `yourcompany.aha.io`, use `yourcompany`)
- `"optional-product-id"` - (Optional) Default product ID for `get_releases` tool
- `"optional-user@example.com"` - (Optional) Default user email for assigning features

**Note:** The `npx` command automatically downloads and runs the package, so no manual installation is required.

### Step 3: Restart Cursor

After adding the configuration, restart Cursor to load the MCP server.

## Environment Variables

| Variable          | Description                                                                    | Required |
| ----------------- | ------------------------------------------------------------------------------ | -------- |
| `AHA_API_TOKEN`   | Your Aha! API token                                                            | Yes      |
| `AHA_DOMAIN`      | Your Aha! domain (e.g., `yourcompany` if you access aha at `yourcompany.aha.io`) | Yes      |
| `AHA_PRODUCT_ID`  | Default product ID for `get_releases` tool (optional)                          | No       |
| `AHA_USER_EMAIL`  | Default user email for assigning features (optional)                          | No       |

## Updating to a New Version

To update to a newer version, simply update the version number in your Cursor configuration:

```json
{
  "mcpServers": {
    "aha-mcp": {
      "command": "npx",
      "args": ["-y", "@bayerit/bayer-aha-mcp@<new-version>"],
      ...
    }
  }
}
```

Then restart Cursor or reload the MCP server connection.

## Using the MCP in Cursor

Once configured, you can interact with Aha! directly from Cursor's chat interface using natural language. The AI assistant will automatically use the appropriate MCP tools to fulfill your requests.

- "Create a new story with the title 'User Authentication' and description 'Add login functionality with email and password' in release 789012"
- "Assign feature DEVELOP-123 to john.doe@example.com"
- "Move feature DEVELOP-123 to release 789013"
- "Set the status of feature DEVELOP-123 to 'In Progress'"
- "Add a comment to feature DEVELOP-123 saying 'Ready for QA testing'"

## How It Works

When you make a request in Cursor's chat interface, the AI assistant:

1. Understands your natural language request
2. Determines which MCP tools to use
3. Makes the appropriate API calls to Aha!
4. Returns the results directly in the chat interface

You don't need to know the exact API structure or tool names - just describe what you want to do in plain English!

## Troubleshooting

### MCP Server Not Connecting

- Ensure you're using `npx` with the correct package name and version in your Cursor configuration
- Check that Node.js v20+ is installed: `node --version`
- Verify you have access to the @bayerit npm registry
- Restart Cursor after making configuration changes

### Authentication Errors

- Verify your API token is correct in the Cursor MCP configuration
- Ensure the token has the necessary permissions in Aha!
- Confirm you're using the correct Aha! domain (just the subdomain, not the full URL)

### Package Installation Issues

- Ensure you have access to the @bayerit npm registry
- Verify Node.js version is v20 or higher: `node --version`
- Try clearing npm cache: `npm cache clean --force`
- Verify `npx` is available: `npx --version`

### Changes Not Reflecting

- Update the version number in your Cursor configuration to the desired version
- Restart Cursor to reload the MCP server
- Verify the version in your Cursor configuration is correct

