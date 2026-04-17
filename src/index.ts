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
          description: "Get an Aha! feature or requirement by reference number. Returns name, description, workflow status (name, complete flag), and linked epic. Use this to read current feature state before updating, or to confirm status after a update_feature call. For epics, use get_epic instead.",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description:
                  "Reference number (e.g., DEVELOP-123 or ADT-123-1)",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "get_page",
          description:
            "Get an Aha! page by reference number with optional relationships",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Reference number (e.g., ABC-N-213)",
              },
              includeParent: {
                type: "boolean",
                description: "Include parent page in the response",
                default: false,
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "search_documents",
          description:
            "Search Aha! records by full-text query across features, epics, initiatives, or pages",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query string",
              },
              searchableType: {
                type: "string",
                description:
                  'Type of record to search. Valid values: "Feature", "Epic", "Initiative", "Page". Defaults to "Page".',
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
            "List releases in an Aha! product/workspace with id, reference number, name, and release date",
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
          name: "get_release",
          description:
            "Get a specific Aha! release by its reference number (e.g. STU-R-46). Returns the release name, date, linked initiatives, and internal ID. Use this to confirm release details or get the ID needed for listing its contents.",
          inputSchema: {
            type: "object",
            properties: {
              release_reference_num: {
                type: "string",
                description: "The release reference number, e.g. STU-R-46",
              },
            },
            required: ["release_reference_num"],
          },
        },
        {
          name: "list_features_in_release",
          description:
            "List all features assigned to a specific Aha! release, identified by reference number (e.g. STU-R-46). Returns each feature's reference number, name, workflow status, assigned epic, and assignee. Features with a null epic field are not yet tied to an epic — useful for spotting coverage gaps.",
          inputSchema: {
            type: "object",
            properties: {
              release_reference_num: {
                type: "string",
                description: "The release reference number, e.g. STU-R-46",
              },
            },
            required: ["release_reference_num"],
          },
        },
        {
          name: "list_epics_in_release",
          description:
            "List all epics assigned to a specific Aha! release, identified by reference number (e.g. STU-R-46). Returns each epic's reference number, name, workflow status, and feature count.",
          inputSchema: {
            type: "object",
            properties: {
              release_reference_num: {
                type: "string",
                description: "The release reference number, e.g. STU-R-46",
              },
            },
            required: ["release_reference_num"],
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
            "Update an Aha! epic by reference number; can update name, description, and/or linked release or initiative. Also supports setting `workflow_status` by name — status names are workspace-specific, so call `list_workflow_statuses` first if you are unsure of the valid values. Use `get_epic` to retrieve the current epic state before updating.",
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
              initiative_reference_num: {
                type: "string",
                description:
                  "Initiative reference number or ID to link this epic to (e.g., ACME-I-5)",
              },
              goal_ids: {
                type: "array",
                items: { type: "number" },
                description:
                  "Array of numeric goal IDs to link this epic to. Use list_goals to find IDs.",
              },
              workflow_status: {
                type: "string",
                description:
                  "Workflow status name to set on this epic. Status names are workspace-specific — call list_workflow_statuses to retrieve valid values.",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "update_feature",
          description:
            "Update an Aha! feature by reference number; can update name, description, and/or linked release, epic, initiative, or assignee. Also supports setting `workflow_status` by name — status names are workspace-specific, so call `list_workflow_statuses` first if you are unsure of the valid values. Use `get_record` to retrieve the current feature state before updating.",
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
              epic_id: {
                type: "string",
                description: "Epic reference number or ID to link this feature to",
              },
              initiative_reference_num: {
                type: "string",
                description:
                  "Initiative reference number or ID to link this feature to (e.g., ACME-I-5)",
              },
              goal_ids: {
                type: "array",
                items: { type: "number" },
                description:
                  "Array of numeric goal IDs to link this feature to. Use list_goals to find IDs.",
              },
              workflow_status: {
                type: "string",
                description:
                  "Workflow status name to set on this feature. Status names are workspace-specific — call list_workflow_statuses to retrieve valid values.",
              },
            },
            required: ["reference_num"],
          },
        },
        {
          name: "update_initiative",
          description:
            "Update an Aha! initiative by reference number; can update name, description, and/or link to goals",
          inputSchema: {
            type: "object",
            properties: {
              reference_num: {
                type: "string",
                description: "Initiative reference number (e.g., ACME-I-5)",
              },
              product_id: {
                type: "string",
                description: "Product/workspace identifier that owns the initiative",
              },
              name: {
                type: "string",
                description: "New initiative name",
              },
              description: {
                type: "string",
                description:
                  "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content.",
              },
              goal_ids: {
                type: "array",
                items: { type: "number" },
                description:
                  "Array of numeric goal IDs to link this initiative to. Use list_goals to find IDs.",
              },
            },
            required: ["reference_num", "product_id"],
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
            "List Aha! initiatives in a product/workspace, returning IDs, reference numbers, and names",
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
            "List Aha! goals in a product/workspace, returning IDs, reference numbers, and names",
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
          name: "list_workflow_statuses",
          description:
            "List all valid workflow status names for a given Aha! workspace. Returns status name, ID, position, and completion flag for each status in the workflow, grouped by workflow name. Call this before using update_feature or update_epic with a workflow_status value — status names are workspace-specific and cannot be assumed. Pass the workspace key (e.g. \"STU\") derived from any feature or epic reference number in that workspace.",
          inputSchema: {
            type: "object",
            properties: {
              workspace_id: {
                type: "string",
                description:
                  "Workspace key or numeric ID (e.g. \"LUM\" or \"LUM-1\"). Derived from the prefix of any feature or epic reference number in that workspace.",
              },
              record_type: {
                type: "string",
                enum: ["feature", "epic"],
                description:
                  "Type of record to retrieve statuses for: \"feature\" or \"epic\"",
              },
            },
            required: ["workspace_id", "record_type"],
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
      } else if (request.params.name === "get_release") {
        return this.handlers.handleGetRelease(request);
      } else if (request.params.name === "list_features_in_release") {
        return this.handlers.handleListFeaturesInRelease(request);
      } else if (request.params.name === "list_epics_in_release") {
        return this.handlers.handleListEpicsInRelease(request);
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
      } else if (request.params.name === "update_initiative") {
        return this.handlers.handleUpdateInitiative(request);
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
      } else if (request.params.name === "list_workflow_statuses") {
        return this.handlers.handleListWorkflowStatuses(request);
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
