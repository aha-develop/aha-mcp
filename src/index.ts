#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from "graphql-request";
import { Handlers } from "./handlers.js";

const AHA_API_TOKEN = process.env.AHA_API_TOKEN;
const AHA_DOMAIN = process.env.AHA_DOMAIN;
const AHA_PRODUCT_ID = process.env.AHA_PRODUCT_ID;
const AHA_USER_EMAIL = process.env.AHA_USER_EMAIL;

if (!AHA_API_TOKEN) {
  throw new Error("AHA_API_TOKEN environment variable is required");
}

if (!AHA_DOMAIN) {
  throw new Error("AHA_DOMAIN environment variable is required");
}

const client = new GraphQLClient(
  `https://${AHA_DOMAIN}.aha.io/api/v2/graphql`,
  {
    headers: {
      Authorization: `Bearer ${AHA_API_TOKEN}`,
    },
  }
);

class AhaMcp {
  private server: Server;
  private handlers: Handlers;

  constructor() {
    this.server = new Server(
      {
        name: "aha-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.handlers = new Handlers(
      client,
      AHA_PRODUCT_ID,
      AHA_API_TOKEN,
      AHA_DOMAIN,
      AHA_USER_EMAIL
    );
    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_record",
          description: "Get an Aha! feature or requirement by reference number",
          inputSchema: {
            type: "object",
            properties: {
              reference: {
                type: "string",
                description:
                  "Reference number (e.g., DEVELOP-123 or ADT-123-1)",
              },
            },
            required: ["reference"],
          },
        },
        {
          name: "get_page",
          description:
            "Get an Aha! page by reference number with optional relationships",
          inputSchema: {
            type: "object",
            properties: {
              reference: {
                type: "string",
                description: "Reference number (e.g., ABC-N-213)",
              },
              includeParent: {
                type: "boolean",
                description: "Include parent page in the response",
                default: false,
              },
            },
            required: ["reference"],
          },
        },
        {
          name: "search_documents",
          description: "Search for Aha! documents",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query string",
              },
              searchableType: {
                type: "string",
                description: "Type of document to search for (e.g., Page)",
                default: "Page",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_releases",
          description:
            "Query releases for a product. Product ID can be provided as a parameter or set via AHA_PRODUCT_ID environment variable",
          inputSchema: {
            type: "object",
            properties: {
              productId: {
                type: "string",
                description:
                  "Product ID to query releases for (optional if AHA_PRODUCT_ID is set)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_workflow_statuses",
          description:
            "Query workflow statuses for a project. Useful for finding valid workflow status IDs when updating features.",
          inputSchema: {
            type: "object",
            properties: {
              projectId: {
                type: "string",
                description: "Project ID to query workflow statuses for",
              },
            },
            required: ["projectId"],
          },
        },
        {
          name: "create_feature",
          description: "Create a new feature in Aha!",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Feature name/title",
              },
              description: {
                type: "string",
                description: "Feature description",
              },
              releaseId: {
                type: "string",
                description: "Release ID where the feature will be created",
              },
            },
            required: ["name", "description", "releaseId"],
          },
        },
        {
          name: "update_feature",
          description: "Update key properties of an existing feature (release, assignment, status)",
          inputSchema: {
            type: "object",
            properties: {
              reference: {
                type: "string",
                description: "Feature reference number (e.g., DEVELOP-123)",
              },
              release: {
                type: "string",
                description: "Release ID to assign the feature to",
              },
              assignedToUser: {
                type: "string",
                description: "User ID to assign the feature to",
              },
              assignedToUserEmail: {
                type: "string",
                description: "Email address of user to assign the feature to (alternative to assignedToUser)",
              },
              workflowStatus: {
                type: "string",
                description: "Workflow status ID or name to set for the feature. If a name is provided, it will be looked up automatically.",
              },
            },
            required: ["reference"],
          },
        },
        {
          name: "add_feature_comment",
          description: "Add a comment to an existing feature",
          inputSchema: {
            type: "object",
            properties: {
              reference: {
                type: "string",
                description: "Feature reference number (e.g., DEVELOP-123)",
              },
              comment: {
                type: "string",
                description: "Comment text to add to the feature",
              },
            },
            required: ["reference", "comment"],
          },
        },
        {
          name: "get_user_by_email",
          description: "Get a user ID by email address",
          inputSchema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                description: "Email address to look up",
              },
            },
            required: ["email"],
          },
        },
        {
          name: "get_configured_user",
          description:
            "Get the configured user email and user ID from AHA_USER_EMAIL environment variable. Returns both email and userId in a single call.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "get_record") {
        return this.handlers.handleGetRecord(request);
      } else if (request.params.name === "get_page") {
        return this.handlers.handleGetPage(request);
      } else if (request.params.name === "search_documents") {
        return this.handlers.handleSearchDocuments(request);
      } else if (request.params.name === "get_releases") {
        return this.handlers.handleGetReleases(request);
      } else if (request.params.name === "get_workflow_statuses") {
        return this.handlers.handleGetWorkflowStatuses(request);
      } else if (request.params.name === "create_feature") {
        return this.handlers.handleCreateFeature(request);
      } else if (request.params.name === "update_feature") {
        return this.handlers.handleUpdateFeature(request);
      } else if (request.params.name === "add_feature_comment") {
        return this.handlers.handleAddFeatureComment(request);
      } else if (request.params.name === "get_user_by_email") {
        return this.handlers.handleGetUserByEmail(request);
      } else if (request.params.name === "get_configured_user") {
        return this.handlers.handleGetConfiguredUser(request);
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Aha! MCP server running on stdio");
  }
}

const server = new AhaMcp();
server.run().catch(console.error);
