#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
  private server: McpServer;
  private handlers: Handlers;

  constructor() {
    this.server = new McpServer(
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

    this.server.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.registerTool(
      "get_record",
      {
        description:
          "Get an Aha! feature or requirement by reference number. Returns name, description, workflow status (name, complete flag), and linked epic. Use this to read current feature state before updating, or to confirm status after a update_feature call. For epics, use get_epic instead.",
        inputSchema: {
          reference_num: z
            .string()
            .describe("Reference number (e.g., DEVELOP-123 or ADT-123-1)"),
        },
      },
      (args) => this.handlers.handleGetRecord({ params: { arguments: args } })
    );

    this.server.registerTool(
      "get_page",
      {
        description:
          "Get an Aha! page by reference number with optional relationships",
        inputSchema: {
          reference_num: z
            .string()
            .describe("Reference number (e.g., ABC-N-213)"),
          includeParent: z
            .boolean()
            .optional()
            .describe("Include parent page in the response"),
        },
      },
      (args) => this.handlers.handleGetPage({ params: { arguments: args } })
    );

    this.server.registerTool(
      "search_documents",
      {
        description:
          "Search Aha! records by full-text query across features, epics, initiatives, or pages",
        inputSchema: {
          query: z.string().describe("Search query string"),
          searchableType: z
            .string()
            .optional()
            .describe(
              'Type of record to search. Valid values: "Feature", "Epic", "Initiative", "Page". Defaults to "Page".'
            ),
        },
      },
      (args) =>
        this.handlers.handleSearchDocuments({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_products",
      {
        description:
          "List Aha! workspaces/products with id, reference prefix, and name",
      },
      () => this.handlers.handleListProducts()
    );

    this.server.registerTool(
      "list_releases",
      {
        description:
          "List releases in an Aha! product/workspace with id, reference number, name, and release date",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
        },
      },
      (args) =>
        this.handlers.handleListReleases({ params: { arguments: args } })
    );

    this.server.registerTool(
      "get_release",
      {
        description:
          "Get a specific Aha! release by its reference number (e.g. STU-R-46). Returns the release name, date, linked initiatives, and internal ID. Use this to confirm release details or get the ID needed for listing its contents.",
        inputSchema: {
          release_reference_num: z
            .string()
            .describe("The release reference number, e.g. STU-R-46"),
        },
      },
      (args) =>
        this.handlers.handleGetRelease({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_features_in_release",
      {
        description:
          "List all features assigned to a specific Aha! release, identified by reference number (e.g. STU-R-46). Returns each feature's reference number, name, workflow status, assigned epic, and assignee. Features with a null epic field are not yet tied to an epic — useful for spotting coverage gaps.",
        inputSchema: {
          release_reference_num: z
            .string()
            .describe("The release reference number, e.g. STU-R-46"),
        },
      },
      (args) =>
        this.handlers.handleListFeaturesInRelease({
          params: { arguments: args },
        })
    );

    this.server.registerTool(
      "list_epics_in_release",
      {
        description:
          "List all epics assigned to a specific Aha! release, identified by reference number (e.g. STU-R-46). Returns each epic's reference number, name, workflow status, and feature count.",
        inputSchema: {
          release_reference_num: z
            .string()
            .describe("The release reference number, e.g. STU-R-46"),
        },
      },
      (args) =>
        this.handlers.handleListEpicsInRelease({
          params: { arguments: args },
        })
    );

    this.server.registerTool(
      "list_epics",
      {
        description:
          "List Aha! epics in a product/workspace, returning reference numbers and names",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
        },
      },
      (args) =>
        this.handlers.handleListEpics({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_features",
      {
        description:
          "List Aha! features in a product/workspace, returning reference numbers and names",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
        },
      },
      (args) =>
        this.handlers.handleListFeatures({ params: { arguments: args } })
    );

    this.server.registerTool(
      "create_epic",
      {
        description:
          "Create an Aha! epic in a product/workspace, optionally with HTML description",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
          name: z.string().describe("Epic name"),
          release_id: z.string().describe("Target release identifier"),
          description: z
            .string()
            .optional()
            .describe(
              "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content."
            ),
        },
      },
      (args) =>
        this.handlers.handleCreateEpic({ params: { arguments: args } })
    );

    this.server.registerTool(
      "create_feature",
      {
        description:
          "Create an Aha! feature in a product/workspace, optionally linked to an epic and with HTML description",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
          name: z.string().describe("Feature name"),
          release_id: z.string().describe("Target release identifier"),
          epic_id: z
            .string()
            .optional()
            .describe("Optional epic identifier to associate"),
          description: z
            .string()
            .optional()
            .describe(
              "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content."
            ),
        },
      },
      (args) =>
        this.handlers.handleCreateFeature({ params: { arguments: args } })
    );

    this.server.registerTool(
      "update_epic",
      {
        description:
          "Update an Aha! epic by reference number; can update name, description, and/or linked release or initiative. Also supports setting `workflow_status` by name — status names are workspace-specific, so call `list_workflow_statuses` first if you are unsure of the valid values. Use `get_epic` to retrieve the current epic state before updating.",
        inputSchema: {
          reference_num: z.string().describe("Epic reference number"),
          name: z.string().optional().describe("New epic name"),
          description: z
            .string()
            .optional()
            .describe(
              "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content."
            ),
          initiative_reference_num: z
            .string()
            .optional()
            .describe(
              "Initiative reference number or ID to link this epic to (e.g., ACME-I-5)"
            ),
          goal_ids: z
            .array(z.number())
            .optional()
            .describe(
              "Array of numeric goal IDs to link this epic to. Use list_goals to find IDs."
            ),
          workflow_status: z
            .string()
            .optional()
            .describe(
              "Workflow status name to set on this epic. Status names are workspace-specific — call list_workflow_statuses to retrieve valid values."
            ),
        },
      },
      (args) =>
        this.handlers.handleUpdateEpic({ params: { arguments: args } })
    );

    this.server.registerTool(
      "update_feature",
      {
        description:
          "Update an Aha! feature by reference number; can update name, description, and/or linked release, epic, initiative, or assignee. Also supports setting `workflow_status` by name — status names are workspace-specific, so call `list_workflow_statuses` first if you are unsure of the valid values. Use `get_record` to retrieve the current feature state before updating.",
        inputSchema: {
          reference_num: z
            .string()
            .describe("Feature reference number (e.g., DEVELOP-123)"),
          name: z.string().optional().describe("New feature name"),
          description: z
            .string()
            .optional()
            .describe(
              "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content."
            ),
          epic_id: z
            .string()
            .optional()
            .describe("Epic reference number or ID to link this feature to"),
          initiative_reference_num: z
            .string()
            .optional()
            .describe(
              "Initiative reference number or ID to link this feature to (e.g., ACME-I-5)"
            ),
          goal_ids: z
            .array(z.number())
            .optional()
            .describe(
              "Array of numeric goal IDs to link this feature to. Use list_goals to find IDs."
            ),
          workflow_status: z
            .string()
            .optional()
            .describe(
              "Workflow status name to set on this feature. Status names are workspace-specific — call list_workflow_statuses to retrieve valid values."
            ),
        },
      },
      (args) =>
        this.handlers.handleUpdateFeature({ params: { arguments: args } })
    );

    this.server.registerTool(
      "update_initiative",
      {
        description:
          "Update an Aha! initiative by reference number; can update name, description, and/or link to goals",
        inputSchema: {
          reference_num: z
            .string()
            .describe("Initiative reference number (e.g., ACME-I-5)"),
          product_id: z
            .string()
            .describe(
              "Product/workspace identifier that owns the initiative"
            ),
          name: z.string().optional().describe("New initiative name"),
          description: z
            .string()
            .optional()
            .describe(
              "Record body as raw HTML. Aha stores and renders HTML directly — pass well-formed tags (e.g. <p>Text here</p>, <ul><li>Item</li></ul>). Do not pass markdown. Do not HTML-entity-encode structural tags — only encode literal <, >, or & characters that appear as text content."
            ),
          goal_ids: z
            .array(z.number())
            .optional()
            .describe(
              "Array of numeric goal IDs to link this initiative to. Use list_goals to find IDs."
            ),
        },
      },
      (args) =>
        this.handlers.handleUpdateInitiative({ params: { arguments: args } })
    );

    this.server.registerTool(
      "get_epic",
      {
        description: "Get an Aha! epic by reference number",
        inputSchema: {
          reference_num: z.string().describe("Epic reference number"),
        },
      },
      (args) =>
        this.handlers.handleGetEpic({ params: { arguments: args } })
    );

    this.server.registerTool(
      "get_initiative",
      {
        description: "Get an Aha! initiative by reference number",
        inputSchema: {
          reference_num: z.string().describe("Initiative reference number"),
        },
      },
      (args) =>
        this.handlers.handleGetInitiative({ params: { arguments: args } })
    );

    this.server.registerTool(
      "get_goal",
      {
        description: "Get an Aha! goal by reference number",
        inputSchema: {
          reference_num: z.string().describe("Goal reference number"),
        },
      },
      (args) =>
        this.handlers.handleGetGoal({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_initiatives",
      {
        description:
          "List Aha! initiatives in a product/workspace, returning IDs, reference numbers, and names",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
        },
      },
      (args) =>
        this.handlers.handleListInitiatives({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_goals",
      {
        description:
          "List Aha! goals in a product/workspace, returning IDs, reference numbers, and names",
        inputSchema: {
          product_id: z.string().describe("Product/workspace identifier"),
        },
      },
      (args) =>
        this.handlers.handleListGoals({ params: { arguments: args } })
    );

    this.server.registerTool(
      "list_workflow_statuses",
      {
        description:
          'List all valid workflow status names for a given Aha! workspace. Returns status name, ID, position, and completion flag for each status in the workflow, grouped by workflow name. Call this before using update_feature or update_epic with a workflow_status value — status names are workspace-specific and cannot be assumed. Pass the workspace key (e.g. "STU") derived from any feature or epic reference number in that workspace.',
        inputSchema: {
          workspace_id: z
            .string()
            .describe(
              'Workspace key or numeric ID (e.g. "LUM" or "LUM-1"). Derived from the prefix of any feature or epic reference number in that workspace.'
            ),
          record_type: z
            .enum(["feature", "epic"])
            .describe(
              'Type of record to retrieve statuses for: "feature" or "epic"'
            ),
        },
      },
      (args) =>
        this.handlers.handleListWorkflowStatuses({
          params: { arguments: args },
        })
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Aha! MCP server running on stdio");
  }
}

const server = new AhaMcp();
server.run().catch(console.error);
