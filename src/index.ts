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

if (!AHA_API_TOKEN) {
  throw new Error("AHA_API_TOKEN environment variable is required");
}

if (!AHA_DOMAIN) {
  throw new Error("AHA_DOMAIN environment variable is required");
}

const verifiedAhaApiToken = AHA_API_TOKEN;
const verifiedAhaDomain = AHA_DOMAIN;

const client = new GraphQLClient(
  `https://${verifiedAhaDomain}.aha.io/api/v2/graphql`,
  {
    headers: {
      Authorization: `Bearer ${verifiedAhaApiToken}`,
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
        version: "1.1.0",
      },
      {
        capabilities: {
          tools: { listChanged: true },
        },
      }
    );

    this.handlers = new Handlers(
      client,
      verifiedAhaDomain,
      verifiedAhaApiToken
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
          name: "list_products",
          description:
            "List Aha! workspaces/products with id, reference prefix, and name",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "list_releases",
          description:
            "List releases in an Aha! product/workspace with id, name, and release date",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
            },
            required: ["product_id"],
          },
        },
        {
          name: "list_epics",
          description:
            "List Aha! epics in a product/workspace, returning reference numbers and names",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
            },
            required: ["product_id"],
          },
        },
        {
          name: "list_features",
          description:
            "List Aha! features in a product/workspace, returning reference numbers and names",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
            },
            required: ["product_id"],
          },
        },
        {
          name: "create_epic",
          description:
            "Create an Aha! epic in a product/workspace, optionally with HTML description",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
              name: {
                type: "string",
                description: "Epic name",
              },
              release_id: {
                type: "string",
                description: "Target release identifier",
              },
              description: {
                type: "string",
                description:
                  "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content.",
              },
            },
            required: ["product_id", "name", "release_id"],
          },
        },
        {
          name: "create_feature",
          description:
            "Create an Aha! feature in a product/workspace, optionally linked to an epic and with HTML description",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
              name: {
                type: "string",
                description: "Feature name",
              },
              release_id: {
                type: "string",
                description: "Target release identifier",
              },
              epic_id: {
                type: "string",
                description: "Optional epic identifier to associate",
              },
              description: {
                type: "string",
                description:
                  "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content.",
              },
            },
            required: ["product_id", "name", "release_id"],
          },
        },
        {
          name: "update_epic",
          description:
            "Update an Aha! epic by reference number; can update name and/or description",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Epic reference number",
              },
              name: {
                type: "string",
                description: "New epic name",
              },
              description: {
                type: "string",
                description:
                  "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content.",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "update_feature",
          description:
            "Update an Aha! feature by reference number; can update name and/or description",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Feature reference number (e.g., DEVELOP-123)",
              },
              name: {
                type: "string",
                description: "New feature name",
              },
              description: {
                type: "string",
                description:
                  "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content.",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "get_epic",
          description: "Get an Aha! epic by reference number",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Epic reference number",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "get_initiative",
          description: "Get an Aha! initiative by reference number",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Initiative reference number",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "get_goal",
          description: "Get an Aha! goal by reference number",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Goal reference number",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "list_initiatives",
          description:
            "List Aha! initiatives in a product/workspace, returning reference numbers and names",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
            },
            required: ["product_id"],
          },
        },
        {
          name: "list_goals",
          description:
            "List Aha! goals in a product/workspace, returning reference numbers and names",
          inputSchema: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "Product/workspace identifier",
              },
            },
            required: ["product_id"],
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
      } else if (request.params.name === "list_products") {
        return this.handlers.handleListProducts();
      } else if (request.params.name === "list_releases") {
        return this.handlers.handleListReleases(request);
      } else if (request.params.name === "list_features") {
        return this.handlers.handleListFeatures(request);
      } else if (request.params.name === "list_epics") {
        return this.handlers.handleListEpics(request);
      } else if (request.params.name === "create_epic") {
        return this.handlers.handleCreateEpic(request);
      } else if (request.params.name === "create_feature") {
        return this.handlers.handleCreateFeature(request);
      } else if (request.params.name === "update_epic") {
        return this.handlers.handleUpdateEpic(request);
      } else if (request.params.name === "update_feature") {
        return this.handlers.handleUpdateFeature(request);
      } else if (request.params.name === "get_epic") {
        return this.handlers.handleGetEpic(request);
      } else if (request.params.name === "get_initiative") {
        return this.handlers.handleGetInitiative(request);
      } else if (request.params.name === "get_goal") {
        return this.handlers.handleGetGoal(request);
      } else if (request.params.name === "list_initiatives") {
        return this.handlers.handleListInitiatives(request);
      } else if (request.params.name === "list_goals") {
        return this.handlers.handleListGoals(request);
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
